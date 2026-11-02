import { Hono } from 'hono';
import type { AppConfig } from './config.js';
import { securityHeadersMiddleware } from './middleware/headers.js';
import { mountStatic } from './static.js';

export function createApp(config: Pick<AppConfig, 'WEB_DIST'>) {
  const app = new Hono();
  app.use(securityHeadersMiddleware());

  const api = new Hono();
  api.get('/health', (c) => c.json({ ok: true }));
  api.all('*', (c) => c.json({ error: 'Not Found' }, 404));
  app.route('/api', api);

  mountStatic(app, config.WEB_DIST);

  return app;
}
