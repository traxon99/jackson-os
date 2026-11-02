import type { Registry } from '@jos/core';
import type { DbConnection } from '@jos/db';
import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { AppConfig } from './config.js';
import type { SnapshotStore } from './data/snapshots.js';
import {
  authGate,
  defaultGetSession,
  type GetSession,
} from './middleware/auth-gate.js';
import { securityHeadersMiddleware } from './middleware/headers.js';
import { originCheck } from './middleware/origin.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { requestLogMiddleware } from './middleware/request-log.js';
import { mountDataRoutes } from './routes/mount-data.js';
import type { DatasetRunner } from './scheduler/run-dataset.js';
import type { Scheduler } from './scheduler/scheduler.js';
import { mountStatic } from './static.js';

export type AppStack = {
  conn: DbConnection;
  registry: Registry;
  store: SnapshotStore;
  runner: DatasetRunner;
  scheduler: Scheduler;
  enabled: (sourceId: string) => boolean;
  getSourceConfig: (sourceId: string) => unknown;
  now: () => number;
};

export type CreateAppConfig = Pick<AppConfig, 'WEB_DIST'> &
  Partial<Pick<AppConfig, 'APP_ORIGIN' | 'TRUST_CLOUDFLARE'>> & {
    logger?: Logger;
    getSession?: GetSession;
    stack?: AppStack;
  };

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
  if (config.logger !== undefined) {
    app.use(
      requestLogMiddleware({
        logger: config.logger,
        trustCloudflare: resolved.TRUST_CLOUDFLARE,
      }),
    );
  }
  app.use(securityHeadersMiddleware());
  app.use(originCheck(resolved.APP_ORIGIN));

  const getSession = config.getSession ?? defaultGetSession();

  const api = new Hono();
  api.use(
    '*',
    rateLimitMiddleware({ trustCloudflare: resolved.TRUST_CLOUDFLARE }),
  );
  api.use('*', authGate(getSession));
  api.get('/health', (c) => c.json({ ok: true }));
  api.get('/secret', (c) => c.json({ secret: true }));
  api.all('/auth/*', (c) => c.json({ error: 'Not Found' }, 404));

  if (config.stack !== undefined) {
    mountDataRoutes(api, config.stack);
  } else {
    api.all('*', (c) => c.json({ error: 'Not Found' }, 404));
  }

  app.route('/api', api);

  mountStatic(app, resolved.WEB_DIST);

  return app;
}
