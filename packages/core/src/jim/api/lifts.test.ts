import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getLifts, jimLiftsSchema } from './lifts.js';

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

describe('jim lifts', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'lifts.json'), 'utf8'),
    );
    const parsed = jimLiftsSchema.parse(json);
    expect(parsed.selection).toBe('most_trained');
    expect(parsed.lifts).toHaveLength(4);
    expect(parsed.lifts[0]?.series).toHaveLength(20);
  });

  it('sends exercises=a,b when two ids given', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ selection: 'explicit', lifts: [] }),
    );
    await getLifts(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      {
        exercises: ['a', 'b'],
      },
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/lifts?exercises=a%2Cb',
    );
  });

  it('omits exercises param for empty list', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ selection: 'most_trained', lifts: [] }),
    );
    await getLifts(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      { exercises: [] },
    );

    expect(fetchUrl(fetchImpl)).toBe('https://jim.example.com/v1/lifts');
  });
});
