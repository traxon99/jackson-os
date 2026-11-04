import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { CHALLENGE_COOKIE_NAME, SESSION_COOKIE_NAME } from '../auth/cookie.js';
import { createTestConn } from '../test-db.js';
import { createAuthServices } from './mount-auth.js';

const setupToken = '01234567890123456789012345678901';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(async (input: { challenge: string }) => ({
    challenge: input.challenge,
    rp: { name: 'Jackson OS', id: 'localhost' },
  })),
  verifyRegistrationResponse: vi.fn(),
}));

import { verifyRegistrationResponse } from '@simplewebauthn/server';

const testOrigin = 'http://127.0.0.1';

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
  const app = createApp({
    WEB_DIST: webDist,
    APP_ORIGIN: testOrigin,
    auth,
    authConfig: {
      RP_ID: 'localhost',
      APP_ORIGIN: testOrigin,
      SETUP_TOKEN: setupToken,
      TRUST_CLOUDFLARE: false,
    },
    stack,
  });

  return {
    app,
    conn,
    auth,
    cleanup: async () => {
      await dbCleanup();
      rmSync(webDist, { recursive: true, force: true });
    },
  };
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.mocked(verifyRegistrationResponse).mockReset();
  });

  it('returns 404 without a setup token when no credentials exist', async () => {
    const { app, cleanup } = await postInit();
    try {
      const response = await app.request('/api/auth/register/options', {
        method: 'POST',
        headers: { Origin: testOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(404);
    } finally {
      await cleanup();
    }
  });

  it('returns 200 with the correct setup token and zero credentials', async () => {
    const { app, cleanup } = await postInit();
    try {
      const response = await app.request('/api/auth/register/options', {
        method: 'POST',
        headers: { Origin: testOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toContain(
        CHALLENGE_COOKIE_NAME,
      );
    } finally {
      await cleanup();
    }
  });

  it('returns 404 when reusing the setup token after first registration', async () => {
    const { app, auth, cleanup } = await postInit();
    try {
      vi.mocked(verifyRegistrationResponse).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-1',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: [],
          },
          aaguid: '00000000-0000-0000-0000-000000000000',
          fmt: 'none',
          credentialType: 'public-key',
          attestationObject: new Uint8Array(),
          userVerified: true,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: testOrigin,
          rpID: 'localhost',
        },
      });

      const options = await app.request('/api/auth/register/options', {
        method: 'POST',
        headers: { Origin: testOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken }),
      });
      const chal = options.headers
        .get('set-cookie')
        ?.match(/__Host-chal=([^;]+)/)?.[1];

      const verify = await app.request('/api/auth/register/verify', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: `${CHALLENGE_COOKIE_NAME}=${chal}`,
        },
        body: JSON.stringify({ setupToken, response: { id: 'cred-1' } }),
      });
      expect(verify.status).toBe(200);

      const retry = await app.request('/api/auth/register/options', {
        method: 'POST',
        headers: { Origin: testOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken }),
      });
      expect(retry.status).toBe(404);

      const sessionToken = await auth.sessions.create({ scope: 'full' });
      const signedIn = await app.request('/api/auth/register/options', {
        method: 'POST',
        headers: {
          Origin: testOrigin,
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({}),
      });
      expect(signedIn.status).toBe(200);
    } finally {
      await cleanup();
    }
  });
});
