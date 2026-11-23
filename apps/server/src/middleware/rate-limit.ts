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

  // HLS players fetch a playlist and a segment about every second per
  // camera, which the general API bucket would throttle. Stream requests
  // get their own, larger bucket; they still go through the session gate.
  const streamLimiter = createLimiter({
    capacity: 300,
    refillPerSec: 20,
    now: () => Date.now(),
  });

  return async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    const isAuth =
      pathname === '/api/auth' || pathname.startsWith('/api/auth/');
    const isStream =
      pathname.startsWith('/api/cameras/') && pathname.includes('/hls/');
    const limiter = isAuth
      ? authLimiter
      : isStream
        ? streamLimiter
        : apiLimiter;
    const key = clientIp(c, config.trustCloudflare);

    if (!limiter.take(key)) {
      const retryAfter = limiter.secondsUntilAvailable(key);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    await next();
  };
}
