import type { Hono } from 'hono';
import type { AppStack } from '../app.js';
import { createWidgetsRoutes } from './widgets.js';

export function mountDataRoutes(api: Hono, stack: AppStack): void {
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
}
