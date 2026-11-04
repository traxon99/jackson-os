import { describe, expect, it } from 'vitest';
import { createTestConn } from '../test-db.js';
import { createSnapshotStore } from './snapshots.js';

describe('createSnapshotStore', () => {
  it('returns error state with lastGood after putOk then putError', async () => {
    const { conn, cleanup } = await createTestConn();
    try {
      const store = createSnapshotStore(conn.db);
      const payload = { value: 42 };
      await store.putOk('demo', 'series', payload, 1000, 2000);
      await store.putError('demo', 'series', 'upstream failed');

      const row = await store.get('demo', 'series');
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
      await cleanup();
    }
  });
});
