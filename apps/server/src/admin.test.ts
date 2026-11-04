import * as dbModule from '@jos/db';
import { meta, recoveryCodes, sessions, webauthnCredentials } from '@jos/db';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAuth } from './admin.js';
import { createTestConn } from './test-db.js';

const testDatabaseUrl = 'postgres://test/jackson-os-admin';

describe('admin reset-auth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears credentials, sessions, recovery codes, and setup_token_used', async () => {
    const { conn, cleanup } = await createTestConn();
    vi.spyOn(dbModule, 'openDb').mockResolvedValue(conn);
    vi.spyOn(dbModule, 'closeDb').mockResolvedValue(undefined);

    try {
      await conn.db.insert(webauthnCredentials).values({
        id: 'cred-1',
        publicKey: 'pk',
        counter: 0,
        transports: '[]',
        deviceName: null,
        createdAt: 1,
        lastUsedAt: null,
        revokedAt: null,
      });
      await conn.db.insert(sessions).values({
        idHash: 'hash',
        createdAt: 1,
        expiresAt: 9,
        lastSeenAt: 1,
        userAgent: null,
        scope: 'full',
      });
      await conn.db
        .insert(recoveryCodes)
        .values({ id: 'rc-1', codeHash: 'h', usedAt: null });
      await conn.db
        .insert(meta)
        .values({ key: 'setup_token_used', value: '1' });

      const token = await resetAuth(
        {
          DATABASE_URL: testDatabaseUrl,
          APP_ORIGIN: 'http://127.0.0.1:8080',
        },
        { yes: true },
      );

      expect(token).toHaveLength(64);
      expect(await conn.db.select().from(webauthnCredentials)).toEqual([]);
      expect(await conn.db.select().from(sessions)).toEqual([]);
      expect(await conn.db.select().from(recoveryCodes)).toEqual([]);
      expect(
        await conn.db
          .select()
          .from(meta)
          .where(eq(meta.key, 'setup_token_used')),
      ).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
