import type { WidgetPayload } from '@jos/core';
import { sourceSnapshots } from '@jos/db';
import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type SnapshotRow = typeof sourceSnapshots.$inferSelect;

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;

export function createSnapshotStore(db: BetterSQLite3Database) {
  function get(sourceId: string, key: string): SnapshotRow | undefined {
    const rows = db
      .select()
      .from(sourceSnapshots)
      .where(
        and(
          eq(sourceSnapshots.sourceId, sourceId),
          eq(sourceSnapshots.key, key),
        ),
      )
      .all();
    return rows[0];
  }

  function putOk(
    sourceId: string,
    key: string,
    payload: unknown,
    fetchedAt: number,
    expiresAt: number,
  ): void {
    const payloadJson = JSON.stringify(payload);
    db.insert(sourceSnapshots)
      .values({
        sourceId,
        key,
        payload: payloadJson,
        fetchedAt,
        expiresAt,
        status: 'ok',
        error: null,
      })
      .onConflictDoUpdate({
        target: [sourceSnapshots.sourceId, sourceSnapshots.key],
        set: {
          payload: payloadJson,
          fetchedAt,
          expiresAt,
          status: 'ok',
          error: null,
        },
      })
      .run();
  }

  function putError(sourceId: string, key: string, error: string): void {
    const existing = get(sourceId, key);
    if (existing === undefined) {
      db.insert(sourceSnapshots)
        .values({
          sourceId,
          key,
          payload: 'null',
          fetchedAt: 0,
          expiresAt: null,
          status: 'error',
          error,
        })
        .run();
      return;
    }

    db.update(sourceSnapshots)
      .set({
        status: 'error',
        error,
      })
      .where(
        and(
          eq(sourceSnapshots.sourceId, sourceId),
          eq(sourceSnapshots.key, key),
        ),
      )
      .run();
  }

  function toWidgetPayload<T>(
    row: SnapshotRow | undefined,
    nowMs: number,
  ): WidgetPayload<T> | undefined {
    if (row === undefined) {
      return undefined;
    }

    const fetchedAtIso = new Date(row.fetchedAt).toISOString();
    const parsed = JSON.parse(row.payload) as T;

    if (row.status === 'ok') {
      const expiresAt = row.expiresAt ?? 0;
      return {
        state: 'ok',
        data: parsed,
        fetchedAt: fetchedAtIso,
        stale: nowMs > expiresAt,
      };
    }

    return {
      state: 'error',
      error: row.error ?? 'unknown error',
      lastGood:
        row.fetchedAt > 0
          ? { data: parsed, fetchedAt: fetchedAtIso }
          : undefined,
    };
  }

  return { get, putOk, putError, toWidgetPayload };
}
