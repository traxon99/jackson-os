import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SourceAdapter } from '@jos/core';
import { closeDb, openDb, runMigrations } from '@jos/db';
import { describe, expect, it, vi } from 'vitest';
import { createSnapshotStore } from '../data/snapshots.js';
import { createRunner } from './run-dataset.js';

const stubLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function testDb() {
  const dir = mkdtempSync(join(tmpdir(), 'jos-runner-'));
  const dbPath = join(dir, 'test.db');
  const conn = openDb(dbPath);
  runMigrations(conn.db);
  return { conn, dir, store: createSnapshotStore(conn.db) };
}

describe('createRunner', () => {
  it('deduplicates concurrent runs for the same source:dataset', async () => {
    const { conn, dir, store } = testDb();
    let fetchCount = 0;
    const source: SourceAdapter = {
      id: 'demo',
      displayName: 'Demo',
      configSchema: { parse: () => ({}) } as never,
      datasets: {
        main: {
          schema: { parse: (v: unknown) => v } as never,
          refresh: { everyMs: 1000, staleAfterMs: 2000 },
          fetch: async () => {
            fetchCount += 1;
            await new Promise((resolve) => setTimeout(resolve, 20));
            return { ok: true };
          },
        },
      },
    };

    const runner = createRunner({
      store,
      db: conn.db,
      log: stubLog,
      now: () => Date.now(),
      fetchImpl: globalThis.fetch,
    });

    try {
      await Promise.all([
        runner.run(source, 'main', {}),
        runner.run(source, 'main', {}),
      ]);
      expect(fetchCount).toBe(1);
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records putError on timeout', async () => {
    vi.useFakeTimers();
    const { conn, dir, store } = testDb();
    const source: SourceAdapter = {
      id: 'demo',
      displayName: 'Demo',
      configSchema: { parse: () => ({}) } as never,
      datasets: {
        slow: {
          schema: { parse: (v: unknown) => v } as never,
          refresh: { everyMs: 1000, staleAfterMs: 2000 },
          fetch: async (ctx: { signal: AbortSignal }) => {
            await new Promise<void>((_resolve, reject) => {
              ctx.signal.addEventListener('abort', () => {
                reject(new Error('aborted'));
              });
            });
          },
        },
      },
    };

    const runner = createRunner({
      store,
      db: conn.db,
      log: stubLog,
      now: () => Date.now(),
      fetchImpl: globalThis.fetch,
    });

    try {
      const runPromise = runner.run(source, 'slow', {});
      await vi.advanceTimersByTimeAsync(15_000);
      await runPromise;

      const row = store.get('demo', 'slow');
      expect(row?.status).toBe('error');
    } finally {
      vi.useRealTimers();
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records putError on schema failure', async () => {
    const { conn, dir, store } = testDb();
    const source: SourceAdapter = {
      id: 'demo',
      displayName: 'Demo',
      configSchema: { parse: () => ({}) } as never,
      datasets: {
        bad: {
          schema: {
            parse: () => {
              throw new Error('invalid schema');
            },
          } as never,
          refresh: { everyMs: 1000, staleAfterMs: 2000 },
          fetch: async () => ({ bad: true }),
        },
      },
    };

    const runner = createRunner({
      store,
      db: conn.db,
      log: stubLog,
      now: () => Date.now(),
      fetchImpl: globalThis.fetch,
    });

    try {
      await runner.run(source, 'bad', {});
      const row = store.get('demo', 'bad');
      expect(row?.status).toBe('error');
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
