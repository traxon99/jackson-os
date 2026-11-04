import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';
import { closeDb, openTestDb } from './open.js';

describe('openTestDb', () => {
  let conn: Awaited<ReturnType<typeof openTestDb>> | undefined;

  afterEach(async () => {
    if (conn !== undefined) {
      await closeDb(conn);
      conn = undefined;
    }
  });

  it('opens PGlite and applies migrations', async () => {
    conn = await openTestDb();
    await runMigrations(conn);
    if (conn.client === undefined) {
      throw new Error('expected PGlite client');
    }
    const rows = await conn.client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const names = rows.rows.map((r) => r.tablename);
    expect(names).toContain('sessions');
    expect(names).toContain('webauthn_credentials');
  });
});
