import type { Hono } from 'hono';
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from '../auth/cookie.js';
import type { SessionService } from '../auth/sessions.js';
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
    if (session === null) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    deps.sessions.revokeAll();
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  api.get('/auth/me', async (c) => {
    const session = await deps.getSession(c);
    return c.json({ signedIn: session !== null });
  });
}

export function startSession(
  sessions: SessionService,
  c: Parameters<typeof setSessionCookie>[0],
  userAgent: string | undefined,
  scope: 'full' | 'recovery' = 'full',
): string {
  const token = sessions.create({ userAgent, scope });
  setSessionCookie(c, token);
  return token;
}
