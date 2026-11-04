import { afterEach, describe, expect, it } from 'vitest';
import { runTestMigrations } from './migrate.js';
import { closeTestDb, openTestDb } from './open-test.js';

describe('openTestDb', () => {
  let conn: Awaited<ReturnType<typeof openTestDb>> | undefined;

  afterEach(async () => {
    if (conn !== undefined) {
      await closeTestDb(conn);
      conn = undefined;
    }
  });

  it('opens PGlite and applies migrations', async () => {
    conn = await openTestDb();
    await runTestMigrations(conn);
    const rows = await conn.client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const names = rows.rows.map((r) => r.tablename);
    expect(names).toContain('sessions');
    expect(names).toContain('webauthn_credentials');
  });
});
