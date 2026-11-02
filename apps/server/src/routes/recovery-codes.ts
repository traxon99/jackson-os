import type { Hono } from 'hono';
import type { RecoveryCodesService } from '../auth/recovery-codes.js';
import type { GetSession } from '../middleware/auth-gate.js';

export type RecoveryCodesRouteDeps = {
  recoveryCodes: RecoveryCodesService;
  getSession: GetSession;
};

export function mountRecoveryCodesRoutes(
  api: Hono,
  deps: RecoveryCodesRouteDeps,
): void {
  api.post('/recovery-codes/regenerate', async (c) => {
    const session = await deps.getSession(c);
    if (session === null || session.scope !== 'full') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const codes = await deps.recoveryCodes.generate();
    return c.json({ recoveryCodes: codes });
  });
}
