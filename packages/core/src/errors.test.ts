import { describe, expect, it } from 'vitest';
import { formatUpstreamError, UpstreamError } from './errors.js';

describe('UpstreamError', () => {
  it('formats retry-after as a relative duration', () => {
    const err = new UpstreamError('rate limited', {
      status: 429,
      retryAfterMs: 180_000,
    });
    const formatted = formatUpstreamError(
      err,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(formatted).toBe('upstream 429 · retry in 3m');
  });

  it('formats errors without retry-after using the message', () => {
    const err = new UpstreamError('not found', { status: 404 });
    expect(formatUpstreamError(err, new Date())).toBe('upstream 404 · not found');
  });

  it('never includes raw headers in formatted output', () => {
    const err = new UpstreamError('rate limited', {
      status: 429,
      retryAfterMs: 120_000,
    });
    const formatted = formatUpstreamError(err, new Date());
    expect(formatted).not.toContain('Retry-After');
    expect(formatted).not.toContain('120');
  });
});
