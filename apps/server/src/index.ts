import { serve } from '@hono/node-server';
import { buildApp } from './bootstrap.js';
import { ConfigError } from './config.js';

const logger = {
  error: (message: string) => {
    console.error(message);
  },
};

try {
  const built = await buildApp(process.env);
  const { app, config, lifecycle } = built;

  await lifecycle.runStartHooks();

  const server = serve({
    fetch: app.fetch,
    port: config.PORT,
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
  lifecycle.listenForSignals();
} catch (error) {
  if (error instanceof ConfigError) {
    logger.error(error.message);
    process.exit(1);
  }
  throw error;
}
