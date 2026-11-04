import { randomBytes } from 'node:crypto';
import type { JosDatabase } from '@jos/db';
import { recoveryCodes } from '@jos/db';
import { hash, verify } from '@node-rs/argon2';
import { eq, isNull } from 'drizzle-orm';

const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const CODE_COUNT = 10;
const SEGMENT_LEN = 4;

function randomSegment(): string {
  const bytes = randomBytes(SEGMENT_LEN);
  let segment = '';
  for (let i = 0; i < SEGMENT_LEN; i += 1) {
    const byte = bytes[i] ?? 0;
    segment += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return segment;
}

function formatRecoveryCode(): string {
  return `${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

export type RecoveryCodesService = {
  generate: () => Promise<string[]>;
  consume: (code: string) => Promise<boolean>;
};

export function createRecoveryCodesService(
  db: JosDatabase,
  now: () => number = () => Date.now(),
): RecoveryCodesService {
  async function generate(): Promise<string[]> {
    await db.delete(recoveryCodes);

    const rawCodes: string[] = [];
    for (let i = 0; i < CODE_COUNT; i += 1) {
      const raw = formatRecoveryCode();
      rawCodes.push(raw);
      const codeHash = await hash(raw);
      await db.insert(recoveryCodes).values({
        id: randomBytes(16).toString('hex'),
        codeHash,
        usedAt: null,
      });
    }
    return rawCodes;
  }

  async function consume(code: string): Promise<boolean> {
    const normalized = code.trim().toLowerCase();
    const rows = await db
      .select()
      .from(recoveryCodes)
      .where(isNull(recoveryCodes.usedAt));

    for (const row of rows) {
      const matches = await verify(row.codeHash, normalized);
      if (!matches) {
        continue;
      }
      await db
        .update(recoveryCodes)
        .set({ usedAt: now() })
        .where(eq(recoveryCodes.id, row.id));
      return true;
    }
    return false;
  }

  return { generate, consume };
}
