import type { JosDatabase } from '@jos/db';
import { webauthnCredentials } from '@jos/db';
import { eq } from 'drizzle-orm';

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

export function createCredentialsStore(db: JosDatabase) {
  async function count(): Promise<number> {
    const rows = await db.select().from(webauthnCredentials);
    return rows.length;
  }

  async function list(): Promise<StoredCredential[]> {
    return db.select().from(webauthnCredentials);
  }

  async function insert(
    credential: Omit<StoredCredential, 'revokedAt'> & {
      revokedAt?: number | null;
    },
  ): Promise<void> {
    await db.insert(webauthnCredentials).values({
      ...credential,
      revokedAt: credential.revokedAt ?? null,
    });
  }

  async function getById(id: string): Promise<StoredCredential | undefined> {
    const rows = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.id, id));
    return rows[0];
  }

  async function updateAfterUse(
    id: string,
    counter: number,
    lastUsedAt: number,
  ): Promise<void> {
    await db
      .update(webauthnCredentials)
      .set({ counter, lastUsedAt })
      .where(eq(webauthnCredentials.id, id));
  }

  async function markRevoked(id: string, revokedAt: number): Promise<void> {
    await db
      .update(webauthnCredentials)
      .set({ revokedAt })
      .where(eq(webauthnCredentials.id, id));
  }

  async function updateDeviceName(
    id: string,
    deviceName: string,
  ): Promise<boolean> {
    const rows = await db
      .update(webauthnCredentials)
      .set({ deviceName })
      .where(eq(webauthnCredentials.id, id))
      .returning();
    return rows.length > 0;
  }

  async function remove(id: string): Promise<boolean> {
    const rows = await db
      .delete(webauthnCredentials)
      .where(eq(webauthnCredentials.id, id))
      .returning();
    return rows.length > 0;
  }

  return {
    count,
    list,
    insert,
    getById,
    updateAfterUse,
    markRevoked,
    updateDeviceName,
    remove,
  };
}

export type CredentialsStore = ReturnType<typeof createCredentialsStore>;
