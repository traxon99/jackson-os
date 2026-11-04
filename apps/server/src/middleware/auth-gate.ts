import type { Context, MiddlewareHandler } from 'hono';
import type { SessionScope } from '../auth/sessions.js';

export type Session = {
  id: string;
  scope: SessionScope;
};

export type GetSession = (c: Context) => Promise<Session | null>;

export function defaultGetSession(): GetSession {
  return async () => null;
}

export function createGetSession(
  lookup: (token: string) => Promise<Session | null>,
  readToken: (c: Context) => string | undefined,
): GetSession {
  return async (c) => {
    const token = readToken(c);
    if (token === undefined) {
      return null;
    }
    return lookup(token);
  };
}

export function authGate(getSession: GetSession): MiddlewareHandler {
  return async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (
      pathname === '/api/health' ||
      pathname === '/api/cron/tick' ||
      pathname === '/api/auth' ||
      pathname.startsWith('/api/auth/')
    ) {
      await next();
      return;
    }

    const session = await getSession(c);
    if (session === null) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    if (session.scope === 'recovery') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    c.set('session', session);
    await next();
  };
}

declare module 'hono' {
  interface ContextVariableMap {
    session: Session;
  }
}
