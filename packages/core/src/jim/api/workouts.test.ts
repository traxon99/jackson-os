import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { jimWorkoutsListSchema, listWorkouts } from './workouts.js';

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

describe('jim workouts list', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'workouts.json'), 'utf8'),
    );
    const parsed = jimWorkoutsListSchema.parse(json);
    expect(parsed.workouts[0]?.prCount).toBe(2);
    expect(parsed.workouts[1]?.gym).toBeNull();
  });

  it('builds query with default limit and optional dates', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ workouts: [] }));
    await listWorkouts(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      {
        from: '2026-01-01',
        to: '2026-01-31',
        limit: 100,
      },
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/workouts?from=2026-01-01&to=2026-01-31&limit=50',
    );
  });
});
