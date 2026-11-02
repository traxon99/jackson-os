import { randomBytes } from 'node:crypto';
import { recoveryCodes } from '@jos/db';
import { hash, verify } from '@node-rs/argon2';
import { eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

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
  db: BetterSQLite3Database,
  now: () => number = () => Date.now(),
): RecoveryCodesService {
  async function generate(): Promise<string[]> {
    db.delete(recoveryCodes).run();

    const rawCodes: string[] = [];
    for (let i = 0; i < CODE_COUNT; i += 1) {
      const raw = formatRecoveryCode();
      rawCodes.push(raw);
      const codeHash = await hash(raw);
      db.insert(recoveryCodes)
        .values({
          id: randomBytes(16).toString('hex'),
          codeHash,
          usedAt: null,
        })
        .run();
    }
    return rawCodes;
  }

  async function consume(code: string): Promise<boolean> {
    const normalized = code.trim().toLowerCase();
    const rows = db
      .select()
      .from(recoveryCodes)
      .where(isNull(recoveryCodes.usedAt))
      .all();

    for (const row of rows) {
      const matches = await verify(row.codeHash, normalized);
      if (!matches) {
        continue;
      }
      db.update(recoveryCodes)
        .set({ usedAt: now() })
        .where(eq(recoveryCodes.id, row.id))
        .run();
      return true;
    }
    return false;
  }

  return { generate, consume };
}
