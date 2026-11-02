import type { Logger, SourceAdapter } from '@jos/core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { SnapshotStore } from '../data/snapshots.js';

export type DatasetRunner = ReturnType<typeof createRunner>;

const FETCH_TIMEOUT_MS = 15_000;

export function createRunner(deps: {
  store: SnapshotStore;
  db: BetterSQLite3Database;
  log: Logger;
  now: () => number;
  fetchImpl: typeof fetch;
}) {
  const inflight = new Map<string, Promise<void>>();

  async function run<TConfig>(
    source: SourceAdapter<TConfig>,
    datasetKey: string,
    config: TConfig,
  ): Promise<void> {
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
  ): Promise<void> {
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
        writeMetricPoints(deps.db, source.id, points);
      }

      deps.store.putOk(source.id, datasetKey, data, fetchedAt, expiresAt);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'dataset fetch failed';
      deps.log.error({ err: error, sourceId: source.id, datasetKey }, message);
      deps.store.putError(source.id, datasetKey, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { run };
}
