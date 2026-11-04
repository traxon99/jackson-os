import type { AdapterContext, DemoConfig } from '@jos/core';
import { registerJim } from '@jos/core';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  createTestStack,
  destroyTestStack,
  tempWebDist,
  testSessionHeaders,
} from '../test-helpers.js';

describe('GET /api/widgets/:widgetId', () => {
  it('returns 404 for an unknown widget', async () => {
    const webDist = await tempWebDist();
    const stack = await createTestStack({ WEB_DIST: webDist });
    try {
      const response = await stack.app.request('/api/widgets/missing.widget', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(404);
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('deduplicates background refresh for stale widgets', async () => {
    const stack = await createTestStack({
      now: () => 10_000,
    });

    const source = stack.registry.getSource('demo');
    const clock = source?.datasets.clock;
    if (clock === undefined) {
      throw new Error('expected demo clock dataset');
    }
    let fetchCount = 0;
    const originalFetch = clock.fetch;
    clock.fetch = async (ctx: AdapterContext<DemoConfig>) => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return originalFetch(ctx);
    };

    await stack.store.putOk(
      'demo',
      'clock',
      { iso: '2026-01-01T00:00:00.000Z' },
      1000,
      5000,
    );

    try {
      const [a, b] = await Promise.all([
        stack.app.request('/api/widgets/demo.clock', {
          headers: testSessionHeaders,
        }),
        stack.app.request('/api/widgets/demo.clock', {
          headers: testSessionHeaders,
        }),
      ]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fetchCount).toBe(1);
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('returns disabled when the source is off', async () => {
    const webDist = await tempWebDist();
    const stack = await createTestStack({
      WEB_DIST: webDist,
      setupRegistry: registerJim,
      enabled: (sourceId) => sourceId === 'demo',
    });
    try {
      const response = await stack.app.request('/api/widgets/jim.status', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ state: 'disabled' });
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('serves cached data on a new app instance without fetching', async () => {
    const webDist = await tempWebDist();
    const stack = await createTestStack({ WEB_DIST: webDist, now: () => 1000 });
    await stack.store.putOk(
      'demo',
      'clock',
      { iso: '2026-01-01T00:00:00.000Z' },
      1000,
      500_000,
    );

    let fetchCount = 0;
    const originalRun = stack.runner.run.bind(stack.runner);
    stack.runner.run = async (...args) => {
      fetchCount += 1;
      return originalRun(...args);
    };

    stack.scheduler.stop();

    const app2 = createApp({
      WEB_DIST: webDist,
      getSession: async () => ({ id: 'test-session', scope: 'full' as const }),
      stack: {
        conn: stack.conn,
        registry: stack.registry,
        store: stack.store,
        runner: stack.runner,
        scheduler: stack.scheduler,
        enabled: (sourceId) => sourceId === 'demo',
        getSourceConfig: () => ({}),
        now: () => 2000,
      },
    });

    try {
      const response = await app2.request('/api/widgets/demo.clock', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        state: 'ok',
        data: { iso: '2026-01-01T00:00:00.000Z' },
      });
      expect(fetchCount).toBe(0);
    } finally {
      await destroyTestStack(stack);
    }
  });
});
