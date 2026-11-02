import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createRegistry, registerDemo } from '@jos/core';
import { closeDb, openDb, runMigrations } from '@jos/db';
import { createApp } from './app.js';
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
import { createLifecycle } from './lifecycle.js';
import { createLogger } from './log.js';
import { createRunner } from './scheduler/run-dataset.js';
import { createScheduler } from './scheduler/scheduler.js';

const logger = createLogger({ secrets: SECRET_KEYS });

let config: AppConfig;
try {
  config = loadConfig(process.env);
} catch (error) {
  if (error instanceof ConfigError) {
    logger.error(error.message);
    process.exit(1);
  }
  throw error;
}

logDisabledSources(config, (message) => {
  logger.info(message);
});

const dbPath = join(config.DATA_DIR, 'app.db');
const dbConn = openDb(dbPath);
runMigrations(dbConn.db);

const registry = createRegistry();
registerDemo(registry);

const store = createSnapshotStore(dbConn.db);
const now = () => Date.now();

const runner = createRunner({
  store,
  db: dbConn.db,
  log: logger,
  now,
  fetchImpl: globalThis.fetch,
});

function isSourceEnabled(sourceId: string): boolean {
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

function getSourceConfig(sourceId: string): unknown {
  const source = registry.getSource(sourceId);
  if (source === undefined) {
    return {};
  }
  return source.configSchema.parse({});
}

const scheduler = createScheduler({
  registry,
  runner,
  store,
  enabled: isSourceEnabled,
  random: Math.random,
  now,
  getSourceConfig,
});

scheduler.start();

const app = createApp({ ...config, logger });

const server = serve({
  fetch: app.fetch,
  port: config.PORT,
});

const lifecycle = createLifecycle();
lifecycle.registerStopHook(async () => {
  scheduler.stop();
});
lifecycle.registerStopHook(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
);
lifecycle.registerStopHook(async () => {
  closeDb(dbConn);
});
lifecycle.listenForSignals();
