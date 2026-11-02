import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { backupNow, pruneBackups } from './backup.js';
import { runMigrations } from './migrate.js';
import { closeDb, openDb } from './open.js';

describe('backupNow', () => {
  it('copies database contents into a timestamped backup file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-backup-'));
    const backupDir = join(dir, 'backups');
    const dbPath = join(dir, 'app.db');
    const now = new Date('2026-03-15T14:30:45');

    const conn = openDb(dbPath);
    try {
      runMigrations(conn.db);
      conn.sqlite
        .prepare(
          `INSERT INTO action_log (id, widget_id, action, params, result, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('log-1', 'w1', 'test', '{}', 'ok', 1);

      const backupPath = backupNow(conn.sqlite, backupDir, now);
      expect(backupPath).toBe(join(backupDir, 'app-20260315-143045.db'));
      expect(existsSync(backupPath)).toBe(true);

      const backupDb = new Database(backupPath, { readonly: true });
      try {
        const row = backupDb
          .prepare('SELECT id FROM action_log WHERE id = ?')
          .get('log-1') as { id: string } | undefined;
        expect(row?.id).toBe('log-1');
      } finally {
        backupDb.close();
      }
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('pruneBackups', () => {
  it('deletes app-*.db backups older than keepDays by filename date', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-prune-'));
    const now = new Date('2026-06-01T12:00:00');

    writeFileSync(join(dir, 'app-20260501-120000.db'), '');
    writeFileSync(join(dir, 'app-20260520-120000.db'), '');
    writeFileSync(join(dir, 'app-20260531-235959.db'), '');
    writeFileSync(join(dir, 'app-20260401-120000.db'), '');
    writeFileSync(join(dir, 'notes.txt'), '');

    try {
      pruneBackups(dir, now, 14);

      expect(existsSync(join(dir, 'app-20260401-120000.db'))).toBe(false);
      expect(existsSync(join(dir, 'app-20260501-120000.db'))).toBe(false);
      expect(existsSync(join(dir, 'app-20260520-120000.db'))).toBe(true);
      expect(existsSync(join(dir, 'app-20260531-235959.db'))).toBe(true);
      expect(existsSync(join(dir, 'notes.txt'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
