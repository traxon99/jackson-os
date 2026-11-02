import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export type DbConnection = {
  sqlite: Database.Database;
  db: BetterSQLite3Database;
};

export function openDb(path: string): DbConnection {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite);
  return { sqlite, db };
}

export function closeDb(conn: DbConnection): void {
  conn.sqlite.close();
}
