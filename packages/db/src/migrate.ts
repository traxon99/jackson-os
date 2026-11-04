import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import type { DbConnection } from './open.js';
import type { TestDbConnection } from './open-test.js';
import type * as schema from './schema/index.js';

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'drizzle',
);

export async function runMigrations(conn: DbConnection): Promise<void> {
  await migratePostgres(conn.db as PostgresJsDatabase<typeof schema>, {
    migrationsFolder,
  });
}

export async function runTestMigrations(conn: TestDbConnection): Promise<void> {
  await migratePglite(conn.db as PgliteDatabase<typeof schema>, {
    migrationsFolder,
  });
}
