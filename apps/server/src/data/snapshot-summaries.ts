import type { Registry } from '@jos/core';
import type { SnapshotStore } from './snapshots.js';

export type SnapshotSummary = {
  sourceId: string;
  datasetKey: string;
  status: string;
  fetchedAt: string | null;
  expiresAt: string | null;
  error: string | null;
  payloadBytes: number | null;
};

export async function listSnapshotSummaries(
  registry: Registry,
  store: SnapshotStore,
  sourceId?: string,
): Promise<SnapshotSummary[]> {
  const sources = sourceId
    ? [registry.getSource(sourceId)].filter((s) => s !== undefined)
    : registry.listSources();

  const summaries: SnapshotSummary[] = [];

  for (const source of sources) {
    for (const datasetKey of Object.keys(source.datasets)) {
      const row = await store.get(source.id, datasetKey);
      if (row === undefined) {
        summaries.push({
          sourceId: source.id,
          datasetKey,
          status: 'missing',
          fetchedAt: null,
          expiresAt: null,
          error: null,
          payloadBytes: null,
        });
        continue;
      }

      summaries.push({
        sourceId: source.id,
        datasetKey,
        status: row.status,
        fetchedAt: new Date(row.fetchedAt).toISOString(),
        expiresAt:
          row.expiresAt === null || row.expiresAt === undefined
            ? null
            : new Date(row.expiresAt).toISOString(),
        error: row.error,
        payloadBytes: row.payload.length,
      });
    }
  }

  return summaries;
}
