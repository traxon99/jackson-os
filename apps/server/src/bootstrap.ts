import { createRegistry, registerDemo, registerJim } from '@jos/core';
import { closeDb, openDb, openTestDb, runMigrations } from '@jos/db';
import type { Hono } from 'hono';
import { type AppStack, createApp } from './app.js';
import {
  type AppConfig,
  loadConfig,
  logDisabledSources,
  SECRET_KEYS,
  type SourceName,
  sourceStatus,
} from './config.js';
import { createSnapshotStore } from './data/snapshots.js';
import { createLifecycle, type Lifecycle } from './lifecycle.js';
import { createLogger } from './log.js';
import { createAuthServices } from './routes/mount-auth.js';
import { createRunner } from './scheduler/run-dataset.js';
import { createScheduler } from './scheduler/scheduler.js';
import { sourceConfigs } from './sources.js';

export type BuiltApp = {
  app: Hono;
  stack: AppStack;
  config: AppConfig;
  lifecycle: Lifecycle;
};

function isSourceEnabled(config: AppConfig, sourceId: string): boolean {
  if (sourceId === 'demo') {
    return true;
  }
  const status = sourceStatus(config);
  const map: Record<string, SourceName> = {
    jim: 'jim',
    github: 'github',
    portfolio: 'portfolio',
  };
  const key = map[sourceId];
  if (key === undefined) {
    return false;
  }
  return status[key] === 'enabled';
}

export async function buildApp(
  env: Record<string, string | undefined> = process.env,
): Promise<BuiltApp> {
  const logger = createLogger({ secrets: SECRET_KEYS });
  const config = loadConfig(env);

  logDisabledSources(config, (message) => {
    logger.info(message);
  });

  const dbConn = config.DATABASE_URL.startsWith('pglite:')
    ? await openTestDb()
    : await openDb(config.DATABASE_URL);
  await runMigrations(dbConn);

  const registry = createRegistry();
  registerDemo(registry);
  registerJim(registry);

  const store = createSnapshotStore(dbConn.db);
  const now = () => Date.now();

  const runner = createRunner({
    store,
    db: dbConn.db,
    log: logger,
    now,
    fetchImpl: globalThis.fetch,
  });

  const enabled = (sourceId: string) => isSourceEnabled(config, sourceId);

  function getSourceConfig(sourceId: string): unknown {
    const source = registry.getSource(sourceId);
    if (source === undefined) {
      return {};
    }
    return source.configSchema.parse(sourceConfigs(config)[sourceId] ?? {});
  }

  const scheduler = createScheduler({
    registry,
    runner,
    store,
    enabled,
    random: Math.random,
    now,
    getSourceConfig,
  });

  const stack: AppStack = {
    conn: dbConn,
    registry,
    store,
    runner,
    scheduler,
    enabled,
    getSourceConfig,
    now,
  };

  const auth = createAuthServices(stack);

  const app = createApp({
    ...config,
    logger,
    auth,
    authConfig: {
      RP_ID: config.RP_ID,
      APP_ORIGIN: config.APP_ORIGIN,
      SETUP_TOKEN: config.SETUP_TOKEN,
      TRUST_CLOUDFLARE: config.TRUST_CLOUDFLARE,
    },
    stack,
    cronSecret: config.CRON_SECRET,
  });

  const lifecycle = createLifecycle();

  const useInProcessScheduler = env.DISABLE_SCHEDULER !== 'true';

  if (useInProcessScheduler) {
    lifecycle.registerStartHook(async () => {
      await scheduler.start();
    });
    lifecycle.registerStopHook(async () => {
      scheduler.stop();
    });
  }

  lifecycle.registerStopHook(async () => {
    await closeDb(dbConn);
  });

  return { app, stack, config, lifecycle };
}
