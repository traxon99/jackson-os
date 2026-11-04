import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AdapterContext } from '../contracts.js';
import { UpstreamError } from '../errors.js';
import { jimGet } from './client.js';
import type { JimConfig } from './config.js';

const responseSchema = z.object({ ok: z.boolean() });

function jimContext(
  fetchImpl: AdapterContext<JimConfig>['fetch'],
  config: JimConfig,
): AdapterContext<JimConfig> {
  return {
    config,
    fetch: fetchImpl,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    signal: new AbortController().signal,
  };
}

describe('jimGet', () => {
  const token = 'jim_pat_super_secret_value';
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token,
  };

  it('builds URL, query, and Authorization header', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const ctx = jimContext(
      fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
      config,
    );
    await jimGet(ctx, '/v1/status', responseSchema, {
      limit: 5,
      skip: undefined,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://jim.example.com/v1/status?limit=5');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    });
    expect(init.signal).toBe(ctx.signal);
  });

  it('throws UpstreamError for 401 with error code', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { code: 'unauthorized', message: 'invalid token' } },
        { status: 401 },
      ),
    ) as AdapterContext<JimConfig>['fetch'];

    await expect(
      jimGet(jimContext(fetchImpl, config), '/v1/me', responseSchema),
    ).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
  });

  it('maps Retry-After seconds to retryAfterMs', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'rate_limited', message: 'slow down' },
          }),
          {
            status: 429,
            headers: {
              'Retry-After': '120',
              'Content-Type': 'application/json',
            },
          },
        ),
    ) as AdapterContext<JimConfig>['fetch'];

    await expect(
      jimGet(jimContext(fetchImpl, config), '/v1/workouts', responseSchema),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterMs: 120_000,
    });
  });

  it('throws on schema mismatch', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ unexpected: true }),
    ) as AdapterContext<JimConfig>['fetch'];

    await expect(
      jimGet(jimContext(fetchImpl, config), '/v1/status', responseSchema),
    ).rejects.toThrow('jim: unexpected response shape for /v1/status');
  });

  it('does not fetch when token is empty', async () => {
    const fetchImpl = vi.fn() as AdapterContext<JimConfig>['fetch'];

    await expect(
      jimGet(
        jimContext(fetchImpl, { ...config, token: '' }),
        '/v1/status',
        responseSchema,
      ),
    ).rejects.toBeInstanceOf(UpstreamError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never includes the token in thrown error messages', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { code: 'unauthorized', message: 'invalid token' } },
        { status: 401 },
      ),
    ) as AdapterContext<JimConfig>['fetch'];

    try {
      await jimGet(jimContext(fetchImpl, config), '/v1/me', responseSchema);
      expect.fail('expected throw');
    } catch (error) {
      expect(String(error)).not.toContain(token);
    }
  });
});
