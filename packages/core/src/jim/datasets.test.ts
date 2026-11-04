import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../contracts.js';
import { type JimLifts, jimLiftsSchema } from './api/lifts.js';
import type { JimConfig } from './config.js';
import { jimAdapter } from './index.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const config: JimConfig = {
  baseUrl: 'https://jim.example.com',
  token: 'jim_pat_test',
};

const fixedNow = new Date('2026-03-15T12:00:00.000Z');

function jimContext(
  fetchImpl: AdapterContext<JimConfig>['fetch'],
  now: Date = fixedNow,
): AdapterContext<JimConfig> {
  return {
    config,
    fetch: fetchImpl,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    now: () => now,
    signal: new AbortController().signal,
  };
}

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
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

describe('jim adapter datasets', () => {
  const training = jimAdapter.datasets.training;
  const workouts = jimAdapter.datasets.workouts;
  const prs = jimAdapter.datasets.prs;
  const lifts = jimAdapter.datasets.lifts;
  const body = jimAdapter.datasets.body;
  const next = jimAdapter.datasets.next;

  if (
    training === undefined ||
    workouts === undefined ||
    prs === undefined ||
    lifts === undefined ||
    body === undefined ||
    next === undefined
  ) {
    throw new Error('expected jim adapter datasets');
  }

  it('training output passes schema and toMetrics emits 6 points', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/v1/weeks')) {
        return Response.json(loadFixture('weeks.json'));
      }
      if (url.includes('/v1/streak')) {
        return Response.json(loadFixture('streak.json'));
      }
      return Response.json({}, { status: 404 });
    });

    const data = await training.fetch(
      jimContext(fetchImpl as unknown as AdapterContext<JimConfig>['fetch']),
    );
    expect(() => training.schema.parse(data)).not.toThrow();
    const metrics = training.toMetrics?.(data, fixedNow);
    expect(metrics).toHaveLength(6);
  });

  it('training throws when a parallel call fails', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/v1/weeks')) {
        return Response.json(loadFixture('weeks.json'));
      }
      return Response.json({ error: 'fail' }, { status: 500 });
    });

    await expect(
      training.fetch(
        jimContext(fetchImpl as unknown as AdapterContext<JimConfig>['fetch']),
      ),
    ).rejects.toThrow();
  });

  it('prs sends since exactly 30 days before ctx.now()', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ prs: [] }));
    await prs.fetch(
      jimContext(fetchImpl as unknown as AdapterContext<JimConfig>['fetch']),
    );
    const url = fetchUrl(fetchImpl);
    expect(url).toContain('since=2026-02-13');
  });

  it('workouts and prs outputs pass schemas with fixtures', async () => {
    const workoutsFetch = vi.fn(async () =>
      Response.json(loadFixture('workouts.json')),
    );
    const workoutsData = await workouts.fetch(
      jimContext(
        workoutsFetch as unknown as AdapterContext<JimConfig>['fetch'],
      ),
    );
    expect(() => workouts.schema.parse(workoutsData)).not.toThrow();

    const prsFetch = vi.fn(async () => Response.json(loadFixture('prs.json')));
    const prsData = await prs.fetch(
      jimContext(prsFetch as unknown as AdapterContext<JimConfig>['fetch']),
    );
    expect(() => prs.schema.parse(prsData)).not.toThrow();
  });

  it('lifts emits one metric per lift and body emits one metric', async () => {
    const liftsFetch = vi.fn(async () =>
      Response.json(loadFixture('lifts.json')),
    );
    const liftsData: JimLifts = jimLiftsSchema.parse(
      await lifts.fetch(
        jimContext(liftsFetch as unknown as AdapterContext<JimConfig>['fetch']),
      ),
    );
    const liftMetrics = lifts.toMetrics?.(liftsData, fixedNow);
    expect(liftMetrics?.length).toBe(liftsData.lifts.length);

    const bodyFetch = vi.fn(async () =>
      Response.json(loadFixture('body.json')),
    );
    const bodyData = await body.fetch(
      jimContext(bodyFetch as unknown as AdapterContext<JimConfig>['fetch']),
    );
    expect(() => body.schema.parse(bodyData)).not.toThrow();
    const bodyMetrics = body.toMetrics?.(bodyData, fixedNow);
    expect(bodyMetrics).toHaveLength(1);

    const emptyFetch = vi.fn(async () => Response.json(emptyBodyFixture));
    const emptyBody = await body.fetch(
      jimContext(emptyFetch as unknown as AdapterContext<JimConfig>['fetch']),
    );
    const emptyMetrics = body.toMetrics?.(emptyBody, fixedNow);
    expect(emptyMetrics).toHaveLength(0);
  });

  it('next passes schema with full and empty fixtures', async () => {
    const fullFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/v1/plan')) {
        return Response.json(loadFixture('plan.json'));
      }
      if (url.includes('/v1/dpr')) {
        return Response.json(loadFixture('dpr.json'));
      }
      return Response.json({}, { status: 404 });
    });
    const full = await next.fetch(
      jimContext(fullFetch as unknown as AdapterContext<JimConfig>['fetch']),
    );
    expect(() => next.schema.parse(full)).not.toThrow();

    const emptyFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/v1/plan')) {
        return Response.json({ scheduled: [], next: null });
      }
      if (url.includes('/v1/dpr')) {
        return Response.json({ block: null });
      }
      return Response.json({}, { status: 404 });
    });
    const empty = await next.fetch(
      jimContext(emptyFetch as unknown as AdapterContext<JimConfig>['fetch']),
    );
    expect(() => next.schema.parse(empty)).not.toThrow();
  });

  it('has no actions (read-only adapter)', () => {
    expect(jimAdapter.actions).toBeUndefined();
  });
});
