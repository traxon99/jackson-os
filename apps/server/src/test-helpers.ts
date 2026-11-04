import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRegistry, type Registry, registerDemo } from '@jos/core';
import type { TestDbConnection } from '@jos/db/test';
import { closeTestDb, openTestDb, runTestMigrations } from '@jos/db/test';
import type { Hono } from 'hono';
import { type CreateAppConfig, createApp } from './app.js';
import { createSnapshotStore, type SnapshotStore } from './data/snapshots.js';
import { createRunner, type DatasetRunner } from './scheduler/run-dataset.js';
import { createScheduler, type Scheduler } from './scheduler/scheduler.js';

const stubLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export type TestStack = {
  app: Hono;
  conn: TestDbConnection;
  dir: string;
  store: SnapshotStore;
  runner: DatasetRunner;
  scheduler: Scheduler;
  registry: Registry;
  now: () => number;
};

export async function createTestStack(
  config: Partial<CreateAppConfig> & {
    now?: () => number;
    setupRegistry?: (registry: Registry) => void;
    enabled?: (sourceId: string) => boolean;
  } = {},
): Promise<TestStack> {
  const dir = mkdtempSync(join(tmpdir(), 'jos-stack-'));
  const conn = await openTestDb();
  await runTestMigrations(conn);

  const registry = createRegistry();
  registerDemo(registry);
  config.setupRegistry?.(registry);

  const store = createSnapshotStore(conn.db);
  const now = config.now ?? (() => Date.now());
  const enabled = config.enabled ?? ((sourceId) => sourceId === 'demo');

  const runner = createRunner({
    store,
    db: conn.db,
    log: stubLog,
    now,
    fetchImpl: globalThis.fetch,
  });

  const scheduler = createScheduler({
    registry,
    runner,
    store,
    enabled,
    random: () => 0.5,
    now,
    getSourceConfig: () => ({}),
  });

  const webDist =
    config.WEB_DIST ?? mkdtempSync(join(tmpdir(), 'jos-webdist-'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html>');

  const app = createApp({
    ...config,
    WEB_DIST: webDist,
    getSession: async () => ({ id: 'test-session', scope: 'full' as const }),
    stack: {
      conn,
      registry,
      store,
      runner,
      scheduler,
      enabled,
      getSourceConfig: () => ({}),
      now,
    },
  });

  return { app, conn, dir, store, runner, scheduler, registry, now };
}

export async function destroyTestStack(stack: TestStack): Promise<void> {
  stack.scheduler.stop();
  await closeTestDb(stack.conn);
  rmSync(stack.dir, { recursive: true, force: true });
}

export async function tempWebDist(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'jos-webdist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}

export const testSessionHeaders = {
  'X-Forwarded-For': '203.0.113.1',
  Origin: 'http://127.0.0.1',
};
