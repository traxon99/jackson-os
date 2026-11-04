import type { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { buildApp } from '../apps/server/src/bootstrap.js';

let appPromise: Promise<Hono> | undefined;

async function getApp(): Promise<Hono> {
  if (appPromise === undefined) {
    appPromise = buildApp(process.env).then((built) => built.app);
  }
  return appPromise;
}

export default handle(async (req, env) => {
  const app = await getApp();
  return app.fetch(req, env);
});

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};
