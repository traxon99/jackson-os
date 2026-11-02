import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import type { ChallengeStore } from '../auth/challenges.js';
import {
  clearChallengeCookie,
  readChallengeId,
  setChallengeCookie,
  setSessionCookie,
} from '../auth/cookie.js';
import type { CredentialsStore } from '../auth/credentials.js';
import type { SessionService } from '../auth/sessions.js';

export type AuthLoginLog = {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
};

export type AuthLoginDeps = {
  rpId: string;
  appOrigin: string;
  sessions: SessionService;
  challenges: ChallengeStore;
  credentials: CredentialsStore;
  now: () => number;
  log?: AuthLoginLog;
};

export function createAuthLoginRoutes(deps: AuthLoginDeps): Hono {
  const routes = new Hono();
  const log = deps.log ?? { warn: () => {} };

  routes.post('/login/options', async (c) => {
    const issued = deps.challenges.issue('auth');
    setChallengeCookie(c, issued.id);

    const options = await generateAuthenticationOptions({
      rpID: deps.rpId,
      userVerification: 'required',
      allowCredentials: [],
      challenge: issued.challenge,
    });

    return c.json(options);
  });

  routes.post('/login/verify', async (c) => {
    let body: { response?: { id?: string } & Record<string, unknown> } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const credentialId = body.response?.id;
    if (credentialId === undefined) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const stored = deps.credentials.getById(credentialId);
    if (stored === undefined || stored.revokedAt !== null) {
      log.warn({ credentialId }, 'WebAuthn authentication failed');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const challengeId = readChallengeId(c);
    if (challengeId === undefined) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const expectedChallenge = deps.challenges.consume(challengeId, 'auth');
    clearChallengeCookie(c);
    if (expectedChallenge === null) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (body.response === undefined) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const verification = await verifyAuthenticationResponse({
      response: body.response as never,
      expectedChallenge,
      expectedOrigin: deps.appOrigin,
      expectedRPID: deps.rpId,
      credential: {
        id: stored.id,
        publicKey: Buffer.from(stored.publicKey, 'base64url'),
        counter: stored.counter,
        transports: JSON.parse(stored.transports) as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      log.warn({ credentialId }, 'WebAuthn authentication failed');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const newCounter = verification.authenticationInfo.newCounter;
    if (stored.counter !== 0 && newCounter <= stored.counter) {
      log.warn({ credentialId }, 'WebAuthn authentication failed');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    deps.credentials.updateAfterUse(credentialId, newCounter, deps.now());

    const fullToken = deps.sessions.create({
      userAgent: c.req.header('user-agent') ?? undefined,
      scope: 'full',
    });
    setSessionCookie(c, fullToken);

    return c.json({ ok: true });
  });

  return routes;
}
