import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, openDb, runMigrations } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { SESSION_COOKIE_NAME } from '../auth/cookie.js';
import { createCredentialsStore } from '../auth/credentials.js';
import { createAuthServices } from './mount-auth.js';

const testOrigin = 'http://127.0.0.1';

function seedCredential(
  credentials: ReturnType<typeof createCredentialsStore>,
  id: string,
  deviceName: string,
) {
  credentials.insert({
    id,
    publicKey: 'pk-test',
    counter: 0,
    transports: 'internal',
    deviceName,
    createdAt: 1000,
    lastUsedAt: 2000,
  });
}

function createPasskeysTestApp() {
  const dir = mkdtempSync(join(tmpdir(), 'jos-passkeys-'));
  const conn = openDb(join(dir, 'test.db'));
  runMigrations(conn.db);
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
  const credentials = createCredentialsStore(conn.db);
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
    credentials,
    cleanup: () => {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
      rmSync(webDist, { recursive: true, force: true });
    },
  };
}

function sessionHeaders(token: string): Record<string, string> {
  return {
    Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    Origin: testOrigin,
  };
}

describe('passkey management API', () => {
  it('GET /api/passkeys omits public_key from each item', async () => {
    const { app, auth, credentials, cleanup } = createPasskeysTestApp();
    try {
      seedCredential(credentials, 'cred-1', 'Laptop');
      const token = auth.sessions.create({});

      const response = await app.request('/api/passkeys', {
        headers: sessionHeaders(token),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>[];
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        id: 'cred-1',
        deviceName: 'Laptop',
        createdAt: 1000,
        lastUsedAt: 2000,
      });
      expect(body[0]).not.toHaveProperty('public_key');
      expect(body[0]).not.toHaveProperty('publicKey');
    } finally {
      cleanup();
    }
  });

  it('DELETE /api/passkeys/:id returns 409 for the last credential', async () => {
    const { app, auth, credentials, cleanup } = createPasskeysTestApp();
    try {
      seedCredential(credentials, 'only-one', 'Phone');
      const token = auth.sessions.create({});

      const response = await app.request('/api/passkeys/only-one', {
        method: 'DELETE',
        headers: sessionHeaders(token),
      });
      expect(response.status).toBe(409);
      expect(credentials.count()).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('PATCH /api/passkeys/:id rejects deviceName longer than 50 characters', async () => {
    const { app, auth, credentials, cleanup } = createPasskeysTestApp();
    try {
      seedCredential(credentials, 'cred-2', 'Tablet');
      const token = auth.sessions.create({});

      const response = await app.request('/api/passkeys/cred-2', {
        method: 'PATCH',
        headers: {
          ...sessionHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceName: 'x'.repeat(51) }),
      });
      expect(response.status).toBe(400);
    } finally {
      cleanup();
    }
  });

  it('DELETE /api/passkeys/:id removes a credential when others remain', async () => {
    const { app, auth, credentials, cleanup } = createPasskeysTestApp();
    try {
      seedCredential(credentials, 'keep-me', 'Desktop');
      seedCredential(credentials, 'remove-me', 'Old phone');
      const token = auth.sessions.create({});

      const response = await app.request('/api/passkeys/remove-me', {
        method: 'DELETE',
        headers: sessionHeaders(token),
      });
      expect(response.status).toBe(204);
      expect(credentials.count()).toBe(1);
      expect(credentials.getById('remove-me')).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
