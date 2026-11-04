import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { CHALLENGE_COOKIE_NAME, SESSION_COOKIE_NAME } from '../auth/cookie.js';
import { createCredentialsStore } from '../auth/credentials.js';
import { createTestConn } from '../test-db.js';
import { createAuthServices } from './mount-auth.js';

const testOrigin = 'http://127.0.0.1';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(
    async (input: { challenge: string; allowCredentials: unknown[] }) => ({
      challenge: input.challenge,
      allowCredentials: input.allowCredentials,
    }),
  ),
  verifyAuthenticationResponse: vi.fn(),
}));

import { verifyAuthenticationResponse } from '@simplewebauthn/server';

async function postInit() {
  const { conn, cleanup: dbCleanup } = await createTestConn();
  const webDist = mkdtempSync(join(tmpdir(), 'jos-web-'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html>');
  const now = () => 1_000_000;
  const stack = {
    conn,
    registry: { getSource: () => undefined } as never,
    store: {} as never,
    runner: {} as never,
    scheduler: { stop: () => {} } as never,
    enabled: () => false,
    getSourceConfig: () => ({}),
    now,
  };
  const auth = createAuthServices(stack);
  const credentials = createCredentialsStore(conn.db);
  const app = createApp({
    WEB_DIST: webDist,
    APP_ORIGIN: testOrigin,
    auth,
    authConfig: {
      RP_ID: 'localhost',
      APP_ORIGIN: testOrigin,
      SETUP_TOKEN: '01234567890123456789012345678901',
      TRUST_CLOUDFLARE: false,
    },
    stack,
  });

  return {
    app,
    conn,
    credentials,
    cleanup: async () => {
      await dbCleanup();
      rmSync(webDist, { recursive: true, force: true });
    },
  };
}

async function loginOptions(app: ReturnType<typeof createApp>) {
  return app.request('/api/auth/login/options', {
    method: 'POST',
    headers: { Origin: testOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

function challengeCookie(response: Response): string {
  const match = response.headers
    .get('set-cookie')
    ?.match(/__Host-chal=([^;]+)/)?.[1];
  if (match === undefined) {
    throw new Error('missing challenge cookie');
  }
  return match;
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.mocked(verifyAuthenticationResponse).mockReset();
  });

  it('returns 401 for an unknown credential', async () => {
    const { app, cleanup } = await postInit();
    try {
      const options = await loginOptions(app);
      const chal = challengeCookie(options);

      const response = await app.request('/api/auth/login/verify', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: `${CHALLENGE_COOKIE_NAME}=${chal}`,
        },
        body: JSON.stringify({ response: { id: 'missing-cred' } }),
      });
      expect(response.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it('returns 401 when the signature counter regresses', async () => {
    const { app, credentials, cleanup } = await postInit();
    try {
      await credentials.insert({
        id: 'cred-1',
        publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
        counter: 5,
        transports: '[]',
        deviceName: null,
        createdAt: 1,
        lastUsedAt: null,
      });

      vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
        verified: true,
        authenticationInfo: {
          newCounter: 5,
          credentialID: 'cred-1',
          userVerified: true,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: testOrigin,
          rpID: 'localhost',
        },
      });

      const options = await loginOptions(app);
      const chal = challengeCookie(options);

      const response = await app.request('/api/auth/login/verify', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: `${CHALLENGE_COOKIE_NAME}=${chal}`,
        },
        body: JSON.stringify({ response: { id: 'cred-1' } }),
      });
      expect(response.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it('returns 401 when the challenge is replayed', async () => {
    const { app, credentials, cleanup } = await postInit();
    try {
      await credentials.insert({
        id: 'cred-2',
        publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
        counter: 0,
        transports: '[]',
        deviceName: null,
        createdAt: 1,
        lastUsedAt: null,
      });

      vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
        verified: true,
        authenticationInfo: {
          newCounter: 1,
          credentialID: 'cred-2',
          userVerified: true,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: testOrigin,
          rpID: 'localhost',
        },
      });

      const options = await loginOptions(app);
      const chal = challengeCookie(options);
      const cookie = `${CHALLENGE_COOKIE_NAME}=${chal}`;

      const first = await app.request('/api/auth/login/verify', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({ response: { id: 'cred-2' } }),
      });
      expect(first.status).toBe(200);
      expect(first.headers.get('set-cookie')).toContain(SESSION_COOKIE_NAME);

      const replay = await app.request('/api/auth/login/verify', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({ response: { id: 'cred-2' } }),
      });
      expect(replay.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it('returns 401 for a revoked credential', async () => {
    const { app, credentials, cleanup } = await postInit();
    try {
      await credentials.insert({
        id: 'cred-revoked',
        publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
        counter: 0,
        transports: '[]',
        deviceName: null,
        createdAt: 1,
        lastUsedAt: null,
        revokedAt: 999,
      });

      const options = await loginOptions(app);
      const chal = challengeCookie(options);

      const response = await app.request('/api/auth/login/verify', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: `${CHALLENGE_COOKIE_NAME}=${chal}`,
        },
        body: JSON.stringify({ response: { id: 'cred-revoked' } }),
      });
      expect(response.status).toBe(401);
    } finally {
      await cleanup();
    }
  });
});
