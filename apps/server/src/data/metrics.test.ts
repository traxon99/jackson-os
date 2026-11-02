import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoAdapter } from '@jos/core';
import { closeDb, metricPoints, openDb, runMigrations } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createRunner } from '../scheduler/run-dataset.js';
import { createSnapshotStore } from './snapshots.js';

const stubLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('metrics write', () => {
  it('inserts 20 rows for the demo series dataset', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-metrics-'));
    const dbPath = join(dir, 'test.db');
    const conn = openDb(dbPath);
    runMigrations(conn.db);
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
      const rows = conn.db.select().from(metricPoints).all();
      expect(rows).toHaveLength(20);
      expect(rows.every((row) => row.metric === 'demo.value')).toBe(true);
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
