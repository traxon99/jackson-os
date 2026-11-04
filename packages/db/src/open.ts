import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import type { JosDatabase } from './types.js';

export type DbConnection = {
  kind: 'postgres' | 'pglite';
  sql?: postgres.Sql;
  client?: PGlite;
  db: JosDatabase;
};

export async function openDb(databaseUrl: string): Promise<DbConnection> {
  const sql = postgres(databaseUrl, {
    prepare: false,
    max: process.env.VERCEL === '1' ? 1 : 10,
  });
  const db = drizzle(sql, { schema });
  return { kind: 'postgres', sql, db };
}

/** In-memory Postgres for unit tests (PGlite). */
export async function openTestDb(): Promise<DbConnection> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  return { kind: 'pglite', client, db };
}

export async function closeDb(conn: DbConnection): Promise<void> {
  if (conn.kind === 'postgres' && conn.sql !== undefined) {
    await conn.sql.end({ timeout: 5 });
    return;
  }
  if (conn.client !== undefined) {
    await conn.client.close();
  }
}
