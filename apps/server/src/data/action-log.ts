import type { JosDatabase } from '@jos/db';
import { actionLog } from '@jos/db';

export async function insertActionLog(
  db: JosDatabase,
  row: {
    id: string;
    widgetId: string;
    action: string;
    params: unknown;
    result: string;
    createdAt: number;
  },
): Promise<void> {
  await db.insert(actionLog).values({
    id: row.id,
    widgetId: row.widgetId,
    action: row.action,
    params: JSON.stringify(row.params),
    result: row.result,
    createdAt: row.createdAt,
  });
}
