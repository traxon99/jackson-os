import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

async function tempWebDist() {
  const dir = await mkdtemp(join(tmpdir(), 'jos-auth-gate-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}
describe('auth gate middleware', () => {
  it('returns 401 for protected API routes', async () => {
    const app = createApp({ WEB_DIST: await tempWebDist() });
    expect((await app.request('/api/secret')).status).toBe(401);
  });
  it('allows /api/health without a session', async () => {
    const app = createApp({ WEB_DIST: await tempWebDist() });
    const r = await app.request('/api/health');
    expect(r.status).toBe(200);
    await expect(r.json()).resolves.toEqual({ ok: true });
  });
  it('returns 403 for protected routes with a recovery session', async () => {
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      getSession: async () => ({ id: 'r', scope: 'recovery' }),
    });
    expect((await app.request('/api/secret')).status).toBe(403);
  });
});
