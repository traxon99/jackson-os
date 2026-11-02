import { describe, expect, it } from 'vitest';
import { createChallengeStore } from './challenges.js';

describe('createChallengeStore', () => {
  it('returns null on second consume', () => {
    const current = 0;
    const store = createChallengeStore(() => current);
    const { id } = store.issue('reg');
    expect(store.consume(id, 'reg')).not.toBeNull();
    expect(store.consume(id, 'reg')).toBeNull();
  });

  it('returns null when expired', () => {
    let current = 0;
    const store = createChallengeStore(() => current);
    const { id } = store.issue('auth');
    current = 5 * 60 * 1000 + 1;
    expect(store.consume(id, 'auth')).toBeNull();
  });

  it('returns null on kind mismatch', () => {
    const store = createChallengeStore(() => Date.now());
    const { id } = store.issue('reg');
    expect(store.consume(id, 'auth')).toBeNull();
  });
});
