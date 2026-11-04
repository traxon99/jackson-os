import { Hono, type Hono as HonoType } from 'hono';
import {
  type AgentToolContext,
  auditAgentInvocation,
  createAgentTools,
} from '../agent/create-tools.js';
import { agentAuthMiddleware } from '../agent/middleware.js';
import type {
  AgentInvokeError,
  AgentInvokeRequest,
  AgentInvokeSuccess,
  AgentToolDefinition,
} from '../agent/types.js';
import type { AppStack } from '../app.js';
import type { AppConfig } from '../config.js';
import { clientIp } from '../lib/client-ip.js';
import { createLimiter } from '../lib/rate-limit.js';

export type AgentRouteConfig = Pick<
  AppConfig,
  'AGENT_API_TOKEN' | 'TRUST_CLOUDFLARE'
>;

export function mountAgentRoutes(
  api: HonoType,
  stack: AppStack,
  config: AgentRouteConfig,
): void {
  const token = config.AGENT_API_TOKEN;
  if (token === undefined || token === '') {
    return;
  }

  const agentLimiter = createLimiter({
    capacity: 60,
    refillPerSec: 1,
    now: stack.now,
  });

  const refreshLimiter = createLimiter({
    capacity: 3,
    refillPerSec: 1 / 20,
    now: stack.now,
  });

  const agent = new Hono();

  agent.use('*', agentAuthMiddleware(token));

  agent.use('*', async (c, next) => {
    const key = `agent:${clientIp(c, config.TRUST_CLOUDFLARE ?? false)}`;
    if (!agentLimiter.take(key)) {
      const retryAfter = agentLimiter.secondsUntilAvailable(key);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too Many Requests' }, 429);
    }
    await next();
  });

  agent.get('/tools', (c) => {
    const ctx = buildToolContext(stack, refreshLimiter, c);
    const tools = createAgentTools(ctx);
    const definitions: AgentToolDefinition[] = tools.map(
      ({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      }),
    );
    return c.json({ tools: definitions });
  });

  agent.post('/invoke', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { ok: false, error: 'Bad Request' } satisfies AgentInvokeError,
        400,
      );
    }

    const parsed = body as AgentInvokeRequest;
    if (typeof parsed.tool !== 'string' || parsed.tool === '') {
      return c.json(
        { ok: false, error: 'tool is required' } satisfies AgentInvokeError,
        400,
      );
    }

    const ctx = buildToolContext(stack, refreshLimiter, c);
    const tools = createAgentTools(ctx);
    const tool = tools.find((t) => t.name === parsed.tool);
    if (tool === undefined) {
      return c.json(
        { ok: false, error: 'Not Found' } satisfies AgentInvokeError,
        404,
      );
    }

    const args = parsed.arguments ?? {};
    const inputResult = tool.input.safeParse(args);
    if (!inputResult.success) {
      await auditAgentInvocation(
        stack.conn.db,
        parsed.tool,
        args,
        'validation failed',
        stack.now(),
      );
      return c.json(
        {
          ok: false,
          error: 'Bad Request',
          issues: inputResult.error.issues,
        } satisfies AgentInvokeError,
        400,
      );
    }

    try {
      const result = await tool.run(inputResult.data);
      await auditAgentInvocation(
        stack.conn.db,
        parsed.tool,
        inputResult.data,
        'ok',
        stack.now(),
      );
      return c.json({
        ok: true,
        tool: parsed.tool,
        result,
      } satisfies AgentInvokeSuccess);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'tool invocation failed';
      const retryAfter =
        error instanceof Error
          ? (error as Error & { retryAfter?: number }).retryAfter
          : undefined;

      await auditAgentInvocation(
        stack.conn.db,
        parsed.tool,
        inputResult.data,
        message,
        stack.now(),
      );

      if (message === 'Too Many Requests' && retryAfter !== undefined) {
        c.header('Retry-After', String(retryAfter));
        return c.json(
          { ok: false, error: message } satisfies AgentInvokeError,
          429,
        );
      }

      const status = message.startsWith('unknown source') ? 404 : 500;
      return c.json(
        { ok: false, error: message } satisfies AgentInvokeError,
        status,
      );
    }
  });

  api.route('/agent', agent);
}

function buildToolContext(
  stack: AppStack,
  refreshLimiter: ReturnType<typeof createLimiter>,
  c: { req: { header: (name: string) => string | undefined } },
): AgentToolContext {
  const clientKey = c.req.header('x-forwarded-for') ?? 'local';
  return {
    ...stack,
    refreshLimiter,
    clientKey,
  };
}
