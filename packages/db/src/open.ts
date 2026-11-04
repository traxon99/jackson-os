import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import type { JosDatabase } from './types.js';

export type DbConnection = {
  kind: 'postgres';
  sql: postgres.Sql;
  db: JosDatabase;
};

export async function openDb(databaseUrl: string): Promise<DbConnection> {
  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 10,
  });
  const db = drizzle(sql, { schema });
  return { kind: 'postgres', sql, db };
}

export async function closeDb(conn: DbConnection): Promise<void> {
  await conn.sql.end({ timeout: 5 });
}
