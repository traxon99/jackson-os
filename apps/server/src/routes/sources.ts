import type { Registry, SourceAdapter } from '@jos/core';
import { Hono } from 'hono';
import type { SnapshotStore } from '../data/snapshots.js';
import type { Limiter } from '../lib/rate-limit.js';
import type { Scheduler } from '../scheduler/scheduler.js';

export type SourceRoutesDeps = {
  registry: Registry;
  store: SnapshotStore;
  scheduler: Scheduler;
  enabled: (sourceId: string) => boolean;
  refreshLimiter: Limiter;
};

export function createSourcesRoutes(deps: SourceRoutesDeps): Hono {
  const routes = new Hono();

  routes.get('/', async (c) => {
    const items = await Promise.all(
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

    return c.json(items);
  });

  routes.post('/:id/refresh', async (c) => {
    const sourceId = c.req.param('id');
    const source = deps.registry.getSource(sourceId);
    if (source === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const clientKey = c.req.header('x-forwarded-for') ?? 'local';
    const limitKey = `refresh:${sourceId}:${clientKey}`;
    if (!deps.refreshLimiter.take(limitKey)) {
      const retryAfter = deps.refreshLimiter.secondsUntilAvailable(limitKey);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    await deps.scheduler.refreshSource(sourceId);
    return c.body(null, 202);
  });

  return routes;
}
