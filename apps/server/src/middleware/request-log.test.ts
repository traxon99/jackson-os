import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createLogger } from '../log.js';

async function tempWebDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jos-reqlog-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}

describe('request log middleware', () => {
  it('logs method, path, status, ms, and ip without cookies or body', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger({ secrets: [], destination: stream });
    const app = createApp({
      WEB_DIST: await tempWebDist(),
      APP_ORIGIN: 'https://app.example.com',
      logger,
    });

    const cookie = 'session=super-secret-session-value';
    const body = JSON.stringify({ password: 'hunter2' });

    const response = await app.request('/api/auth/login?token=leak', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: 'https://app.example.com',
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(response.status).not.toBe(500);

    const output = chunks.join('');
    expect(output).toContain('"method":"POST"');
    expect(output).toContain('"path":"/api/auth/login"');
    expect(output).not.toContain('token=leak');
    expect(output).not.toContain('super-secret-session-value');
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('Cookie');
    expect(output).not.toMatch(/"status":500/);
    expect(output).toMatch(/"status":\d+/);
    expect(output).toMatch(/"ms":\d+/);
    expect(output).toMatch(/"ip":/);
  });
});
