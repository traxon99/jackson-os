import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getWeeks, jimWeeksSchema } from './weeks.js';

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

describe('jim weeks', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'weeks.json'), 'utf8'),
    );
    const parsed = jimWeeksSchema.parse(json);
    expect(parsed.weeks).toHaveLength(2);
    expect(parsed.weeks[1]?.workouts).toBe(0);
  });

  it('builds query with weeks=2 and no goal by default', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ weeks: [] }));
    await getWeeks(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/weeks?weeks=2',
    );
  });

  it('clamps weeks to 12', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ weeks: [] }));
    await getWeeks(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      { weeks: 40 },
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/weeks?weeks=12',
    );
  });
});
