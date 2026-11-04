import { demoAdapter } from '@jos/core';
import { metricPoints } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createRunner } from '../scheduler/run-dataset.js';
import { createTestConn } from '../test-db.js';
import { createSnapshotStore } from './snapshots.js';

const stubLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('metrics write', () => {
  it('inserts 20 rows for the demo series dataset', async () => {
    const { conn, cleanup } = await createTestConn();
    const store = createSnapshotStore(conn.db);
    const runner = createRunner({
      store,
      db: conn.db,
      log: stubLog,
      now: () => new Date('2026-01-01T12:00:00.000Z').getTime(),
      fetchImpl: globalThis.fetch,
    });

    try {
      await runner.run(demoAdapter, 'series', {});
      const rows = await conn.db.select().from(metricPoints);
      expect(rows).toHaveLength(20);
      expect(rows.every((row) => row.metric === 'demo.value')).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
