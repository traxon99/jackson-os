import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const APP_ORIGIN = 'https://app.example.com';

async function tempWebDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jos-origin-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}

describe('origin check middleware', () => {
  it('allows same-origin POST', async () => {
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      APP_ORIGIN,
    });

    const response = await app.request('/api/nope', {
      method: 'POST',
      headers: { Origin: APP_ORIGIN },
    });

    expect(response.status).toBe(401);
  });

  it('returns 403 for cross-origin POST', async () => {
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      APP_ORIGIN,
    });

    const response = await app.request('/api/nope', {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com' },
    });

    expect(response.status).toBe(403);
  });

  it('returns 403 for POST with no Origin header', async () => {
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      APP_ORIGIN,
    });

    const response = await app.request('/api/nope', { method: 'POST' });

    expect(response.status).toBe(403);
  });

  it('allows cross-origin GET without Origin', async () => {
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      APP_ORIGIN,
    });

    const response = await app.request('/api/health', {
      headers: { Origin: 'https://evil.example.com' },
    });

    expect(response.status).toBe(200);
  });
});
