import { Hono } from 'hono';
import type { AppConfig } from './config.js';
import { securityHeadersMiddleware } from './middleware/headers.js';
import { originCheck } from './middleware/origin.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { mountStatic } from './static.js';

export type CreateAppConfig = Pick<AppConfig, 'WEB_DIST'> &
  Partial<Pick<AppConfig, 'APP_ORIGIN' | 'TRUST_CLOUDFLARE'>>;

function resolveCreateAppConfig(
  config: CreateAppConfig,
): Pick<AppConfig, 'WEB_DIST' | 'APP_ORIGIN' | 'TRUST_CLOUDFLARE'> {
  return {
    WEB_DIST: config.WEB_DIST,
    APP_ORIGIN: config.APP_ORIGIN ?? 'http://127.0.0.1',
    TRUST_CLOUDFLARE: config.TRUST_CLOUDFLARE ?? false,
  };
}

export function createApp(config: CreateAppConfig) {
  const resolved = resolveCreateAppConfig(config);
  const app = new Hono();
  app.use(securityHeadersMiddleware());
  app.use(originCheck(resolved.APP_ORIGIN));

  const api = new Hono();
  api.use(
    '*',
    rateLimitMiddleware({ trustCloudflare: resolved.TRUST_CLOUDFLARE }),
  );
  api.get('/health', (c) => c.json({ ok: true }));
  api.all('/auth/*', (c) => c.json({ error: 'Not Found' }, 404));
  api.all('*', (c) => c.json({ error: 'Not Found' }, 404));
  app.route('/api', api);

  mountStatic(app, resolved.WEB_DIST);

  return app;
}
