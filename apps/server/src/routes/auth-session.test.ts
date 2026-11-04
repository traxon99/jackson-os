import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  readSessionToken,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '../auth/cookie.js';
import { createSessionService } from '../auth/sessions.js';
import { createGetSession } from '../middleware/auth-gate.js';
import { createTestConn } from '../test-db.js';

const testOrigin = 'http://127.0.0.1';

function authHeaders(cookie: string): Record<string, string> {
  return { Cookie: cookie, Origin: testOrigin };
}

async function createAuthTestApp() {
  const { conn, cleanup: dbCleanup } = await createTestConn();
  const sessions = createSessionService(conn.db, () => Date.now());
  const getSession = createGetSession(async (token) => {
    const record = await sessions.lookup(token);
    if (record === null) {
      return null;
    }
    return { id: record.id, scope: record.scope };
  }, readSessionToken);

  const webDist = mkdtempSync(join(tmpdir(), 'jos-web-'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html>');

  const app = createApp({
    WEB_DIST: webDist,
    getSession,
    auth: { sessions, getSession },
  });

  return {
    app,
    sessions,
    cleanup: async () => {
      await dbCleanup();
      rmSync(webDist, { recursive: true, force: true });
    },
  };
}

describe('session cookie', () => {
  it('sets __Host-session with required attributes', async () => {
    const app = new Hono();
    app.get('/set', (c) => {
      setSessionCookie(c, 'tok');
      return c.text('ok');
    });

    const response = await app.request('/set');
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=tok`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('secure');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toMatch(/Max-Age=2592000/);
  });
});

describe('auth session routes', () => {
  it('returns signedIn from /api/auth/me', async () => {
    const { app, sessions, cleanup } = await createAuthTestApp();
    try {
      const token = await sessions.create({});
      const signedIn = await app.request('/api/auth/me', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      expect(signedIn.status).toBe(200);
      await expect(signedIn.json()).resolves.toEqual({ signedIn: true });

      const signedOut = await app.request('/api/auth/me');
      await expect(signedOut.json()).resolves.toEqual({ signedIn: false });
    } finally {
      await cleanup();
    }
  });

  it('rejects API access after sign-out', async () => {
    const { app, sessions, cleanup } = await createAuthTestApp();
    try {
      const token = await sessions.create({});
      const cookie = `${SESSION_COOKIE_NAME}=${token}`;

      await app.request('/api/auth/signout', {
        method: 'POST',
        headers: authHeaders(cookie),
      });

      const response = await app.request('/api/secret', {
        headers: { Cookie: cookie },
      });
      expect(response.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it('sign-out-all revokes other sessions', async () => {
    const { app, sessions, cleanup } = await createAuthTestApp();
    try {
      const tokenA = await sessions.create({});
      const tokenB = await sessions.create({});

      await app.request('/api/auth/signout-all', {
        method: 'POST',
        headers: authHeaders(`${SESSION_COOKIE_NAME}=${tokenA}`),
      });

      const meB = await app.request('/api/auth/me', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenB}` },
      });
      await expect(meB.json()).resolves.toEqual({ signedIn: false });
    } finally {
      await cleanup();
    }
  });
});
