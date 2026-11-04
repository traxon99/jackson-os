import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../contracts.js';
import type { JimConfig } from '../config.js';
import { getStatus, jimStatusSchema } from './status.js';

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

describe('jim status', () => {
  const config: JimConfig = {
    baseUrl: 'https://jim.example.com',
    token: 'jim_pat_test',
  };

  it('parses the fixture', () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, 'status.json'), 'utf8'),
    );
    expect(jimStatusSchema.parse(json).user.username).toBe('jackson');
  });

  it('parses null activeWorkout and lastSyncedAt', () => {
    expect(
      jimStatusSchema.parse({
        user: {
          username: 'a',
          units: 'kg',
          weekStart: 0,
          timeZone: 'UTC',
        },
        lastSyncedAt: null,
        activeWorkout: null,
        tokenScope: 'read_write',
      }).lastSyncedAt,
    ).toBeNull();
  });

  it('getStatus calls /v1/status with fixture response', async () => {
    const fixture = readFileSync(join(fixturesDir, 'status.json'), 'utf8');
    const fetchImpl = vi.fn(async () => Response.json(JSON.parse(fixture)));
    const result = await getStatus(
      jimContext(
        fetchImpl as unknown as AdapterContext<JimConfig>['fetch'],
        config,
      ),
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://jim.example.com/v1/status');
    expect(result.activeWorkout?.name).toBe('Push A');
  });
});
