import { createRegistry, type SourceAdapter } from '@jos/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSnapshotStore } from '../data/snapshots.js';
import { createLimiter } from '../lib/rate-limit.js';
import { createRunner } from '../scheduler/run-dataset.js';
import { createScheduler } from '../scheduler/scheduler.js';
import { createTestConn } from '../test-db.js';
import {
  createTestStack,
  destroyTestStack,
  tempWebDist,
  testSessionHeaders,
} from '../test-helpers.js';
import { createSourcesRoutes } from './sources.js';

describe('GET /api/sources and POST refresh', () => {
  it('returns the expected status shape', async () => {
    const webDist = await tempWebDist();
    const stack = await createTestStack({ WEB_DIST: webDist, now: () => 5000 });
    await stack.store.putOk('demo', 'clock', { iso: 'x' }, 1000, 9000);
    await stack.scheduler.start();

    try {
      const response = await stack.app.request('/api/sources', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as Array<{
        id: string;
        displayName: string;
        status: string;
        lastFetchAt: string | null;
        nextFetchAt: string | null;
      }>;
      const demo = body.find((item) => item.id === 'demo');
      expect(demo).toMatchObject({
        id: 'demo',
        displayName: 'Demo',
        status: 'ok',
      });
      expect(demo?.lastFetchAt).toEqual(expect.any(String));
      expect(demo?.nextFetchAt).toEqual(expect.any(String));
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('returns 429 on the 4th rapid refresh', async () => {
    const { conn, cleanup } = await createTestConn();
    const registry = createRegistry();
    const source: SourceAdapter = {
      id: 'demo',
      displayName: 'Demo',
      configSchema: z.object({}),
      datasets: {
        main: {
          schema: z.object({ ok: z.boolean() }),
          refresh: { everyMs: 60_000, staleAfterMs: 120_000 },
          fetch: async () => ({ ok: true }),
        },
      },
    };
    registry.registerSource(source);
    const store = createSnapshotStore(conn.db);
    const runner = createRunner({
      store,
      db: conn.db,
      log: { info: () => {}, warn: () => {}, error: () => {} },
      now: () => 0,
      fetchImpl: globalThis.fetch,
    });
    const scheduler = createScheduler({
      registry,
      runner,
      store,
      enabled: () => true,
      random: () => 0.5,
      now: () => 0,
      getSourceConfig: () => ({}),
    });
    const limiter = createLimiter({
      capacity: 3,
      refillPerSec: 1 / 20,
      now: () => 0,
    });
    const app = new Hono();
    app.route(
      '/api/sources',
      createSourcesRoutes({
        registry,
        store,
        scheduler,
        enabled: () => true,
        refreshLimiter: limiter,
      }),
    );

    try {
      for (let i = 0; i < 3; i += 1) {
        const response = await app.request('/api/sources/demo/refresh', {
          method: 'POST',
          headers: { 'X-Forwarded-For': '203.0.113.9' },
        });
        expect(response.status).toBe(202);
      }
      const blocked = await app.request('/api/sources/demo/refresh', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.9' },
      });
      expect(blocked.status).toBe(429);
    } finally {
      scheduler.stop();
      await cleanup();
    }
  });
});
