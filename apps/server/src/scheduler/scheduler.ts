import type { Registry } from '@jos/core';
import type { SnapshotStore } from '../data/snapshots.js';
import type { DatasetRunner } from './run-dataset.js';

export type Scheduler = ReturnType<typeof createScheduler>;

type JobKey = string;

function jobKey(sourceId: string, datasetKey: string): JobKey {
  return `${sourceId}:${datasetKey}`;
}

function delayWithJitter(baseMs: number, random: () => number): number {
  const jitter = 0.9 + random() * 0.2;
  return Math.floor(baseMs * jitter);
}

export function createScheduler(deps: {
  registry: Registry;
  runner: DatasetRunner;
  store: SnapshotStore;
  enabled: (sourceId: string) => boolean;
  random: () => number;
  now: () => number;
  getSourceConfig: (sourceId: string) => unknown;
}) {
  const timers = new Map<JobKey, ReturnType<typeof setTimeout>>();
  const failures = new Map<JobKey, number>();
  const nextFetchAtByJob = new Map<JobKey, number>();
  const lastScheduledDelay = new Map<JobKey, number>();

  function computeBackoffMs(
    everyMs: number,
    failureCount: number,
    maxBackoffMs: number | undefined,
  ): number {
    if (failureCount <= 0) {
      return everyMs;
    }
    const cap = maxBackoffMs ?? everyMs * 8;
    return Math.min(everyMs * 2 ** failureCount, cap);
  }

  function scheduleJob(
    sourceId: string,
    datasetKey: string,
    retryAfterMs?: number,
  ): void {
    const key = jobKey(sourceId, datasetKey);
    const existingTimer = timers.get(key);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const source = deps.registry.getSource(sourceId);
    if (source === undefined) {
      return;
    }
    const dataset = source.datasets[datasetKey];
    if (dataset === undefined) {
      return;
    }

    const failureCount = failures.get(key) ?? 0;
    const baseDelay = computeBackoffMs(
      dataset.refresh.everyMs,
      failureCount,
      dataset.refresh.maxBackoffMs,
    );
    const delayBase =
      retryAfterMs !== undefined
        ? Math.max(baseDelay, retryAfterMs)
        : baseDelay;
    const delay = delayWithJitter(delayBase, deps.random);
    lastScheduledDelay.set(key, delayBase);
    nextFetchAtByJob.set(key, deps.now() + delay);

    const timer = setTimeout(() => {
      void runJob(sourceId, datasetKey);
    }, delay);
    timers.set(key, timer);
  }

  async function runJob(sourceId: string, datasetKey: string): Promise<void> {
    const key = jobKey(sourceId, datasetKey);
    const source = deps.registry.getSource(sourceId);
    if (source === undefined) {
      return;
    }

    let retryAfterMs: number | undefined;
    try {
      const runResult = await deps.runner.run(
        source,
        datasetKey,
        deps.getSourceConfig(sourceId),
      );
      retryAfterMs = runResult?.retryAfterMs;
      const row = await deps.store.get(sourceId, datasetKey);
      if (row?.status === 'ok') {
        failures.set(key, 0);
      } else {
        failures.set(key, (failures.get(key) ?? 0) + 1);
      }
    } catch {
      failures.set(key, (failures.get(key) ?? 0) + 1);
    } finally {
      scheduleJob(sourceId, datasetKey, retryAfterMs);
    }
  }

  async function start(): Promise<void> {
    for (const source of deps.registry.listSources()) {
      if (!deps.enabled(source.id)) {
        continue;
      }
      for (const datasetKey of Object.keys(source.datasets)) {
        const snapshot = await deps.store.get(source.id, datasetKey);
        if (snapshot === undefined) {
          void runJob(source.id, datasetKey);
        } else {
          scheduleJob(source.id, datasetKey);
        }
      }
    }
  }

  function stop(): void {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  function getNextFetchAt(sourceId: string): number | null {
    let min: number | null = null;
    for (const [key, at] of nextFetchAtByJob) {
      if (!key.startsWith(`${sourceId}:`)) {
        continue;
      }
      if (min === null || at < min) {
        min = at;
      }
    }
    return min;
  }

  function getLastScheduledBaseDelay(
    sourceId: string,
    datasetKey: string,
  ): number | undefined {
    return lastScheduledDelay.get(jobKey(sourceId, datasetKey));
  }

  async function refreshSource(sourceId: string): Promise<void> {
    const source = deps.registry.getSource(sourceId);
    if (source === undefined) {
      return;
    }
    await Promise.all(
      Object.keys(source.datasets).map((datasetKey) =>
        deps.runner.run(source, datasetKey, deps.getSourceConfig(sourceId)),
      ),
    );
  }

  return {
    start,
    stop,
    getNextFetchAt,
    refreshSource,
    getLastScheduledBaseDelay,
  };
}
