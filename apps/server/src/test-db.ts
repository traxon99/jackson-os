import { closeDb, type DbConnection, openTestDb, runMigrations } from '@jos/db';

export async function createTestConn(): Promise<{
  conn: DbConnection;
  cleanup: () => Promise<void>;
}> {
  const conn = await openTestDb();
  await runMigrations(conn);
  return {
    conn,
    cleanup: async () => {
      await closeDb(conn);
    },
  };
}
