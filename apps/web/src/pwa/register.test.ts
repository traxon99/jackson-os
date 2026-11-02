import { describe, expect, it } from 'vitest';
import { nextSwUpdateCheck, SW_UPDATE_INTERVAL_MS } from './register.js';

describe('nextSwUpdateCheck', () => {
  it('throttles registration.update to once every 30 minutes', () => {
    const t0 = 1_000_000;
    const first = nextSwUpdateCheck(t0, 0);
    expect(first.shouldUpdate).toBe(true);
    expect(first.lastCheckMs).toBe(t0);

    const withinWindow = nextSwUpdateCheck(
      t0 + SW_UPDATE_INTERVAL_MS - 1,
      first.lastCheckMs,
    );
    expect(withinWindow.shouldUpdate).toBe(false);
    expect(withinWindow.lastCheckMs).toBe(t0);

    const afterWindow = nextSwUpdateCheck(
      t0 + SW_UPDATE_INTERVAL_MS,
      first.lastCheckMs,
    );
    expect(afterWindow.shouldUpdate).toBe(true);
    expect(afterWindow.lastCheckMs).toBe(t0 + SW_UPDATE_INTERVAL_MS);
  });
});
