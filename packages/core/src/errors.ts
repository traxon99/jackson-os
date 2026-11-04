function formatRetryIn(retryAfterMs: number): string {
  const totalSeconds = Math.ceil(retryAfterMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.ceil(retryAfterMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.ceil(retryAfterMs / 3_600_000);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.ceil(retryAfterMs / 86_400_000);
  return `${days}d`;
}

export class UpstreamError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    options: { status: number; code?: string; retryAfterMs?: number },
  ) {
    super(message);
    this.name = 'UpstreamError';
    this.status = options.status;
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function formatUpstreamError(err: UpstreamError, _now: Date): string {
  if (err.retryAfterMs !== undefined) {
    return `upstream ${err.status} · retry in ${formatRetryIn(err.retryAfterMs)}`;
  }
  return `upstream ${err.status} · ${err.message}`;
}
