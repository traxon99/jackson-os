import { randomUUID } from 'node:crypto';
import type { JosDatabase } from '@jos/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { readSessionToken, setSessionCookie } from '../auth/cookie.js';
import type { RecoveryCodesService } from '../auth/recovery-codes.js';
import type { SessionService } from '../auth/sessions.js';
import { insertActionLog } from '../data/action-log.js';
import { clientIp } from '../lib/client-ip.js';
import { createLimiter } from '../lib/rate-limit.js';

const RECOVERY_TTL_MS = 15 * 60 * 1000;
const RECOVERY_MAX_AGE_SEC = 15 * 60;

const recoverBodySchema = z.object({
  code: z.string(),
});

export type RecoverRoutesDeps = {
  db: JosDatabase;
  sessions: SessionService;
  recoveryCodes: RecoveryCodesService;
  now: () => number;
  trustCloudflare: boolean;
};

export function createRecoverRoutes(deps: RecoverRoutesDeps): Hono {
  const routes = new Hono();
  const recoverLimiter = createLimiter({
    capacity: 3,
    refillPerSec: 1 / 600,
    now: deps.now,
  });

  routes.post('/recover', async (c) => {
    const key = clientIp(c, deps.trustCloudflare);
    if (!recoverLimiter.take(key)) {
      const retryAfter = recoverLimiter.secondsUntilAvailable(key);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    let parsed: z.infer<typeof recoverBodySchema>;
    try {
      parsed = recoverBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: 'Bad Request' }, 400);
    }

    const accepted = await deps.recoveryCodes.consume(parsed.code);
    await insertActionLog(deps.db, {
      id: randomUUID(),
      widgetId: 'auth',
      action: 'recover',
      params: {},
      result: accepted ? 'ok' : 'fail',
      createdAt: deps.now(),
    });

    if (!accepted) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const previousToken = readSessionToken(c);
    if (previousToken !== undefined) {
      await deps.sessions.revoke(previousToken);
    }

    const token = await deps.sessions.create({
      userAgent: c.req.header('user-agent') ?? undefined,
      scope: 'recovery',
      absoluteTtlMs: RECOVERY_TTL_MS,
    });
    setSessionCookie(c, token, { maxAgeSec: RECOVERY_MAX_AGE_SEC });

    return c.json({ ok: true });
  });

  return routes;
}
