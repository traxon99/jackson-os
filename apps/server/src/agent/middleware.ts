import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

function bearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1];
}

function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function agentAuthMiddleware(
  agentApiToken: string | undefined,
): MiddlewareHandler {
  return async (c, next) => {
    if (agentApiToken === undefined || agentApiToken === '') {
      return c.json({ error: 'Not Found' }, 404);
    }

    const token = bearerToken(c.req.header('authorization'));
    if (token === undefined || !tokensMatch(agentApiToken, token)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}
