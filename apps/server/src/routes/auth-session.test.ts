import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, openDb, runMigrations } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { Hono } from 'hono';
import { setSessionCookie, SESSION_COOKIE_NAME } from '../auth/cookie.js';
import { createSessionService } from '../auth/sessions.js';
import { readSessionToken } from '../auth/cookie.js';
import { createGetSession } from '../middleware/auth-gate.js';

const testOrigin = 'http://127.0.0.1';

function authHeaders(cookie: string): Record<string, string> {
  return { Cookie: cookie, Origin: testOrigin };
}

function createAuthTestApp() {
  const dir = mkdtempSync(join(tmpdir(), 'jos-auth-session-'));
  const conn = openDb(join(dir, 'test.db'));
  runMigrations(conn.db);
  const sessions = createSessionService(conn.db, () => Date.now());
  const getSession = createGetSession(
    (token) => sessions.lookup(token),
    readSessionToken,
  );

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
    cleanup: () => {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
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
    const { app, sessions, cleanup } = createAuthTestApp();
    try {
      const token = sessions.create({});
      const signedIn = await app.request('/api/auth/me', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      expect(signedIn.status).toBe(200);
      await expect(signedIn.json()).resolves.toEqual({ signedIn: true });

      const signedOut = await app.request('/api/auth/me');
      await expect(signedOut.json()).resolves.toEqual({ signedIn: false });
    } finally {
      cleanup();
    }
  });

  it('rejects API access after sign-out', async () => {
    const { app, sessions, cleanup } = createAuthTestApp();
    try {
      const token = sessions.create({});
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
      cleanup();
    }
  });

  it('sign-out-all revokes other sessions', async () => {
    const { app, sessions, cleanup } = createAuthTestApp();
    try {
      const tokenA = sessions.create({});
      const tokenB = sessions.create({});

      await app.request('/api/auth/signout-all', {
        method: 'POST',
        headers: authHeaders(`${SESSION_COOKIE_NAME}=${tokenA}`),
      });

      const meB = await app.request('/api/auth/me', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tokenB}` },
      });
      await expect(meB.json()).resolves.toEqual({ signedIn: false });
    } finally {
      cleanup();
    }
  });
});
