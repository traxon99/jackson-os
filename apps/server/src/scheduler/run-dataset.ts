import type { Logger, SourceAdapter } from '@jos/core';
import { formatUpstreamError, UpstreamError } from '@jos/core';
import type { JosDatabase } from '@jos/db';
import { writeMetricPoints } from '../data/metrics.js';
import type { SnapshotStore } from '../data/snapshots.js';

export type DatasetRunner = ReturnType<typeof createRunner>;

const FETCH_TIMEOUT_MS = 15_000;

export function createRunner(deps: {
  store: SnapshotStore;
  db: JosDatabase;
  log: Logger;
  now: () => number;
  fetchImpl: typeof fetch;
}) {
  const inflight = new Map<
    string,
    Promise<{ retryAfterMs?: number } | undefined>
  >();

  async function run<TConfig>(
    source: SourceAdapter<TConfig>,
    datasetKey: string,
    config: TConfig,
  ): Promise<{ retryAfterMs?: number } | undefined> {
    const flightKey = `${source.id}:${datasetKey}`;
    const existing = inflight.get(flightKey);
    if (existing !== undefined) {
      return existing;
    }

    const promise = executeRun(source, datasetKey, config).finally(() => {
      inflight.delete(flightKey);
    });
    inflight.set(flightKey, promise);
    return promise;
  }

  async function executeRun<TConfig>(
    source: SourceAdapter<TConfig>,
    datasetKey: string,
    config: TConfig,
  ): Promise<{ retryAfterMs?: number } | undefined> {
    const dataset = source.datasets[datasetKey];
    if (dataset === undefined) {
      throw new Error(`unknown dataset: ${datasetKey}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const ctx = {
        config,
        fetch: deps.fetchImpl,
        log: deps.log,
        now: () => new Date(deps.now()),
        signal: controller.signal,
      };

      const raw = await dataset.fetch(ctx);
      const data = dataset.schema.parse(raw);
      const fetchedAt = deps.now();
      const expiresAt = fetchedAt + dataset.refresh.staleAfterMs;

      if (dataset.toMetrics !== undefined) {
        const points = dataset.toMetrics(data, new Date(fetchedAt));
        await writeMetricPoints(deps.db, source.id, points);
      }

      await deps.store.putOk(source.id, datasetKey, data, fetchedAt, expiresAt);
    } catch (error) {
      if (error instanceof UpstreamError) {
        const message = formatUpstreamError(error, new Date(deps.now()));
        deps.log.error(
          { err: error, sourceId: source.id, datasetKey },
          message,
        );
        await deps.store.putError(source.id, datasetKey, message);
        return { retryAfterMs: error.retryAfterMs };
      }
      const message =
        error instanceof Error ? error.message : 'dataset fetch failed';
      deps.log.error({ err: error, sourceId: source.id, datasetKey }, message);
      await deps.store.putError(source.id, datasetKey, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { run };
}
