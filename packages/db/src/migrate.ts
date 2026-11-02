import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'drizzle',
);

export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder });
}
