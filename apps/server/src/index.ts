import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { openDb, runMigrations } from '@jos/db';
import { createApp } from './app.js';
import {
  type AppConfig,
  ConfigError,
  loadConfig,
  logDisabledSources,
  SECRET_KEYS,
} from './config.js';
import { createLogger } from './log.js';

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

const app = createApp(config);

serve({
  fetch: app.fetch,
  port: config.PORT,
});
