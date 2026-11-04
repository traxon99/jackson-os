import { sessions } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createTestConn } from '../test-db.js';
import { createSessionService } from './sessions.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function withDb(
  run: (ctx: {
    db: Awaited<ReturnType<typeof createTestConn>>['conn']['db'];
    service: ReturnType<typeof createSessionService>;
    setNow: (t: number) => void;
  }) => Promise<void>,
): Promise<void> {
  const { conn, cleanup } = await createTestConn();
  let current = 1_000_000;
  const service = createSessionService(conn.db, () => current);
  try {
    await run({
      db: conn.db,
      service,
      setNow: (t) => {
        current = t;
      },
    });
  } finally {
    await cleanup();
  }
}

describe('createSessionService', () => {
  it('slides expiry on lookup up to the 90-day cap', async () => {
    await withDb(async ({ service, setNow }) => {
      setNow(0);
      const token = await service.create({ userAgent: 'test' });

      setNow(25 * 24 * 60 * 60 * 1000);
      const session = await service.lookup(token);
      expect(session).not.toBeNull();
      expect(session?.expiresAt).toBe(
        25 * 24 * 60 * 60 * 1000 + THIRTY_DAYS_MS,
      );

      setNow(54 * 24 * 60 * 60 * 1000);
      await service.lookup(token);

      setNow(83 * 24 * 60 * 60 * 1000);
      const capped = await service.lookup(token);
      expect(capped?.expiresAt).toBe(NINETY_DAYS_MS);

      setNow(89 * 24 * 60 * 60 * 1000);
      expect(await service.lookup(token)).not.toBeNull();
    });
  });

  it('returns null after expiry without sliding', async () => {
    await withDb(async ({ service, setNow }) => {
      setNow(0);
      const token = await service.create({});

      setNow(THIRTY_DAYS_MS + 1);
      expect(await service.lookup(token)).toBeNull();
    });
  });

  it('revokes one, all, and all except', async () => {
    await withDb(async ({ service }) => {
      const a = await service.create({});
      const b = await service.create({});
      const c = await service.create({});

      await service.revoke(b);
      expect(await service.lookup(b)).toBeNull();
      expect(await service.lookup(a)).not.toBeNull();

      await service.revokeAllExcept(c);
      expect(await service.lookup(a)).toBeNull();
      expect(await service.lookup(c)).not.toBeNull();

      await service.revokeAll();
      expect(await service.lookup(c)).toBeNull();
    });
  });

  it('stores only hashed tokens in the database', async () => {
    await withDb(async ({ db, service }) => {
      const token = await service.create({});
      const rows = await db.select().from(sessions);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.idHash).not.toBe(token);
      expect(rows[0]?.idHash).toHaveLength(64);
      for (const row of rows) {
        expect(JSON.stringify(row)).not.toContain(token);
      }
    });
  });
});
