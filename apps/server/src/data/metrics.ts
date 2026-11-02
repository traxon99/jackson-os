import { metricPoints } from '@jos/db';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export function writeMetricPoints(
  db: BetterSQLite3Database,
  sourceId: string,
  points: {
    metric: string;
    ts: number;
    value: number;
    dims?: Record<string, string>;
  }[],
): void {
  if (points.length === 0) {
    return;
  }

  db.transaction((tx) => {
    for (const point of points) {
      tx.insert(metricPoints)
        .values({
          sourceId,
          metric: point.metric,
          ts: point.ts,
          value: point.value,
          dims: point.dims ? JSON.stringify(point.dims) : null,
        })
        .run();
    }
  });
}
