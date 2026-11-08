import { afterEach, describe, expect, it } from 'vitest';
import { runTestMigrations } from './migrate.js';
import { closeTestDb, openTestDb } from './open-test.js';

describe('runTestMigrations', () => {
  let conn: Awaited<ReturnType<typeof openTestDb>> | undefined;

  afterEach(async () => {
    if (conn !== undefined) {
      await closeTestDb(conn);
      conn = undefined;
    }
  });

  it('is idempotent on PGlite', async () => {
    conn = await openTestDb();
    await runTestMigrations(conn);
    await runTestMigrations(conn);
    const rows = await conn.client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'drizzle%' ORDER BY tablename",
    );
    expect(rows.rows.length).toBeGreaterThan(0);
  });

  it('enables RLS on every application table (Supabase Data API lockdown)', async () => {
    conn = await openTestDb();
    await runTestMigrations(conn);
    const rows = await conn.client.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND c.relname NOT LIKE 'drizzle%'
       ORDER BY c.relname`,
    );
    expect(rows.rows.length).toBe(9);
    for (const row of rows.rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
    }
  });
});
