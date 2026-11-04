import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { agentAuthMiddleware } from './middleware.js';

describe('agentAuthMiddleware', () => {
  it('returns 404 when token is not configured', async () => {
    const app = new Hono();
    app.use('*', agentAuthMiddleware(undefined));
    app.get('/x', (c) => c.text('ok'));

    const res = await app.request('/x');
    expect(res.status).toBe(404);
  });

  it('returns 401 for missing or wrong bearer token', async () => {
    const token = 'a'.repeat(32);
    const app = new Hono();
    app.use('*', agentAuthMiddleware(token));
    app.get('/x', (c) => c.text('ok'));

    expect((await app.request('/x')).status).toBe(401);
    expect(
      (
        await app.request('/x', {
          headers: { Authorization: 'Bearer wrong-token' },
        })
      ).status,
    ).toBe(401);
  });

  it('allows a matching bearer token', async () => {
    const token = 'b'.repeat(32);
    const app = new Hono();
    app.use('*', agentAuthMiddleware(token));
    app.get('/x', (c) => c.text('ok'));

    const res = await app.request('/x', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
