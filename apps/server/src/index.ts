import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { type AppConfig, ConfigError, loadConfig } from './config.js';

let config: AppConfig;
try {
  config = loadConfig(process.env);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const app = createApp();

serve({
  fetch: app.fetch,
  port: config.PORT,
});
