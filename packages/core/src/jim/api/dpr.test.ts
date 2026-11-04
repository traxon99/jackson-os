import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getDpr, jimDprSchema } from './dpr.js';

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

describe('jim dpr', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses block fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'dpr.json'), 'utf8'),
    );
    const parsed = jimDprSchema.parse(json);
    expect(parsed.block?.week).toBe(3);
    expect(parsed.block?.lifts).toHaveLength(3);
  });

  it('parses null block', () => {
    expect(jimDprSchema.parse({ block: null }).block).toBeNull();
  });

  it('getDpr calls /v1/dpr', async () => {
    const fixture = readFileSync(join(fixturesDir, 'dpr.json'), 'utf8');
    const fetchImpl = vi.fn(async () => Response.json(JSON.parse(fixture)));
    await getDpr(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
    );

    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://jim.example.com/v1/dpr');
  });
});
