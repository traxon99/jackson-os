import type { Hono } from 'hono';
import type { Context } from 'hono';
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from '../auth/cookie.js';
import type { SessionScope, SessionService } from '../auth/sessions.js';
import type { GetSession } from '../middleware/auth-gate.js';

export type AuthSessionDeps = {
  sessions: SessionService;
  getSession: GetSession;
};

export function mountAuthSessionRoutes(api: Hono, deps: AuthSessionDeps): void {
  api.post('/auth/signout', async (c) => {
    const token = readSessionToken(c);
    if (token !== undefined) {
      deps.sessions.revoke(token);
    }
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  api.post('/auth/signout-all', async (c) => {
    const session = await deps.getSession(c);
    if (session === null || session.scope === 'recovery') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    deps.sessions.revokeAll();
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  api.get('/auth/me', async (c) => {
    const session = await deps.getSession(c);
    return c.json({
      signedIn: session !== null && session.scope === 'full',
    });
  });
}

export function startSession(
  sessions: SessionService,
  c: Context,
  userAgent: string | undefined,
  options?: {
    scope?: SessionScope;
    absoluteTtlMs?: number;
    maxAgeSec?: number;
  },
): string {
  const token = sessions.create({
    userAgent,
    scope: options?.scope ?? 'full',
    absoluteTtlMs: options?.absoluteTtlMs,
  });
  setSessionCookie(c, token, { maxAgeSec: options?.maxAgeSec });
  return token;
}
