import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { SESSION_COOKIE_NAME } from '../auth/cookie.js';
import { createTestConn } from '../test-db.js';
import { createAuthServices } from './mount-auth.js';

const testOrigin = 'http://127.0.0.1';

async function createRecoveryCodesTestApp() {
  const { conn, cleanup: dbCleanup } = await createTestConn();
  const webDist = mkdtempSync(join(tmpdir(), 'jos-web-'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html>');
  const now = () => 1_000_000;
  const stack = {
    conn,
    registry: { getSource: () => undefined } as never,
    store: {} as never,
    runner: {} as never,
    scheduler: { stop: () => {} } as never,
    enabled: () => false,
    getSourceConfig: () => ({}),
    now,
  };
  const auth = createAuthServices(stack);
  const app = createApp({
    WEB_DIST: webDist,
    APP_ORIGIN: testOrigin,
    auth,
    authConfig: {
      RP_ID: 'localhost',
      APP_ORIGIN: testOrigin,
      SETUP_TOKEN: '01234567890123456789012345678901',
      TRUST_CLOUDFLARE: false,
    },
    stack,
  });

  return {
    app,
    auth,
    cleanup: async () => {
      await dbCleanup();
      rmSync(webDist, { recursive: true, force: true });
    },
  };
}

describe('POST /api/recovery-codes/regenerate', () => {
  it('requires a full session', async () => {
    const { app, cleanup } = await createRecoveryCodesTestApp();
    try {
      const response = await app.request('/api/recovery-codes/regenerate', {
        method: 'POST',
        headers: { Origin: testOrigin },
      });
      expect(response.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it('returns new codes for a full session', async () => {
    const { app, auth, cleanup } = await createRecoveryCodesTestApp();
    try {
      const token = await auth.sessions.create({ scope: 'full' });
      const response = await app.request('/api/recovery-codes/regenerate', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { recoveryCodes?: string[] };
      expect(body.recoveryCodes).toHaveLength(10);
    } finally {
      await cleanup();
    }
  });
});
