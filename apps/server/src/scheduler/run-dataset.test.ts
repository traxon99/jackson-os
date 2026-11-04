import { type SourceAdapter, UpstreamError } from '@jos/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestConn } from '../test-db.js';
import { createSnapshotStore } from '../data/snapshots.js';
import { createRunner } from './run-dataset.js';

const stubLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

async function testDb() {
  const { conn, cleanup } = await createTestConn();
  return { conn, cleanup, store: createSnapshotStore(conn.db) };
}

describe('createRunner', () => {
  it('deduplicates concurrent runs for the same source:dataset', async () => {
    const { conn, cleanup, store } = await testDb();
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
      await cleanup();
    }
  });

  it('records putError on timeout', async () => {
    vi.useFakeTimers();
    const { conn, cleanup, store } = await testDb();
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

      const row = await store.get('demo', 'slow');
      expect(row?.status).toBe('error');
    } finally {
      vi.useRealTimers();
      await cleanup();
    }
  });

  it('records formatted UpstreamError on upstream failure', async () => {
    const { conn, cleanup, store } = await testDb();
    const source: SourceAdapter = {
      id: 'demo',
      displayName: 'Demo',
      configSchema: { parse: () => ({}) } as never,
      datasets: {
        rate: {
          schema: { parse: (v: unknown) => v } as never,
          refresh: { everyMs: 1000, staleAfterMs: 2000 },
          fetch: async () => {
            throw new UpstreamError('rate limited', {
              status: 429,
              retryAfterMs: 180_000,
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
      const result = await runner.run(source, 'rate', {});
      expect(result).toEqual({ retryAfterMs: 180_000 });
      const row = await store.get('demo', 'rate');
      expect(row?.status).toBe('error');
      expect(row?.error).toBe('upstream 429 · retry in 3m');
    } finally {
      await cleanup();
    }
  });

  it('records putError on schema failure', async () => {
    const { conn, cleanup, store } = await testDb();
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
      const row = await store.get('demo', 'bad');
      expect(row?.status).toBe('error');
    } finally {
      await cleanup();
    }
  });
});
