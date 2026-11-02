import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

async function tempWebDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jos-auth-gate-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}

describe('auth gate middleware', () => {
  it('returns 401 for protected API routes', async () => {
    const app = createApp({ WEB_DIST: await tempWebDist() });

    const response = await app.request('/api/secret');
    expect(response.status).toBe(401);
  });

  it('allows /api/health without a session', async () => {
    const app = createApp({ WEB_DIST: await tempWebDist() });

    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
