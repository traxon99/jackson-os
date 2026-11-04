import type { Registry } from '@jos/core';
import { Hono } from 'hono';
import type { SnapshotStore } from '../data/snapshots.js';
import type { DatasetRunner } from '../scheduler/run-dataset.js';

export type WidgetRoutesDeps = {
  registry: Registry;
  store: SnapshotStore;
  runner: DatasetRunner;
  enabled: (sourceId: string) => boolean;
  getSourceConfig: (sourceId: string) => unknown;
  now: () => number;
};

export function createWidgetsRoutes(deps: WidgetRoutesDeps): Hono {
  const routes = new Hono();

  routes.get('/:widgetId', async (c) => {
    const widgetId = c.req.param('widgetId');
    const widget = deps.registry.getWidget(widgetId);
    if (widget === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }

    if (!deps.enabled(widget.source)) {
      return c.json({ state: 'disabled' });
    }

    const source = deps.registry.getSource(widget.source);
    if (source === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const row = await deps.store.get(widget.source, widget.dataset);
    const payload = deps.store.toWidgetPayload(row, deps.now());

    if (payload === undefined) {
      await deps.runner.run(
        source,
        widget.dataset,
        deps.getSourceConfig(widget.source),
      );
      const after = await deps.store.get(widget.source, widget.dataset);
      const fresh = deps.store.toWidgetPayload(after, deps.now());
      return c.json(fresh ?? { state: 'error', error: 'fetch failed' });
    }

    if (payload.state === 'ok' && payload.stale) {
      void deps.runner.run(
        source,
        widget.dataset,
        deps.getSourceConfig(widget.source),
      );
    }

    return c.json(payload);
  });

  return routes;
}
