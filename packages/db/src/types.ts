import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema/index.js';

export type JosSchema = typeof schema;

export type JosDatabase =
  | PostgresJsDatabase<JosSchema>
  | PgliteDatabase<JosSchema>;
