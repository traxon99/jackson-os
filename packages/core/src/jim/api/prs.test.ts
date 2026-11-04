import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { jimPrsListSchema, listPrs } from './prs.js';

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

function fetchUrl(fetchImpl: ReturnType<typeof vi.fn>): string {
  const call = fetchImpl.mock.calls[0];
  expect(call).toBeDefined();
  const [url] = call as unknown as [string, RequestInit];
  return url;
}

describe('jim prs', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'prs.json'), 'utf8'),
    );
    const parsed = jimPrsListSchema.parse(json);
    expect(parsed.prs[1]?.previousValue).toBeNull();
    expect(parsed.prs[0]?.tier).toBe('intermediate');
  });

  it('builds query with since and clamped limit', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ prs: [] }));
    await listPrs(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      {
        since: '2026-01-01',
        limit: 99,
      },
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/prs?since=2026-01-01&limit=50',
    );
  });
});
