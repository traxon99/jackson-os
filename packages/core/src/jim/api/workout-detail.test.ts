import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import { UpstreamError } from '../../errors.js';
import type { JimConfig } from '../config.js';
import { getWorkout, jimWorkoutDetailSchema } from './workout-detail.js';

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

describe('jim workout detail', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'workout-detail.json'), 'utf8'),
    );
    expect(jimWorkoutDetailSchema.parse(json).exercises).toHaveLength(2);
  });

  it('encodes id with slash', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        JSON.parse(
          readFileSync(join(fixturesDir, 'workout-detail.json'), 'utf8'),
        ),
      ),
    );
    await getWorkout(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
      'abc/def',
    );

    expect(fetchUrl(fetchImpl)).toBe(
      'https://jim.example.com/v1/workouts/abc%2Fdef',
    );
  });

  it('throws UpstreamError on 404', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { code: 'not_found', message: 'workout not found' } },
        { status: 404 },
      ),
    );

    await expect(
      getWorkout(
        jimContext(
          fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
          config,
        ),
        'missing',
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
    await expect(
      getWorkout(
        jimContext(
          fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
          config,
        ),
        'missing',
      ),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
