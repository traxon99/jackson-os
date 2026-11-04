import { randomUUID } from 'node:crypto';
import type { Registry } from '@jos/core';
import type { JosDatabase } from '@jos/db';
import { Hono } from 'hono';
import { insertActionLog } from '../data/action-log.js';
import type { DatasetRunner } from '../scheduler/run-dataset.js';

export type ActionRoutesDeps = {
  registry: Registry;
  db: JosDatabase;
  runner: DatasetRunner;
  enabled: (sourceId: string) => boolean;
  getSourceConfig: (sourceId: string) => unknown;
  now: () => number;
};

export function createActionsRoutes(deps: ActionRoutesDeps): Hono {
  const routes = new Hono();

  routes.post('/:sourceId/:action', async (c) => {
    const sourceId = c.req.param('sourceId');
    const actionName = c.req.param('action');

    const source = deps.registry.getSource(sourceId);
    if (source === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const action = source.actions?.[actionName];
    if (action === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = undefined;
    }

    const parsed = action.input.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', issues: parsed.error.issues }, 400);
    }

    if (!deps.enabled(sourceId)) {
      return c.json({ state: 'disabled' });
    }

    const ctx = {
      config: deps.getSourceConfig(sourceId),
      fetch: globalThis.fetch,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      now: () => new Date(deps.now()),
      signal: new AbortController().signal,
    };

    try {
      const result = await action.run(ctx, parsed.data);
      await insertActionLog(deps.db, {
        id: randomUUID(),
        widgetId: sourceId,
        action: actionName,
        params: parsed.data,
        result: 'ok',
        createdAt: deps.now(),
      });

      for (const datasetKey of action.invalidates ?? []) {
        await deps.runner.run(
          source,
          datasetKey,
          deps.getSourceConfig(sourceId),
        );
      }

      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'action failed';
      await insertActionLog(deps.db, {
        id: randomUUID(),
        widgetId: sourceId,
        action: actionName,
        params: parsed.data,
        result: `error:${message}`,
        createdAt: deps.now(),
      });
      return c.json({ error: message }, 500);
    }
  });

  return routes;
}
