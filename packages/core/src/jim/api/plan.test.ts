import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getPlan, jimPlanSchema } from './plan.js';

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

const emptyPlanFixture = {
  scheduled: [],
  next: null,
};

describe('jim plan', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture with scheduled and next', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'plan.json'), 'utf8'),
    );
    const parsed = jimPlanSchema.parse(json);
    expect(parsed.scheduled).toHaveLength(3);
    expect(parsed.next?.routineName).toBe('Push A');
  });

  it('parses empty plan fixture', () => {
    expect(jimPlanSchema.parse(emptyPlanFixture).next).toBeNull();
  });

  it('clamps days to 14', async () => {
    const fetchImpl = vi.fn(async () => Response.json(emptyPlanFixture));
    await getPlan(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      { days: 30 },
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/plan?days=14',
    );
  });
});
