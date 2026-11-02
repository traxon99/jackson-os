import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const webauthnCredentials = sqliteTable('webauthn_credentials', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull(),
  transports: text('transports').notNull(),
  deviceName: text('device_name'),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
});

export const sessions = sqliteTable('sessions', {
  idHash: text('id_hash').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  userAgent: text('user_agent'),
  scope: text('scope', { enum: ['full', 'recovery'] })
    .notNull()
    .default('full'),
});

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const recoveryCodes = sqliteTable('recovery_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull(),
  usedAt: integer('used_at'),
});
