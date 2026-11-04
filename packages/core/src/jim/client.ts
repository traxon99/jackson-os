import type { ZodType } from 'zod';
import { z } from 'zod';
import type { AdapterContext } from '../contracts.js';
import { UpstreamError } from '../errors.js';
import type { JimConfig } from './config.js';

const jimErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (raw === null || raw === '') {
    return undefined;
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }
  return Math.ceil(seconds * 1000);
}

export async function jimGet<T>(
  ctx: AdapterContext<JimConfig>,
  path: string,
  schema: ZodType<T>,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const { baseUrl, token } = ctx.config;
  if (token === '') {
    throw new UpstreamError('jim token not configured', { status: 0 });
  }

  const url = buildUrl(baseUrl, path, query);
  const response = await ctx.fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: ctx.signal,
  });

  if (!response.ok) {
    let message = response.statusText || 'request failed';
    let code: string | undefined;
    try {
      const body = jimErrorBodySchema.safeParse(await response.json());
      if (body.success) {
        message = body.data.error.message;
        code = body.data.error.code;
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new UpstreamError(message, {
      status: response.status,
      code,
      retryAfterMs: parseRetryAfterMs(response.headers),
    });
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`jim: unexpected response shape for ${path}`);
  }
  return parsed.data;
}
