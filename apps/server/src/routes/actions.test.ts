import { actionLog } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createTestStack,
  destroyTestStack,
  tempWebDist,
  testSessionHeaders,
} from '../test-helpers.js';

describe('POST /api/actions/:sourceId/:action', () => {
  it('returns 400 for invalid input without logging', async () => {
    const webDist = await tempWebDist();
    const stack = createTestStack({ WEB_DIST: webDist });
    try {
      const response = await stack.app.request('/api/actions/demo/noop', {
        method: 'POST',
        headers: {
          ...testSessionHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'x'.repeat(101) }),
      });
      expect(response.status).toBe(400);
      const rows = stack.conn.db.select().from(actionLog).all();
      expect(rows).toHaveLength(0);
    } finally {
      destroyTestStack(stack);
    }
  });

  it('runs demo noop and refetches series', async () => {
    const webDist = await tempWebDist();
    const stack = createTestStack({
      WEB_DIST: webDist,
      now: () => new Date('2026-01-01T12:00:00.000Z').getTime(),
    });
    try {
      const response = await stack.app.request('/api/actions/demo/noop', {
        method: 'POST',
        headers: {
          ...testSessionHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'hello' }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });

      const rows = stack.conn.db.select().from(actionLog).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.result).toBe('ok');
      expect(stack.store.get('demo', 'series')?.status).toBe('ok');
    } finally {
      destroyTestStack(stack);
    }
  });

  it('returns 500 and logs error rows for throwing actions', async () => {
    const webDist = await tempWebDist();
    const stack = createTestStack({ WEB_DIST: webDist });
    const source = stack.registry.getSource('demo');
    expect(source).toBeDefined();
    if (source === undefined) {
      return;
    }
    source.actions = {
      ...source.actions,
      boom: {
        input: z.object({}),
        run: async () => {
          throw new Error('boom');
        },
      },
    };

    try {
      const response = await stack.app.request('/api/actions/demo/boom', {
        method: 'POST',
        headers: {
          ...testSessionHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(500);
      const rows = stack.conn.db.select().from(actionLog).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.result).toBe('error:boom');
    } finally {
      destroyTestStack(stack);
    }
  });
});
