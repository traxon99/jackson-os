import type { Registry, SourceAdapter } from '@jos/core';
import type { Scheduler } from '../scheduler/scheduler.js';
import type { SnapshotStore } from './snapshots.js';

export type SourceStatusItem = {
  id: string;
  displayName: string;
  status: 'disabled' | 'ok' | 'error';
  lastFetchAt: string | null;
  nextFetchAt: string | null;
};

export type SourceStatusDeps = {
  registry: Registry;
  store: SnapshotStore;
  scheduler: Scheduler;
  enabled: (sourceId: string) => boolean;
};

export async function listSourceStatuses(
  deps: SourceStatusDeps,
): Promise<SourceStatusItem[]> {
  return Promise.all(
    deps.registry.listSources().map(async (source: SourceAdapter) => {
      if (!deps.enabled(source.id)) {
        return {
          id: source.id,
          displayName: source.displayName,
          status: 'disabled' as const,
          lastFetchAt: null,
          nextFetchAt: null,
        };
      }

      let status: 'ok' | 'error' = 'ok';
      let lastFetchAt: number | null = null;

      for (const datasetKey of Object.keys(source.datasets)) {
        const row = await deps.store.get(source.id, datasetKey);
        if (row === undefined) {
          continue;
        }
        if (row.status === 'error') {
          status = 'error';
        }
        if (lastFetchAt === null || row.fetchedAt > lastFetchAt) {
          lastFetchAt = row.fetchedAt;
        }
      }

      return {
        id: source.id,
        displayName: source.displayName,
        status,
        lastFetchAt:
          lastFetchAt === null ? null : new Date(lastFetchAt).toISOString(),
        nextFetchAt: (() => {
          const next = deps.scheduler.getNextFetchAt(source.id);
          return next === null ? null : new Date(next).toISOString();
        })(),
      };
    }),
  );
}
