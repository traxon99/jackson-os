import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDb, openDb } from './open.js';

describe('openDb', () => {
  it('creates parent dirs and sets journal_mode, foreign_keys, and busy_timeout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-db-'));
    const dbPath = join(dir, 'nested', 'test.db');

    const conn = openDb(dbPath);
    try {
      expect(conn.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(conn.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(conn.sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
    } finally {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
