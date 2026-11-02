import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  closeDb,
  meta,
  openDb,
  recoveryCodes,
  runMigrations,
  sessions,
  webauthnCredentials,
} from '@jos/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { resetAuth } from './admin.js';

describe('admin reset-auth', () => {
  it('clears credentials, sessions, recovery codes, and setup_token_used', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jos-admin-'));
    try {
      const conn = openDb(join(dir, 'app.db'));
      runMigrations(conn.db);
      conn.db
        .insert(webauthnCredentials)
        .values({
          id: 'cred-1',
          publicKey: 'pk',
          counter: 0,
          transports: '[]',
          deviceName: null,
          createdAt: 1,
          lastUsedAt: null,
          revokedAt: null,
        })
        .run();
      conn.db
        .insert(sessions)
        .values({
          idHash: 'hash',
          createdAt: 1,
          expiresAt: 9,
          lastSeenAt: 1,
          userAgent: null,
          scope: 'full',
        })
        .run();
      conn.db
        .insert(recoveryCodes)
        .values({ id: 'rc-1', codeHash: 'h', usedAt: null })
        .run();
      conn.db
        .insert(meta)
        .values({ key: 'setup_token_used', value: '1' })
        .run();
      closeDb(conn);

      const token = await resetAuth(
        {
          DATA_DIR: dir,
          APP_ORIGIN: 'http://127.0.0.1:8080',
        },
        { yes: true },
      );

      expect(token).toHaveLength(64);

      const after = openDb(join(dir, 'app.db'));
      expect(after.db.select().from(webauthnCredentials).all()).toEqual([]);
      expect(after.db.select().from(sessions).all()).toEqual([]);
      expect(after.db.select().from(recoveryCodes).all()).toEqual([]);
      expect(
        after.db
          .select()
          .from(meta)
          .where(eq(meta.key, 'setup_token_used'))
          .all(),
      ).toEqual([]);
      closeDb(after);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
