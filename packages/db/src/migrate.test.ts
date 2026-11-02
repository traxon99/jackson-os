import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';
import { closeDb, openDb } from './open.js';

const APP_TABLES = [
  'webauthn_credentials',
  'sessions',
  'recovery_codes',
  'source_snapshots',
  'metric_points',
  'widget_layout',
  'action_log',
  'suggestions',
] as const;

describe('runMigrations', () => {
  it('applies all migrations idempotently and creates every app table', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-migrate-'));
    const dbPath = join(dir, 'app.db');

    const conn = openDb(dbPath);
    try {
      runMigrations(conn.db);
      runMigrations(conn.db);

      const rows = conn.sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[];

      const tableNames = new Set(rows.map((row) => row.name));
      for (const table of APP_TABLES) {
        expect(tableNames.has(table)).toBe(true);
      }
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
