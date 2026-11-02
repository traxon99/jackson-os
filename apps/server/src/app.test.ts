import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('returns ok: true', async () => {
    const webDist = await mkdtemp(join(tmpdir(), 'jos-health-'));
    await writeFile(join(webDist, 'index.html'), '<!doctype html>');
    const app = createApp({ WEB_DIST: webDist });
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
