import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { EXPECTED_SECURITY_HEADERS } from './headers.js';

async function createTempDist(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jos-headers-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  await mkdir(join(dir, 'assets'), { recursive: true });
  return dir;
}

function assertSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

describe('security headers middleware', () => {
  it('sets every required header on /api/health and /', async () => {
    const webDist = await createTempDist();
    const app = createApp({ WEB_DIST: webDist });

    for (const path of ['/api/health', '/']) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      assertSecurityHeaders(response);
    }
  });
});
