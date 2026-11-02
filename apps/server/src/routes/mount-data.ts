import type { Hono } from 'hono';
import type { AppStack } from '../app.js';
import { createLimiter } from '../lib/rate-limit.js';
import { createActionsRoutes } from './actions.js';
import { createSourcesRoutes } from './sources.js';
import { createWidgetsRoutes } from './widgets.js';

export function mountDataRoutes(api: Hono, stack: AppStack): void {
  const refreshLimiter = createLimiter({
    capacity: 3,
    refillPerSec: 1 / 20,
    now: stack.now,
  });

  api.route(
    '/widgets',
    createWidgetsRoutes({
      registry: stack.registry,
      store: stack.store,
      runner: stack.runner,
      enabled: stack.enabled,
      getSourceConfig: stack.getSourceConfig,
      now: stack.now,
    }),
  );

  api.route(
    '/sources',
    createSourcesRoutes({
      registry: stack.registry,
      store: stack.store,
      scheduler: stack.scheduler,
      enabled: stack.enabled,
      refreshLimiter,
    }),
  );

  api.route(
    '/actions',
    createActionsRoutes({
      registry: stack.registry,
      db: stack.conn.db,
      runner: stack.runner,
      enabled: stack.enabled,
      getSourceConfig: stack.getSourceConfig,
      now: stack.now,
    }),
  );
}
