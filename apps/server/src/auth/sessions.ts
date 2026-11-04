import { createHash, randomBytes } from 'node:crypto';
import type { JosDatabase } from '@jos/db';
import { sessions } from '@jos/db';
import { eq, ne } from 'drizzle-orm';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type SessionScope = 'full' | 'recovery';

export type SessionRecord = {
  id: string;
  scope: SessionScope;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
  userAgent: string | null;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionService(db: JosDatabase, now: () => number) {
  async function create(input: {
    userAgent?: string;
    scope?: SessionScope;
    absoluteTtlMs?: number;
  }): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const idHash = hashToken(token);
    const createdAt = now();
    const expiresAt =
      input.absoluteTtlMs !== undefined
        ? createdAt + input.absoluteTtlMs
        : createdAt + THIRTY_DAYS_MS;

    await db.insert(sessions).values({
      idHash,
      createdAt,
      expiresAt,
      lastSeenAt: createdAt,
      userAgent: input.userAgent ?? null,
      scope: input.scope ?? 'full',
    });

    return token;
  }

  async function lookup(token: string): Promise<SessionRecord | null> {
    const idHash = hashToken(token);
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.idHash, idHash));
    const row = rows[0];
    if (row === undefined) {
      return null;
    }

    const current = now();
    if (row.expiresAt < current) {
      return null;
    }

    if (row.scope === 'recovery') {
      return {
        id: row.idHash,
        scope: row.scope,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        lastSeenAt: row.lastSeenAt,
        userAgent: row.userAgent,
      };
    }

    const maxExpires = row.createdAt + NINETY_DAYS_MS;
    const slidExpires = Math.min(current + THIRTY_DAYS_MS, maxExpires);

    await db
      .update(sessions)
      .set({ lastSeenAt: current, expiresAt: slidExpires })
      .where(eq(sessions.idHash, idHash));

    return {
      id: row.idHash,
      scope: row.scope,
      createdAt: row.createdAt,
      expiresAt: slidExpires,
      lastSeenAt: current,
      userAgent: row.userAgent,
    };
  }

  async function revoke(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.idHash, hashToken(token)));
  }

  async function revokeAll(): Promise<void> {
    await db.delete(sessions);
  }

  async function revokeAllExcept(token: string): Promise<void> {
    const keep = hashToken(token);
    await db.delete(sessions).where(ne(sessions.idHash, keep));
  }

  return {
    create,
    lookup,
    revoke,
    revokeAll,
    revokeAllExcept,
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
