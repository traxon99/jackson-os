import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getStreak, jimStreakSchema } from './streak.js';

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

describe('jim streak', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'streak.json'), 'utf8'),
    );
    expect(jimStreakSchema.parse(json).longest).toBe(11);
  });

  it('getStreak calls /v1/streak', async () => {
    const fixture = readFileSync(join(fixturesDir, 'streak.json'), 'utf8');
    const fetchImpl = vi.fn(async () => Response.json(JSON.parse(fixture)));
    await getStreak(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
    );

    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://jim.example.com/v1/streak');
  });
});
