import { describe, expect, it } from 'vitest';
import { relativeTime } from './time.js';

const t0 = new Date('2026-01-15T12:00:00.000Z');

describe('relativeTime', () => {
  it.each([
    { offsetMs: 0, expected: 'just now' },
    { offsetMs: 44_999, expected: 'just now' },
    { offsetMs: 45_000, expected: '0m ago' },
    { offsetMs: 90_000, expected: '1m ago' },
    { offsetMs: 59 * 60_000, expected: '59m ago' },
    { offsetMs: 60 * 60_000, expected: '1h ago' },
    { offsetMs: 5 * 60 * 60_000, expected: '5h ago' },
    { offsetMs: 24 * 60 * 60_000, expected: '1d ago' },
  ])('formats $offsetMs ms as $expected', ({ offsetMs, expected }) => {
    const now = new Date(t0.getTime() + offsetMs);
    expect(relativeTime(t0, now)).toBe(expected);
  });
});
