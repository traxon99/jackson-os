import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

/**
 * Restore from a backup file:
 * 1. Stop the server.
 * 2. Copy the backup file over `app.db` in the data directory.
 * 3. Delete `app.db-wal` and `app.db-shm` if present.
 * 4. Start the server again.
 */

const BACKUP_NAME = /^app-(\d{8})-(\d{6})\.db$/;

function formatBackupTimestamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${y}${m}${d}-${h}${min}${s}`;
}

function sqlitePathLiteral(path: string): string {
  return `'${path.replace(/'/g, "''")}'`;
}

function parseBackupDate(filename: string): Date | null {
  const match = BACKUP_NAME.exec(filename);
  if (!match) {
    return null;
  }
  const ymd = match[1];
  const hms = match[2];
  if (ymd === undefined || hms === undefined) {
    return null;
  }
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const day = Number(ymd.slice(6, 8));
  const hour = Number(hms.slice(0, 2));
  const minute = Number(hms.slice(2, 4));
  const second = Number(hms.slice(4, 6));
  return new Date(year, month - 1, day, hour, minute, second);
}

export function backupNow(
  sqlite: Database.Database,
  dir: string,
  now: Date,
): string {
  mkdirSync(dir, { recursive: true });
  const filename = `app-${formatBackupTimestamp(now)}.db`;
  const path = join(dir, filename);
  sqlite.exec(`VACUUM INTO ${sqlitePathLiteral(path)}`);
  return path;
}

export function pruneBackups(dir: string, now: Date, keepDays = 14): void {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - keepDays);

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    const backupDate = parseBackupDate(name);
    if (backupDate === null) {
      continue;
    }
    if (backupDate < cutoff) {
      unlinkSync(join(dir, name));
    }
  }
}
