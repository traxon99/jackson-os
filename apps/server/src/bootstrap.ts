import { createRegistry, registerDemo, registerJim } from '@jos/core';
import { closeDb, openDb, runMigrations } from '@jos/db';
import type { Hono } from 'hono';
import { type AppStack, createApp } from './app.js';
import {
  type AppConfig,
  ConfigError,
  loadConfig,
  logDisabledSources,
  SECRET_KEYS,
  type SourceName,
  sourceStatus,
} from './config.js';
import { createSnapshotStore } from './data/snapshots.js';
import { createLifecycle, type Lifecycle } from './lifecycle.js';
import { createLogger } from './log.js';
import { type CamerasConfig, parseCameras } from './routes/cameras.js';
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

function camerasConfig(
  config: AppConfig,
  warn: (message: string) => void,
): CamerasConfig | undefined {
  let list: ReturnType<typeof parseCameras>;
  try {
    list = parseCameras(config.CAMERAS);
  } catch (error) {
    throw new ConfigError(error instanceof Error ? error.message : 'CAMERAS');
  }
  if (list.length === 0) {
    return undefined;
  }
  if (config.MEDIAMTX_HLS_URL === undefined) {
    warn('CAMERAS is set but MEDIAMTX_HLS_URL is not; cameras disabled');
    return undefined;
  }
  return {
    cameras: list,
    hlsUrl: config.MEDIAMTX_HLS_URL,
    apiUrl: config.MEDIAMTX_API_URL,
  };
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
    ? await (async () => {
        const { openTestDb, runTestMigrations } = await import('@jos/db/test');
        const testConn = await openTestDb();
        await runTestMigrations(testConn);
        return testConn;
      })()
    : await (async () => {
        const conn = await openDb(config.DATABASE_URL);
        await runMigrations(conn);
        return conn;
      })();

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
  const cameras = camerasConfig(config, (message) => logger.warn(message));

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
    cameras,
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
    if (dbConn.kind === 'pglite') {
      const { closeTestDb } = await import('@jos/db/test');
      await closeTestDb(dbConn);
      return;
    }
    await closeDb(dbConn);
  });

  return { app, stack, config, lifecycle };
}
