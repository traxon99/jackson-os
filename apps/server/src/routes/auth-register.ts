import { timingSafeEqual } from 'node:crypto';
import { meta } from '@jos/db';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import type { ChallengeStore } from '../auth/challenges.js';
import {
  clearChallengeCookie,
  readChallengeId,
  readSessionToken,
  setChallengeCookie,
  setSessionCookie,
} from '../auth/cookie.js';
import type { CredentialsStore } from '../auth/credentials.js';
import type { RecoveryCodesService } from '../auth/recovery-codes.js';
import type { SessionService } from '../auth/sessions.js';

const SETUP_TOKEN_USED_KEY = 'setup_token_used';

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function setupTokenUsed(db: BetterSQLite3Database): boolean {
  return (
    db.select().from(meta).where(eq(meta.key, SETUP_TOKEN_USED_KEY)).get() !==
    undefined
  );
}

function markSetupTokenUsed(db: BetterSQLite3Database): void {
  db.insert(meta).values({ key: SETUP_TOKEN_USED_KEY, value: '1' }).run();
}

export type AuthRegisterDeps = {
  db: BetterSQLite3Database;
  rpId: string;
  appOrigin: string;
  setupToken?: string;
  sessions: SessionService;
  challenges: ChallengeStore;
  credentials: CredentialsStore;
  recoveryCodes: RecoveryCodesService;
  now: () => number;
};

function registrationAllowed(
  deps: AuthRegisterDeps,
  setupToken: string | undefined,
  sessionScope: 'full' | 'recovery' | null,
): boolean {
  if (sessionScope === 'full' || sessionScope === 'recovery') {
    return true;
  }
  if (deps.credentials.count() > 0) {
    return false;
  }
  if (setupTokenUsed(deps.db)) {
    return false;
  }
  if (
    deps.setupToken === undefined ||
    setupToken === undefined ||
    !tokensEqual(deps.setupToken, setupToken)
  ) {
    return false;
  }
  return true;
}

function readSessionScope(
  deps: AuthRegisterDeps,
  c: Parameters<typeof readSessionToken>[0],
): 'full' | 'recovery' | null {
  const token = readSessionToken(c);
  if (token === undefined) {
    return null;
  }
  const session = deps.sessions.lookup(token);
  if (session === null) {
    return null;
  }
  return session.scope;
}

export function createAuthRegisterRoutes(deps: AuthRegisterDeps): Hono {
  const routes = new Hono();

  routes.post('/register/options', async (c) => {
    let body: { setupToken?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const sessionScope = readSessionScope(deps, c);
    if (!registrationAllowed(deps, body.setupToken, sessionScope)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const issued = deps.challenges.issue('reg');
    setChallengeCookie(c, issued.id);

    const options = await generateRegistrationOptions({
      rpName: 'Jackson OS',
      rpID: deps.rpId,
      userName: 'jackson',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: deps.credentials.list().map((credential) => ({
        id: credential.id,
        transports: JSON.parse(
          credential.transports,
        ) as AuthenticatorTransport[],
      })),
      challenge: issued.challenge,
    });
    deps.challenges.alignChallenge(issued.id, options.challenge);

    return c.json(options);
  });

  routes.post('/register/verify', async (c) => {
    let body: { setupToken?: string; response?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Bad Request' }, 400);
    }

    const sessionScope = readSessionScope(deps, c);
    if (!registrationAllowed(deps, body.setupToken, sessionScope)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const challengeId = readChallengeId(c);
    if (challengeId === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }
    const expectedChallenge = deps.challenges.consume(challengeId, 'reg');
    clearChallengeCookie(c);
    if (expectedChallenge === null) {
      return c.json({ error: 'Not Found' }, 404);
    }

    if (body.response === undefined) {
      return c.json({ error: 'Bad Request' }, 400);
    }

    const verification = await verifyRegistrationResponse({
      response: body.response as never,
      expectedChallenge,
      expectedOrigin: deps.appOrigin,
      expectedRPID: deps.rpId,
    });

    if (!verification.verified || verification.registrationInfo === undefined) {
      return c.json({ error: 'Bad Request' }, 400);
    }

    const { credential } = verification.registrationInfo;
    const isFirstCredential = deps.credentials.count() === 0;
    const recoverySessionToken = readSessionToken(c);
    const isRecoveryFlow =
      sessionScope === 'recovery' && recoverySessionToken !== undefined;

    deps.credentials.insert({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: JSON.stringify(credential.transports ?? []),
      deviceName: null,
      createdAt: deps.now(),
      lastUsedAt: null,
    });

    if (isFirstCredential) {
      markSetupTokenUsed(deps.db);
    }

    const fullToken = deps.sessions.create({
      userAgent: c.req.header('user-agent') ?? undefined,
      scope: 'full',
    });
    setSessionCookie(c, fullToken);

    if (isRecoveryFlow && recoverySessionToken !== undefined) {
      deps.sessions.revokeAllExcept(fullToken);
      deps.sessions.revoke(recoverySessionToken);
    }

    let generatedRecoveryCodes: string[] | undefined;
    if (isFirstCredential) {
      generatedRecoveryCodes = await deps.recoveryCodes.generate();
    }

    return c.json({
      ok: true,
      ...(generatedRecoveryCodes !== undefined
        ? { recoveryCodes: generatedRecoveryCodes }
        : {}),
    });
  });

  return routes;
}
