import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import {
  closeDb,
  meta,
  openDb,
  recoveryCodes,
  runMigrations,
  sessions,
  webauthnCredentials,
} from '@jos/db';
import { eq } from 'drizzle-orm';
import { loadConfig } from './config.js';

const SETUP_TOKEN_USED_KEY = 'setup_token_used';

async function confirmReset(): Promise<void> {
  const rl = createInterface({ input, output });
  const answer = await rl.question('Type RESET to continue: ');
  rl.close();
  if (answer !== 'RESET') {
    console.error('Aborted.');
    process.exit(1);
  }
}

export async function resetAuth(
  env: Record<string, string | undefined>,
  options: { yes?: boolean },
): Promise<string> {
  if (!options.yes) {
    await confirmReset();
  }

  const config = loadConfig(env);
  const dbPath = join(config.DATA_DIR, 'app.db');
  const conn = openDb(dbPath);
  runMigrations(conn.db);

  conn.db.delete(webauthnCredentials).run();
  conn.db.delete(sessions).run();
  conn.db.delete(recoveryCodes).run();
  conn.db.delete(meta).where(eq(meta.key, SETUP_TOKEN_USED_KEY)).run();

  const token = randomBytes(32).toString('hex');

  closeDb(conn);

  console.log('');
  console.log('Auth state cleared (credentials, sessions, recovery codes).');
  console.log('');
  console.log('New SETUP_TOKEN (shown once):');
  console.log(token);
  console.log('');
  console.log(
    'Set SETUP_TOKEN to this value, restart the server, then open /setup in the browser.',
  );
  console.log(`APP_ORIGIN is configured as ${config.APP_ORIGIN}`);

  return token;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command !== 'reset-auth') {
    console.error('Usage: admin reset-auth [--yes]');
    process.exit(1);
  }
  const yes = args.includes('--yes');
  await resetAuth(process.env, { yes });
}

const invokedDirectly =
  process.argv[1]?.endsWith('/admin.ts') ||
  process.argv[1]?.endsWith('/admin.js');

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
