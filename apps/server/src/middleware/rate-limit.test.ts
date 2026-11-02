import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { clientIp } from '../lib/client-ip.js';

const APP_ORIGIN = 'https://app.example.com';

async function tempWebDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jos-rate-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}

describe('rate limit middleware', () => {
  it('returns 429 on the 11th rapid auth request', async () => {
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      APP_ORIGIN,
    });

    for (let i = 0; i < 10; i += 1) {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { Origin: APP_ORIGIN },
      });
      expect(response.status).not.toBe(429);
    }

    const blocked = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { Origin: APP_ORIGIN },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('ignores spoofed CF-Connecting-IP when TRUST_CLOUDFLARE is false', async () => {
    const app = new Hono();
    app.get('/ip', (c) => c.json({ ip: clientIp(c, false) }));

    const first = await app.request('/ip', {
      headers: { 'CF-Connecting-IP': '203.0.113.1' },
    });
    const second = await app.request('/ip', {
      headers: { 'CF-Connecting-IP': '203.0.113.99' },
    });

    await expect(first.json()).resolves.toEqual(await second.json());
  });
});
