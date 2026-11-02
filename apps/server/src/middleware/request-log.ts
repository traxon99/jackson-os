import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';
import { clientIp } from '../lib/client-ip.js';

export type RequestLogConfig = {
  logger: Logger;
  trustCloudflare: boolean;
};

export function requestLogMiddleware(
  config: RequestLogConfig,
): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const ip = clientIp(c, config.trustCloudflare);

    await next();

    const ms = Date.now() - start;
    const status = c.res.status;
    config.logger.info({ method, path, status, ms, ip }, 'request');
  };
}
