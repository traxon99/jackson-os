import type { TestDbConnection } from '@jos/db/test';
import { closeTestDb, openTestDb, runTestMigrations } from '@jos/db/test';

export async function createTestConn(): Promise<{
  conn: TestDbConnection;
  cleanup: () => Promise<void>;
}> {
  const conn = await openTestDb();
  await runTestMigrations(conn);
  return {
    conn,
    cleanup: async () => {
      await closeTestDb(conn);
    },
  };
}
