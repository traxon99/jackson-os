import { actionLog } from '@jos/db';
import { describe, expect, it } from 'vitest';
import { defaultGetSession } from '../middleware/auth-gate.js';
import {
  createTestStack,
  destroyTestStack,
  testSessionHeaders,
} from '../test-helpers.js';

const agentToken = 'c'.repeat(32);

function agentHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${agentToken}`,
    'X-Forwarded-For': '203.0.113.9',
  };
}

describe('agent API', () => {
  it('is hidden when AGENT_API_TOKEN is unset', async () => {
    const stack = await createTestStack();
    try {
      const res = await stack.app.request('/api/agent/tools', {
        headers: agentHeaders(),
      });
      expect(res.status).toBe(404);
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('rejects invoke without bearer auth', async () => {
    const stack = await createTestStack({ AGENT_API_TOKEN: agentToken });
    try {
      const res = await stack.app.request('/api/agent/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'status' }),
      });
      expect(res.status).toBe(401);
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('lists tools and invokes status without a passkey session', async () => {
    const stack = await createTestStack({
      AGENT_API_TOKEN: agentToken,
      now: () => 10_000,
    });
    await stack.store.putOk('demo', 'clock', { iso: 'x' }, 1000, 9000);

    try {
      const toolsRes = await stack.app.request('/api/agent/tools', {
        headers: agentHeaders(),
      });
      expect(toolsRes.status).toBe(200);
      const toolsBody = (await toolsRes.json()) as {
        tools: Array<{ name: string }>;
      };
      expect(toolsBody.tools.map((t) => t.name)).toContain('list_sources');

      const invokeRes = await stack.app.request('/api/agent/invoke', {
        method: 'POST',
        headers: {
          ...agentHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool: 'status', arguments: {} }),
      });
      expect(invokeRes.status).toBe(200);
      const invokeBody = (await invokeRes.json()) as {
        ok: boolean;
        result: { ok: boolean; registeredSources: number };
      };
      expect(invokeBody.ok).toBe(true);
      expect(invokeBody.result.registeredSources).toBeGreaterThan(0);

      const rows = await stack.conn.db.select().from(actionLog);
      const audit = rows.find((r) => r.action === 'tool:status');
      expect(audit?.widgetId).toBe('@agent');
      expect(audit?.result).toBe('ok');
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('does not require browser Origin on invoke', async () => {
    const stack = await createTestStack({ AGENT_API_TOKEN: agentToken });
    try {
      const res = await stack.app.request('/api/agent/invoke', {
        method: 'POST',
        headers: {
          ...agentHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool: 'list_widgets', arguments: {} }),
      });
      expect(res.status).toBe(200);
    } finally {
      await destroyTestStack(stack);
    }
  });

  it('still requires passkey session for human data routes', async () => {
    const stack = await createTestStack({
      AGENT_API_TOKEN: agentToken,
      getSession: defaultGetSession(),
    });
    try {
      const res = await stack.app.request('/api/sources', {
        headers: agentHeaders(),
      });
      expect(res.status).toBe(401);

      const stackWithSession = await createTestStack({
        AGENT_API_TOKEN: agentToken,
      });
      try {
        const withSession = await stackWithSession.app.request('/api/sources', {
          headers: testSessionHeaders,
        });
        expect(withSession.status).toBe(200);
      } finally {
        await destroyTestStack(stackWithSession);
      }
    } finally {
      await destroyTestStack(stack);
    }
  });
});
