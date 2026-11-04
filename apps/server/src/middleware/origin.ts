import type { MiddlewareHandler } from 'hono';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck(appOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const pathname = new URL(c.req.url).pathname;
    if (pathname === '/api/agent' || pathname.startsWith('/api/agent/')) {
      await next();
      return;
    }

    const origin = c.req.header('Origin');
    if (origin === undefined || origin !== appOrigin) {
      return c.body(null, 403);
    }

    await next();
  };
}
