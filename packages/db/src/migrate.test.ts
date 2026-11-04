import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';
import { closeDb, openTestDb } from './open.js';

describe('runMigrations', () => {
  let conn: Awaited<ReturnType<typeof openTestDb>> | undefined;

  afterEach(async () => {
    if (conn !== undefined) {
      await closeDb(conn);
      conn = undefined;
    }
  });

  it('is idempotent on PGlite', async () => {
    conn = await openTestDb();
    await runMigrations(conn);
    await runMigrations(conn);
    if (conn.client === undefined) {
      throw new Error('expected PGlite client');
    }
    const rows = await conn.client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'drizzle%' ORDER BY tablename",
    );
    expect(rows.rows.length).toBeGreaterThan(0);
  });
});
