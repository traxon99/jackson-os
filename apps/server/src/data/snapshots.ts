import type { WidgetPayload } from '@jos/core';
import type { JosDatabase } from '@jos/db';
import { sourceSnapshots } from '@jos/db';
import { and, eq } from 'drizzle-orm';

export type SnapshotRow = typeof sourceSnapshots.$inferSelect;

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;

export function createSnapshotStore(db: JosDatabase) {
  async function get(
    sourceId: string,
    key: string,
  ): Promise<SnapshotRow | undefined> {
    const rows = await db
      .select()
      .from(sourceSnapshots)
      .where(
        and(
          eq(sourceSnapshots.sourceId, sourceId),
          eq(sourceSnapshots.key, key),
        ),
      );
    return rows[0];
  }

  async function putOk(
    sourceId: string,
    key: string,
    payload: unknown,
    fetchedAt: number,
    expiresAt: number,
  ): Promise<void> {
    const payloadJson = JSON.stringify(payload);
    await db
      .insert(sourceSnapshots)
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
      });
  }

  async function putError(
    sourceId: string,
    key: string,
    error: string,
  ): Promise<void> {
    const existing = await get(sourceId, key);
    if (existing === undefined) {
      await db.insert(sourceSnapshots).values({
        sourceId,
        key,
        payload: 'null',
        fetchedAt: 0,
        expiresAt: null,
        status: 'error',
        error,
      });
      return;
    }

    await db
      .update(sourceSnapshots)
      .set({
        status: 'error',
        error,
      })
      .where(
        and(
          eq(sourceSnapshots.sourceId, sourceId),
          eq(sourceSnapshots.key, key),
        ),
      );
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
