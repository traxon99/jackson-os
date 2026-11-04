import { recoveryCodes } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createTestConn } from '../test-db.js';
import { createRecoveryCodesService } from './recovery-codes.js';

describe('recovery codes service', () => {
  async function withDb(
    run: (deps: {
      db: Awaited<ReturnType<typeof createTestConn>>['conn']['db'];
      service: ReturnType<typeof createRecoveryCodesService>;
    }) => Promise<void>,
  ): Promise<void> {
    const { conn, cleanup } = await createTestConn();
    const service = createRecoveryCodesService(conn.db, () => 1000);
    try {
      await run({ db: conn.db, service });
    } finally {
      await cleanup();
    }
  }

  it('accepts a code once and rejects reuse', async () => {
    await withDb(async ({ db, service }) => {
      const codes = await service.generate();
      expect(codes).toHaveLength(10);
      expect(codes[0]).toMatch(
        /^[23456789abcdefghjkmnpqrstuvwxyz]{4}-[23456789abcdefghjkmnpqrstuvwxyz]{4}-[23456789abcdefghjkmnpqrstuvwxyz]{4}$/,
      );

      const code0 = codes[0];
      if (code0 === undefined) {
        throw new Error('expected a recovery code');
      }
      expect(await service.consume(code0)).toBe(true);
      expect(await service.consume(code0)).toBe(false);

      const rows = await db.select().from(recoveryCodes);
      const row = rows.find((entry) => entry.usedAt === 1000);
      expect(row).toBeDefined();
    });
  });

  it('invalidates previous codes when regenerated', async () => {
    await withDb(async ({ service }) => {
      const first = await service.generate();
      const second = await service.generate();
      expect(first[0]).not.toBe(second[0]);
      const firstCode = first[0];
      const secondCode = second[0];
      if (firstCode === undefined || secondCode === undefined) {
        throw new Error('expected recovery codes');
      }
      expect(await service.consume(firstCode)).toBe(false);
      expect(await service.consume(secondCode)).toBe(true);
    });
  });

  it('stores only argon2 hashes, never raw codes', async () => {
    await withDb(async ({ db, service }) => {
      const codes = await service.generate();
      const rows = await db.select().from(recoveryCodes);
      expect(rows).toHaveLength(10);
      for (const row of rows) {
        expect(codes).not.toContain(row.codeHash);
        expect(row.codeHash.startsWith('$argon2')).toBe(true);
      }
    });
  });
});
