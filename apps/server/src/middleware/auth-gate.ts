import type { Context, MiddlewareHandler } from 'hono';

export type Session = {
  id: string;
};

export type GetSession = (c: Context) => Promise<Session | null>;

export function defaultGetSession(): GetSession {
  return async () => null;
}

export function authGate(getSession: GetSession): MiddlewareHandler {
  return async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (
      pathname === '/api/health' ||
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

    c.set('session', session);
    await next();
  };
}

declare module 'hono' {
  interface ContextVariableMap {
    session: Session;
  }
}
