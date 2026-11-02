import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

async function createTempDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jos-web-dist-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html><title>app</title>');
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'assets', 'x.js'), 'console.log("x")');
  return dir;
}

describe('static file serving', () => {
  let webDist: string | undefined;

  afterEach(async () => {
    webDist = undefined;
  });

  it('serves index.html for / and SPA routes', async () => {
    webDist = await createTempDist();
    const app = createApp({ WEB_DIST: webDist });

    for (const path of ['/', '/settings']) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      await expect(response.text()).resolves.toContain('<title>app</title>');
    }
  });

  it('returns JSON 404 for unknown /api routes', async () => {
    webDist = await createTempDist();
    const app = createApp({ WEB_DIST: webDist });

    const response = await app.request('/api/nope');
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('serves files under the dist root', async () => {
    webDist = await createTempDist();
    const app = createApp({ WEB_DIST: webDist });

    const response = await app.request('/assets/x.js');
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('console.log("x")');
  });
});
