import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, openDb, recoveryCodes, runMigrations } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createRecoveryCodesService } from './recovery-codes.js';

describe('recovery codes service', () => {
  function withDb(
    run: (deps: {
      db: ReturnType<typeof openDb>['db'];
      service: ReturnType<typeof createRecoveryCodesService>;
    }) => Promise<void>,
  ): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), 'jos-recovery-codes-'));
    const conn = openDb(join(dir, 'app.db'));
    runMigrations(conn.db);
    const service = createRecoveryCodesService(conn.db, () => 1000);
    return run({ db: conn.db, service }).finally(() => {
      closeDb(conn);
      rmSync(dir, { recursive: true, force: true });
    });
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

      const row = db
        .select()
        .from(recoveryCodes)
        .all()
        .find((entry) => entry.usedAt === 1000);
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
      const rows = db.select().from(recoveryCodes).all();
      expect(rows).toHaveLength(10);
      for (const row of rows) {
        expect(codes).not.toContain(row.codeHash);
        expect(row.codeHash.startsWith('$argon2')).toBe(true);
      }
    });
  });
});
