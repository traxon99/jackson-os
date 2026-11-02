import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, openDb, runMigrations, sessions } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { createSessionService } from './sessions.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function withDb(
  run: (ctx: {
    db: ReturnType<typeof openDb>['db'];
    service: ReturnType<typeof createSessionService>;
    setNow: (t: number) => void;
  }) => void,
): void {
  const dir = mkdtempSync(join(tmpdir(), 'jos-sessions-'));
  const conn = openDb(join(dir, 'test.db'));
  runMigrations(conn.db);
  let current = 1_000_000;
  const service = createSessionService(conn.db, () => current);
  try {
    run({
      db: conn.db,
      service,
      setNow: (t) => {
        current = t;
      },
    });
  } finally {
    closeDb(conn);
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('createSessionService', () => {
  it('slides expiry on lookup up to the 90-day cap', () => {
    withDb(({ service, setNow }) => {
      setNow(0);
      const token = service.create({ userAgent: 'test' });

      setNow(25 * 24 * 60 * 60 * 1000);
      const session = service.lookup(token);
      expect(session).not.toBeNull();
      expect(session?.expiresAt).toBe(
        25 * 24 * 60 * 60 * 1000 + THIRTY_DAYS_MS,
      );

      setNow(54 * 24 * 60 * 60 * 1000);
      service.lookup(token);

      setNow(83 * 24 * 60 * 60 * 1000);
      const capped = service.lookup(token);
      expect(capped?.expiresAt).toBe(NINETY_DAYS_MS);

      setNow(89 * 24 * 60 * 60 * 1000);
      expect(service.lookup(token)).not.toBeNull();
    });
  });

  it('returns null after expiry without sliding', () => {
    withDb(({ service, setNow }) => {
      setNow(0);
      const token = service.create({});

      setNow(THIRTY_DAYS_MS + 1);
      expect(service.lookup(token)).toBeNull();
    });
  });

  it('revokes one, all, and all except', () => {
    withDb(({ service }) => {
      const a = service.create({});
      const b = service.create({});
      const c = service.create({});

      service.revoke(b);
      expect(service.lookup(b)).toBeNull();
      expect(service.lookup(a)).not.toBeNull();

      service.revokeAllExcept(c);
      expect(service.lookup(a)).toBeNull();
      expect(service.lookup(c)).not.toBeNull();

      service.revokeAll();
      expect(service.lookup(c)).toBeNull();
    });
  });

  it('stores only hashed tokens in the database', () => {
    withDb(({ db, service }) => {
      const token = service.create({});
      const rows = db.select().from(sessions).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.idHash).not.toBe(token);
      expect(rows[0]?.idHash).toHaveLength(64);
      for (const row of rows) {
        expect(JSON.stringify(row)).not.toContain(token);
      }
    });
  });
});
