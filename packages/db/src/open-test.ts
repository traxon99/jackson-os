import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema/index.js';
import type { JosDatabase } from './types.js';

/** In-memory Postgres for unit tests (PGlite). Not used in production deploys. */
export type TestDbConnection = {
  kind: 'pglite';
  client: PGlite;
  db: JosDatabase;
};

export async function openTestDb(): Promise<TestDbConnection> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  return { kind: 'pglite', client, db };
}

export async function closeTestDb(conn: TestDbConnection): Promise<void> {
  await conn.client.close();
}

export { runTestMigrations } from './migrate.js';
