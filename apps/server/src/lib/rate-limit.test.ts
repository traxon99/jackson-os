import { describe, expect, it } from 'vitest';
import { createLimiter } from './rate-limit.js';

describe('createLimiter', () => {
  it('allows capacity takes, rejects the next, then refills with injected now', () => {
    let currentMs = 0;
    const limiter = createLimiter({
      capacity: 3,
      refillPerSec: 1,
      now: () => currentMs,
    });

    expect(limiter.take('client')).toBe(true);
    expect(limiter.take('client')).toBe(true);
    expect(limiter.take('client')).toBe(true);
    expect(limiter.take('client')).toBe(false);

    currentMs += 1000;
    expect(limiter.take('client')).toBe(true);
  });

  it('tracks buckets independently by key', () => {
    const currentMs = 0;
    const limiter = createLimiter({
      capacity: 1,
      refillPerSec: 1,
      now: () => currentMs,
    });

    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
  });

  it('evicts keys idle for more than ten minutes', () => {
    let currentMs = 0;
    const limiter = createLimiter({
      capacity: 1,
      refillPerSec: 1,
      now: () => currentMs,
    });

    expect(limiter.take('idle')).toBe(true);
    expect(limiter.take('idle')).toBe(false);

    currentMs += 10 * 60 * 1000 + 1;
    expect(limiter.take('idle')).toBe(true);
  });
});
