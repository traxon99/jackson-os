import { webauthnCredentials } from '@jos/db';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type StoredCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports: string;
  deviceName: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

export function createCredentialsStore(db: BetterSQLite3Database) {
  function count(): number {
    return db.select().from(webauthnCredentials).all().length;
  }

  function list(): StoredCredential[] {
    return db.select().from(webauthnCredentials).all();
  }

  function insert(
    credential: Omit<StoredCredential, 'revokedAt'> & {
      revokedAt?: number | null;
    },
  ): void {
    db.insert(webauthnCredentials)
      .values({ ...credential, revokedAt: credential.revokedAt ?? null })
      .run();
  }

  function getById(id: string): StoredCredential | undefined {
    return db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.id, id))
      .get();
  }

  function updateAfterUse(
    id: string,
    counter: number,
    lastUsedAt: number,
  ): void {
    db.update(webauthnCredentials)
      .set({ counter, lastUsedAt })
      .where(eq(webauthnCredentials.id, id))
      .run();
  }

  function markRevoked(id: string, revokedAt: number): void {
    db.update(webauthnCredentials)
      .set({ revokedAt })
      .where(eq(webauthnCredentials.id, id))
      .run();
  }

  return { count, list, insert, getById, updateAfterUse, markRevoked };
}

export type CredentialsStore = ReturnType<typeof createCredentialsStore>;
