import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { actionLog, sessions as sessionsTable } from '@jos/db';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createRecoveryCodesService } from '../auth/recovery-codes.js';
import {
  createTestStack,
  destroyTestStack,
  type TestStack,
  testSessionHeaders,
} from '../test-helpers.js';
import { createAuthServices } from './mount-auth.js';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(async (i: { challenge: string }) => ({
    challenge: i.challenge,
  })),
  verifyRegistrationResponse: vi.fn(),
}));
const testOrigin = 'http://127.0.0.1';
const setupToken = 'a'.repeat(32);
function authHeaders(cookie?: string) {
  return {
    Origin: testOrigin,
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
  };
}
function mountFullAuth(stack: TestStack, webDist: string) {
  const appStack = {
    conn: stack.conn,
    registry: stack.registry,
    store: stack.store,
    runner: stack.runner,
    scheduler: stack.scheduler,
    enabled: () => true,
    getSourceConfig: () => ({}),
    now: () => Date.now(),
  };
  stack.app = createApp({
    WEB_DIST: webDist,
    APP_ORIGIN: testOrigin,
    auth: createAuthServices(appStack),
    authConfig: {
      RP_ID: 'localhost',
      APP_ORIGIN: testOrigin,
      SETUP_TOKEN: setupToken,
      TRUST_CLOUDFLARE: false,
    },
    stack: appStack,
  });
}
describe('POST /api/auth/recover', () => {
  it('returns 403 for widget access with a recovery session', async () => {
    const webDist = mkdtempSync(join(tmpdir(), 'w'));
    const stack = createTestStack({
      WEB_DIST: webDist,
      APP_ORIGIN: testOrigin,
    });
    mountFullAuth(stack, webDist);
    const codes = await createRecoveryCodesService(
      stack.conn.db,
      stack.now,
    ).generate();
    const code = codes[0];
    expect(code).toBeDefined();
    try {
      const recover = await stack.app.request('/api/auth/recover', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code }),
      });
      expect(recover.status).toBe(200);
      const cookie = recover.headers.get('set-cookie')?.split(';')[0] ?? '';
      const widget = await stack.app.request('/api/widgets/demo.clock', {
        headers: { ...testSessionHeaders, Cookie: cookie },
      });
      expect(widget.status).toBe(403);
    } finally {
      destroyTestStack(stack);
    }
  });
  it('logs a failed recovery attempt', async () => {
    const webDist = mkdtempSync(join(tmpdir(), 'w'));
    const stack = createTestStack({
      WEB_DIST: webDist,
      APP_ORIGIN: testOrigin,
    });
    mountFullAuth(stack, webDist);
    try {
      await stack.app.request('/api/auth/recover', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: 'bad' }),
      });
      const rows = stack.conn.db.select().from(actionLog).all();
      expect(
        rows.some((r) => r.action === 'recover' && r.result === 'fail'),
      ).toBe(true);
    } finally {
      destroyTestStack(stack);
    }
  });
  it('leaves one full session after recovery registration', async () => {
    vi.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-id',
          publicKey: new Uint8Array([1]),
          counter: 0,
          transports: [],
        },
      },
    } as never);
    const webDist = mkdtempSync(join(tmpdir(), 'w'));
    const stack = createTestStack({
      WEB_DIST: webDist,
      APP_ORIGIN: testOrigin,
    });
    mountFullAuth(stack, webDist);
    const codes = await createRecoveryCodesService(
      stack.conn.db,
      stack.now,
    ).generate();
    const code = codes[0];
    try {
      const recover = await stack.app.request('/api/auth/recover', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code }),
      });
      expect(recover.status).toBe(200);
      const rc = recover.headers.get('set-cookie')?.split(';')[0] ?? '';
      const options = await stack.app.request('/api/auth/register/options', {
        method: 'POST',
        headers: authHeaders(rc),
        body: '{}',
      });
      expect(options.status).toBe(200);
      const cc = options.headers.get('set-cookie')?.split(';')[0] ?? '';
      const verify = await stack.app.request('/api/auth/register/verify', {
        method: 'POST',
        headers: authHeaders(`${rc}; ${cc}`),
        body: JSON.stringify({ response: { id: 'cred-id' } }),
      });
      expect(verify.status).toBe(200);
      expect(stack.conn.db.select().from(sessionsTable).all()).toHaveLength(1);
    } finally {
      destroyTestStack(stack);
    }
  });
});
