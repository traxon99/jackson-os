import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getBodyMeasurements, jimBodySchema } from './body.js';

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

const emptyBodyFixture = {
  kinds: [
    {
      kind: 'bodyweight',
      latest: null,
      change: null,
      points: [],
    },
  ],
};

describe('jim body measurements', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture with many points', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'body.json'), 'utf8'),
    );
    const parsed = jimBodySchema.parse(json);
    expect(parsed.kinds[0]?.points.length).toBeGreaterThanOrEqual(30);
  });

  it('parses empty range fixture', () => {
    expect(jimBodySchema.parse(emptyBodyFixture).kinds[0]?.latest).toBeNull();
  });

  it('builds query with default bodyweight kind', async () => {
    const fetchImpl = vi.fn(async () => Response.json(emptyBodyFixture));
    await getBodyMeasurements(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      {
        from: '2026-01-01',
        to: '2026-03-01',
      },
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/body-measurements?kinds=bodyweight&from=2026-01-01&to=2026-03-01',
    );
  });
});
