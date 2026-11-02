import { randomBytes } from 'node:crypto';

export type ChallengeKind = 'reg' | 'auth';

type StoredChallenge = {
  challenge: string;
  kind: ChallengeKind;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;

export function createChallengeStore(now: () => number) {
  const store = new Map<string, StoredChallenge>();

  function issue(kind: ChallengeKind): { id: string; challenge: string } {
    const id = randomBytes(16).toString('base64url');
    const challenge = randomBytes(32).toString('base64url');
    store.set(id, {
      challenge,
      kind,
      expiresAt: now() + TTL_MS,
    });
    return { id, challenge };
  }

  function consume(id: string, kind: ChallengeKind): string | null {
    const entry = store.get(id);
    if (entry === undefined) {
      return null;
    }
    store.delete(id);
    if (entry.kind !== kind) {
      return null;
    }
    if (entry.expiresAt < now()) {
      return null;
    }
    return entry.challenge;
  }

  return { issue, consume };
}

export type ChallengeStore = ReturnType<typeof createChallengeStore>;
