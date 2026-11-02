import { describe, expect, it } from 'vitest';
import {
  createTestStack,
  destroyTestStack,
  testSessionHeaders,
} from '../test-helpers.js';

describe('GET/PUT /api/layout', () => {
  it('round-trips a saved layout', async () => {
    const stack = createTestStack();
    const items = [
      { i: 'demo.series', x: 0, y: 0, w: 6, h: 3 },
      { i: 'demo.clock', x: 6, y: 0, w: 3, h: 2 },
    ];

    try {
      const putResponse = await stack.app.request('/api/layout', {
        method: 'PUT',
        headers: {
          ...testSessionHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
      expect(putResponse.status).toBe(200);

      const getResponse = await stack.app.request('/api/layout', {
        headers: testSessionHeaders,
      });
      expect(getResponse.status).toBe(200);
      await expect(getResponse.json()).resolves.toEqual({
        id: 'default',
        items,
      });
    } finally {
      destroyTestStack(stack);
    }
  });

  it('returns 400 for an unknown widget id', async () => {
    const stack = createTestStack();
    try {
      const response = await stack.app.request('/api/layout', {
        method: 'PUT',
        headers: {
          ...testSessionHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ i: 'missing.widget', x: 0, y: 0, w: 2, h: 2 }],
        }),
      });
      expect(response.status).toBe(400);
    } finally {
      destroyTestStack(stack);
    }
  });

  it('returns 400 when size is below min', async () => {
    const stack = createTestStack();
    try {
      const response = await stack.app.request('/api/layout', {
        method: 'PUT',
        headers: {
          ...testSessionHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ i: 'demo.clock', x: 0, y: 0, w: 1, h: 1 }],
        }),
      });
      expect(response.status).toBe(400);
    } finally {
      destroyTestStack(stack);
    }
  });

  it('returns generated default layout when none is saved', async () => {
    const stack = createTestStack();
    try {
      const response = await stack.app.request('/api/layout', {
        headers: testSessionHeaders,
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { items: Array<{ i: string }> };
      expect(body.items.map((item) => item.i)).toEqual([
        'demo.clock',
        'demo.series',
      ]);
    } finally {
      destroyTestStack(stack);
    }
  });
});
