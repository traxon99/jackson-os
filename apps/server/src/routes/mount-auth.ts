import type { Hono } from 'hono';
import type { AppStack } from '../app.js';
import { createChallengeStore } from '../auth/challenges.js';
import { readSessionToken } from '../auth/cookie.js';
import { createCredentialsStore } from '../auth/credentials.js';
import { createRecoveryCodesService } from '../auth/recovery-codes.js';
import { createSessionService, type SessionService } from '../auth/sessions.js';
import type { AppConfig } from '../config.js';
import { createGetSession, type GetSession } from '../middleware/auth-gate.js';
import { createAuthLoginRoutes } from './auth-login.js';
import { createAuthRegisterRoutes } from './auth-register.js';
import { mountAuthSessionRoutes } from './auth-session.js';
import { createRecoverRoutes } from './recover.js';

export type AuthServices = { sessions: SessionService; getSession: GetSession };

export function createAuthServices(stack: AppStack): AuthServices {
  const sessions = createSessionService(stack.conn.db, stack.now);
  const getSession = createGetSession((token) => {
    const record = sessions.lookup(token);
    return record === null ? null : { id: record.id, scope: record.scope };
  }, readSessionToken);
  return { sessions, getSession };
}

export function mountAuthRoutes(
  api: Hono,
  stack: AppStack,
  config: Pick<AppConfig, 'RP_ID' | 'APP_ORIGIN' | 'SETUP_TOKEN'> &
    Partial<Pick<AppConfig, 'TRUST_CLOUDFLARE'>>,
  auth: AuthServices,
  log: { warn: (obj: Record<string, unknown>, msg?: string) => void } = {
    warn: () => {},
  },
): void {
  const challenges = createChallengeStore(stack.now);
  const credentials = createCredentialsStore(stack.conn.db);
  const recoveryCodes = createRecoveryCodesService(stack.conn.db, stack.now);
  mountAuthSessionRoutes(api, {
    sessions: auth.sessions,
    getSession: auth.getSession,
  });
  api.route(
    '/auth',
    createAuthRegisterRoutes({
      db: stack.conn.db,
      rpId: config.RP_ID,
      appOrigin: config.APP_ORIGIN,
      setupToken: config.SETUP_TOKEN,
      sessions: auth.sessions,
      challenges,
      credentials,
      recoveryCodes,
      now: stack.now,
    }),
  );
  api.route(
    '/auth',
    createRecoverRoutes({
      db: stack.conn.db,
      sessions: auth.sessions,
      recoveryCodes,
      now: stack.now,
      trustCloudflare: config.TRUST_CLOUDFLARE ?? false,
    }),
  );
  api.route(
    '/auth',
    createAuthLoginRoutes({
      rpId: config.RP_ID,
      appOrigin: config.APP_ORIGIN,
      sessions: auth.sessions,
      challenges,
      credentials,
      now: stack.now,
      log,
    }),
  );
}
