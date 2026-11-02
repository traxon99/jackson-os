import { actionLog } from '@jos/db';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export function insertActionLog(
  db: BetterSQLite3Database,
  row: {
    id: string;
    widgetId: string;
    action: string;
    params: unknown;
    result: string;
    createdAt: number;
  },
): void {
  db.insert(actionLog)
    .values({
      id: row.id,
      widgetId: row.widgetId,
      action: row.action,
      params: JSON.stringify(row.params),
      result: row.result,
      createdAt: row.createdAt,
    })
    .run();
}
