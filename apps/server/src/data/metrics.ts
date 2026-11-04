import type { JosDatabase } from '@jos/db';
import { metricPoints } from '@jos/db';

export async function writeMetricPoints(
  db: JosDatabase,
  sourceId: string,
  points: {
    metric: string;
    ts: number;
    value: number;
    dims?: Record<string, string>;
  }[],
): Promise<void> {
  if (points.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const point of points) {
      await tx.insert(metricPoints).values({
        sourceId,
        metric: point.metric,
        ts: point.ts,
        value: point.value,
        dims: point.dims ? JSON.stringify(point.dims) : null,
      });
    }
  });
}
