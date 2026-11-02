import type { MiddlewareHandler } from 'hono';
import { clientIp } from '../lib/client-ip.js';
import { createLimiter } from '../lib/rate-limit.js';

export type RateLimitConfig = {
  trustCloudflare: boolean;
};

export function rateLimitMiddleware(
  config: RateLimitConfig,
): MiddlewareHandler {
  const authLimiter = createLimiter({
    capacity: 10,
    refillPerSec: 1 / 30,
    now: () => Date.now(),
  });
  const apiLimiter = createLimiter({
    capacity: 120,
    refillPerSec: 2,
    now: () => Date.now(),
  });

  return async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    const isAuth =
      pathname === '/api/auth' || pathname.startsWith('/api/auth/');
    const limiter = isAuth ? authLimiter : apiLimiter;
    const key = clientIp(c, config.trustCloudflare);

    if (!limiter.take(key)) {
      const retryAfter = limiter.secondsUntilAvailable(key);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    await next();
  };
}
