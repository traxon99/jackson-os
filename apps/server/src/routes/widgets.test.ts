import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AdapterContext, DemoConfig } from '@jos/core';
import { closeDb } from '@jos/db';
import { describe, expect, it } from 'vitest';
import {
  createTestStack,
  destroyTestStack,
  tempWebDist,
  testSessionHeaders,
} from '../test-helpers.js';

describe('GET /api/widgets/:widgetId', () => {
  it('returns 404 for an unknown widget', async () => {
    const webDist = await tempWebDist();
    const stack = createTestStack({ WEB_DIST: webDist });
    try {
      const response = await stack.app.request('/api/widgets/missing.widget', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(404);
    } finally {
      destroyTestStack(stack);
    }
  });

  it('deduplicates background refresh for stale widgets', async () => {
    const stack = createTestStack({
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

    stack.store.putOk(
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
      destroyTestStack(stack);
    }
  });

  it('serves cached data on a new app instance without fetching', async () => {
    const webDist = await tempWebDist();
    const stack = createTestStack({ WEB_DIST: webDist, now: () => 1000 });
    const dbPath = join(stack.dir, 'app.db');
    const stackDir = stack.dir;
    stack.store.putOk(
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
    closeDb(stack.conn);

    const stack2 = createTestStack({
      WEB_DIST: webDist,
      now: () => 2000,
      dbPath,
    });

    try {
      const response = await stack2.app.request('/api/widgets/demo.clock', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        state: 'ok',
        data: { iso: '2026-01-01T00:00:00.000Z' },
      });
      expect(fetchCount).toBe(0);
    } finally {
      destroyTestStack(stack2);
      rmSync(stackDir, { recursive: true, force: true });
    }
  });
});
