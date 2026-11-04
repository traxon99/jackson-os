import { bigint, pgTable, text } from 'drizzle-orm/pg-core';

export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).notNull(),
  transports: text('transports').notNull(),
  deviceName: text('device_name'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  lastUsedAt: bigint('last_used_at', { mode: 'number' }),
  revokedAt: bigint('revoked_at', { mode: 'number' }),
});

export const sessions = pgTable('sessions', {
  idHash: text('id_hash').primaryKey(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  lastSeenAt: bigint('last_seen_at', { mode: 'number' }).notNull(),
  userAgent: text('user_agent'),
  scope: text('scope', { enum: ['full', 'recovery'] })
    .notNull()
    .default('full'),
});

export const meta = pgTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const recoveryCodes = pgTable('recovery_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull(),
  usedAt: bigint('used_at', { mode: 'number' }),
});
