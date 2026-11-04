import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getBackend, jimBackendSchema } from './backend.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures',
);

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

describe('jim backend', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture with all four providers', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'backend.json'), 'utf8'),
    );
    const parsed = jimBackendSchema.parse(json);
    expect(parsed.services.map((service) => service.id)).toEqual([
      'vercel',
      'supabase',
      'cloudflare',
      'fly',
    ]);
  });

  it('getBackend calls /v1/backend with fixture response', async () => {
    const fixture = readFileSync(join(fixturesDir, 'backend.json'), 'utf8');
    const fetchImpl = vi.fn(async () => Response.json(JSON.parse(fixture)));
    const result = await getBackend(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://jim.example.com/v1/backend');
    expect(result.services.find((service) => service.id === 'fly')?.app).toBe(
      'jim-mcp',
    );
  });
});
