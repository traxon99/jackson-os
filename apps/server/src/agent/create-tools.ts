import { randomUUID } from 'node:crypto';
import { actionLog, widgetLayout } from '@jos/db';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AppStack } from '../app.js';
import { insertActionLog } from '../data/action-log.js';
import { listSnapshotSummaries } from '../data/snapshot-summaries.js';
import { listSourceStatuses } from '../data/source-status.js';
import { buildDefaultLayout, type LayoutResponse } from '../routes/layout.js';
import type { AgentTool } from './types.js';

const emptyObjectSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export type AgentToolContext = AppStack & {
  refreshLimiter: {
    take: (key: string) => boolean;
    secondsUntilAvailable: (key: string) => number;
  };
  clientKey: string;
};

export function createAgentTools(
  ctx: AgentToolContext,
): AgentTool<unknown, unknown>[] {
  const sourceDeps = {
    registry: ctx.registry,
    store: ctx.store,
    scheduler: ctx.scheduler,
    enabled: ctx.enabled,
  };

  const tools: AgentTool<unknown, unknown>[] = [
    {
      name: 'status',
      description:
        'Health and high-level jackson-os status (API ok, registered sources/widgets counts).',
      inputSchema: emptyObjectSchema,
      input: z.object({}).strict(),
      run: async () => {
        const sources = await listSourceStatuses(sourceDeps);
        const enabledCount = sources.filter(
          (s) => s.status !== 'disabled',
        ).length;
        return {
          ok: true,
          registeredSources: sources.length,
          enabledSources: enabledCount,
          registeredWidgets: ctx.registry.listWidgets().length,
          now: new Date(ctx.now()).toISOString(),
        };
      },
    },
    {
      name: 'list_sources',
      description: 'List data sources with fetch status and schedule hints.',
      inputSchema: emptyObjectSchema,
      input: z.object({}).strict(),
      run: async () => listSourceStatuses(sourceDeps),
    },
    {
      name: 'snapshot_summaries',
      description:
        'Summarize cached dataset snapshots (status, timestamps, payload size). Optional sourceId filter.',
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'Limit to one source id' },
        },
        additionalProperties: false,
      },
      input: z
        .object({
          sourceId: z.string().min(1).optional(),
        })
        .strict(),
      run: async (input) => {
        const parsed = input as { sourceId?: string };
        if (parsed.sourceId !== undefined) {
          const source = ctx.registry.getSource(parsed.sourceId);
          if (source === undefined) {
            throw new Error(`unknown source: ${parsed.sourceId}`);
          }
        }
        return listSnapshotSummaries(ctx.registry, ctx.store, parsed.sourceId);
      },
    },
    {
      name: 'list_widgets',
      description:
        'List widget definitions (id, title, source, dataset, grid sizes).',
      inputSchema: emptyObjectSchema,
      input: z.object({}).strict(),
      run: async () =>
        ctx.registry.listWidgets().map((w) => ({
          id: w.id,
          title: w.title,
          source: w.source,
          dataset: w.dataset,
          sizes: w.sizes,
        })),
    },
    {
      name: 'get_layout',
      description: 'Read the dashboard widget layout (read-only).',
      inputSchema: emptyObjectSchema,
      input: z.object({}).strict(),
      run: async (): Promise<LayoutResponse> => {
        const rows = await ctx.conn.db
          .select()
          .from(widgetLayout)
          .where(eq(widgetLayout.id, 'default'));
        const row = rows[0];

        if (row === undefined) {
          return {
            id: 'default',
            items: buildDefaultLayout(ctx.registry),
          };
        }

        return {
          id: row.id,
          items: JSON.parse(row.layout) as LayoutResponse['items'],
        };
      },
    },
    {
      name: 'refresh_source',
      description:
        'Trigger a refresh for one enabled source (same as POST /api/sources/:id/refresh). Rate limited.',
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string' },
        },
        required: ['sourceId'],
        additionalProperties: false,
      },
      input: z.object({ sourceId: z.string().min(1) }).strict(),
      run: async (input) => {
        const { sourceId } = input as { sourceId: string };
        const source = ctx.registry.getSource(sourceId);
        if (source === undefined) {
          throw new Error(`unknown source: ${sourceId}`);
        }

        const limitKey = `refresh:${sourceId}:${ctx.clientKey}`;
        if (!ctx.refreshLimiter.take(limitKey)) {
          const retryAfter = ctx.refreshLimiter.secondsUntilAvailable(limitKey);
          const err = new Error('Too Many Requests');
          (err as Error & { retryAfter: number }).retryAfter = retryAfter;
          throw err;
        }

        await ctx.scheduler.refreshSource(sourceId);
        return { sourceId, accepted: true };
      },
    },
    {
      name: 'list_action_log',
      description:
        'List recent action log entries (widget actions and agent audit entries).',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Max rows (default 20)',
          },
          widgetId: {
            type: 'string',
            description: 'Filter by widget or audit channel id',
          },
        },
        additionalProperties: false,
      },
      input: z
        .object({
          limit: z.number().int().min(1).max(100).optional(),
          widgetId: z.string().min(1).optional(),
        })
        .strict(),
      run: async (input) => {
        const parsed = input as { limit?: number; widgetId?: string };
        const limit = parsed.limit ?? 20;

        const base = ctx.conn.db.select().from(actionLog);
        const rows =
          parsed.widgetId === undefined
            ? await base.orderBy(desc(actionLog.createdAt)).limit(limit)
            : await base
                .where(eq(actionLog.widgetId, parsed.widgetId))
                .orderBy(desc(actionLog.createdAt))
                .limit(limit);
        return rows.map((row) => ({
          id: row.id,
          widgetId: row.widgetId,
          action: row.action,
          params: JSON.parse(row.params) as unknown,
          result: row.result,
          createdAt: new Date(row.createdAt).toISOString(),
        }));
      },
    },
  ];

  return tools;
}

export async function auditAgentInvocation(
  db: AppStack['conn']['db'],
  tool: string,
  params: unknown,
  result: 'ok' | string,
  now: number,
): Promise<void> {
  await insertActionLog(db, {
    id: randomUUID(),
    widgetId: '@agent',
    action: `tool:${tool}`,
    params,
    result: result === 'ok' ? 'ok' : `error:${result}`,
    createdAt: now,
  });
}
