import { createRegistry, type SourceAdapter, UpstreamError } from '@jos/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createSnapshotStore } from '../data/snapshots.js';
import { createTestConn } from '../test-db.js';
import type { DatasetRunner } from './run-dataset.js';
import { createScheduler } from './scheduler.js';

const everyMs = 1000;

function failingSource(): SourceAdapter {
  return {
    id: 'demo',
    displayName: 'Demo',
    configSchema: z.object({}),
    datasets: {
      main: {
        schema: z.object({ ok: z.boolean() }),
        refresh: { everyMs, staleAfterMs: 2000, maxBackoffMs: everyMs * 8 },
        fetch: async () => {
          throw new Error('fail');
        },
      },
    },
  };
}

describe('createScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('backs off after failures and resets delay after success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const { conn, cleanup } = await createTestConn();
    const store = createSnapshotStore(conn.db);
    await store.putOk('demo', 'main', { ok: true }, 0, 0);

    const registry = createRegistry();
    registry.registerSource(failingSource());

    let shouldFail = true;
    const runner: DatasetRunner = {
      run: async (
        source,
        datasetKey,
        _config,
      ): Promise<{ retryAfterMs?: number } | undefined> => {
        if (shouldFail) {
          await store.putError(source.id, datasetKey, 'fail');
          return undefined;
        }
        await store.putOk(
          source.id,
          datasetKey,
          { ok: true },
          Date.now(),
          Date.now() + 2000,
        );
        return undefined;
      },
    };

    const scheduler = createScheduler({
      registry,
      runner,
      store,
      enabled: () => true,
      random: () => 0.5,
      now: () => Date.now(),
      getSourceConfig: () => ({}),
    });

    try {
      await scheduler.start();

      await vi.advanceTimersByTimeAsync(everyMs);
      expect(scheduler.getLastScheduledBaseDelay('demo', 'main')).toBe(
        everyMs * 2,
      );

      await vi.advanceTimersByTimeAsync(everyMs * 2);
      expect(scheduler.getLastScheduledBaseDelay('demo', 'main')).toBe(
        everyMs * 4,
      );

      await vi.advanceTimersByTimeAsync(everyMs * 4);
      expect(scheduler.getLastScheduledBaseDelay('demo', 'main')).toBe(
        everyMs * 8,
      );

      shouldFail = false;
      await vi.advanceTimersByTimeAsync(everyMs * 8);
      expect(scheduler.getLastScheduledBaseDelay('demo', 'main')).toBe(everyMs);
    } finally {
      scheduler.stop();
      await cleanup();
    }
  });

  it('honors Retry-After via UpstreamError retryAfterMs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const { conn, cleanup } = await createTestConn();
    const store = createSnapshotStore(conn.db);
    await store.putOk('demo', 'main', { ok: true }, 0, 0);

    const registry = createRegistry();
    registry.registerSource({
      id: 'demo',
      displayName: 'Demo',
      configSchema: z.object({}),
      datasets: {
        main: {
          schema: z.object({ ok: z.boolean() }),
          refresh: { everyMs, staleAfterMs: 2000 },
          fetch: async () => {
            throw new UpstreamError('rate limited', {
              status: 429,
              retryAfterMs: 180_000,
            });
          },
        },
      },
    });

    const runner: DatasetRunner = {
      run: async (source, datasetKey, _config) => {
        await store.putError(
          source.id,
          datasetKey,
          'upstream 429 · retry in 3m',
        );
        return { retryAfterMs: 180_000 };
      },
    };

    const scheduler = createScheduler({
      registry,
      runner,
      store,
      enabled: () => true,
      random: () => 0.5,
      now: () => Date.now(),
      getSourceConfig: () => ({}),
    });

    try {
      await scheduler.start();
      await vi.advanceTimersByTimeAsync(everyMs);

      expect(scheduler.getLastScheduledBaseDelay('demo', 'main')).toBe(180_000);

      const nextAt = scheduler.getNextFetchAt('demo');
      expect(nextAt).not.toBeNull();
      expect(nextAt).toBeGreaterThanOrEqual(Date.now() + 180_000 - 1000);
    } finally {
      scheduler.stop();
      await cleanup();
    }
  });
});
