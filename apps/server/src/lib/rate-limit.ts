type Bucket = {
  tokens: number;
  lastRefillMs: number;
  lastAccessMs: number;
};

export type LimiterOptions = {
  capacity: number;
  refillPerSec: number;
  now: () => number;
};

const IDLE_MS = 10 * 60 * 1000;

export type Limiter = {
  take: (key: string) => boolean;
  secondsUntilAvailable: (key: string) => number;
};

export function createLimiter(options: LimiterOptions): Limiter {
  const { capacity, refillPerSec, now } = options;
  const buckets = new Map<string, Bucket>();

  function evictIdle(): void {
    const t = now();
    for (const [key, bucket] of buckets) {
      if (t - bucket.lastAccessMs > IDLE_MS) {
        buckets.delete(key);
      }
    }
  }

  function refillBucket(bucket: Bucket, t: number): void {
    const elapsedSec = (t - bucket.lastRefillMs) / 1000;
    if (elapsedSec <= 0) {
      return;
    }
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + elapsedSec * refillPerSec,
    );
    bucket.lastRefillMs = t;
  }

  function getBucket(key: string, t: number): Bucket {
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = {
        tokens: capacity,
        lastRefillMs: t,
        lastAccessMs: t,
      };
      buckets.set(key, bucket);
      return bucket;
    }
    bucket.lastAccessMs = t;
    refillBucket(bucket, t);
    return bucket;
  }

  return {
    take(key: string): boolean {
      evictIdle();
      const t = now();
      const bucket = getBucket(key, t);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      return false;
    },
    secondsUntilAvailable(key: string): number {
      evictIdle();
      const t = now();
      const bucket = getBucket(key, t);
      if (bucket.tokens >= 1) {
        return 0;
      }
      const deficit = 1 - bucket.tokens;
      return Math.ceil(deficit / refillPerSec);
    },
  };
}
