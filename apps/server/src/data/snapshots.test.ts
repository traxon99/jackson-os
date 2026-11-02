import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, openDb, runMigrations } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createSnapshotStore } from './snapshots.js';

describe('createSnapshotStore', () => {
  it('returns error state with lastGood after putOk then putError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-snapshots-'));
    const dbPath = join(dir, 'test.db');
    const conn = openDb(dbPath);
    runMigrations(conn.db);

    try {
      const store = createSnapshotStore(conn.db);
      const payload = { value: 42 };
      store.putOk('demo', 'series', payload, 1000, 2000);
      store.putError('demo', 'series', 'upstream failed');

      const row = store.get('demo', 'series');
      const widget = store.toWidgetPayload<{ value: number }>(row, 1500);

      expect(widget).toEqual({
        state: 'error',
        error: 'upstream failed',
        lastGood: {
          data: { value: 42 },
          fetchedAt: new Date(1000).toISOString(),
        },
      });
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
