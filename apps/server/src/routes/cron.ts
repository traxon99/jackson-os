import type { Hono } from 'hono';
import type { AppStack } from '../app.js';

export function mountCronRoutes(
  api: Hono,
  stack: AppStack,
  cronSecret: string | undefined,
): void {
  if (cronSecret === undefined || cronSecret === '') {
    return;
  }

  api.post('/cron/tick', async (c) => {
    const auth = c.req.header('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    for (const source of stack.registry.listSources()) {
      if (stack.enabled(source.id)) {
        await stack.scheduler.refreshSource(source.id);
      }
    }

    return c.json({ ok: true });
  });
}
