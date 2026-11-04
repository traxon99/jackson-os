import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

export const jimServiceStatusSchema = z.enum([
  'operational',
  'degraded',
  'down',
  'unknown',
]);

const jimServiceBaseSchema = z.object({
  label: z.string(),
  status: jimServiceStatusSchema,
  checkedAt: z.string(),
});

const jimVercelServiceSchema = jimServiceBaseSchema.extend({
  id: z.literal('vercel'),
  deployment: z.object({
    url: z.string(),
    environment: z.enum(['production', 'preview']),
    state: z.enum(['READY', 'BUILDING', 'ERROR', 'CANCELED']),
    commitSha: z.string(),
    createdAt: z.string(),
  }),
  cron: z
    .object({
      enabled: z.boolean(),
      jobs: z.array(
        z.object({
          path: z.string(),
          schedule: z.string(),
        }),
      ),
    })
    .optional(),
});

const jimSupabaseServiceSchema = jimServiceBaseSchema.extend({
  id: z.literal('supabase'),
  project: z.object({
    ref: z.string(),
    region: z.string(),
    status: z.enum(['ACTIVE_HEALTHY', 'COMING_UP', 'UNKNOWN']),
  }),
  database: z.object({
    postgresVersion: z.string(),
    pooler: z.enum(['transaction', 'session', 'none']),
  }),
  auth: z.object({ enabled: z.boolean() }).optional(),
  storage: z.object({ enabled: z.boolean() }).optional(),
  realtime: z.object({ enabled: z.boolean() }).optional(),
});

const jimCloudflareServiceSchema = jimServiceBaseSchema.extend({
  id: z.literal('cloudflare'),
  zone: z.object({
    name: z.string(),
    status: z.enum(['active', 'pending', 'unknown']),
    ssl: z.enum(['full_strict', 'full', 'flexible', 'off']),
    proxied: z.boolean(),
  }),
  analytics: z
    .object({
      requests24h: z.number().int().nonnegative(),
      uniqueVisitors24h: z.number().int().nonnegative(),
      bytes24h: z.number().int().nonnegative(),
    })
    .optional(),
  waf: z
    .object({
      enabled: z.boolean(),
      challenged24h: z.number().int().nonnegative(),
    })
    .optional(),
});

const jimFlyServiceSchema = jimServiceBaseSchema.extend({
  id: z.literal('fly'),
  app: z.string(),
  region: z.string(),
  machines: z.object({
    total: z.number().int().nonnegative(),
    started: z.number().int().nonnegative(),
  }),
  healthCheck: z.object({
    path: z.string(),
    passing: z.boolean(),
  }),
  image: z
    .object({
      tag: z.string(),
      sizeMb: z.number().int().nonnegative(),
    })
    .optional(),
});

export const jimBackendServiceSchema = z.discriminatedUnion('id', [
  jimVercelServiceSchema,
  jimSupabaseServiceSchema,
  jimCloudflareServiceSchema,
  jimFlyServiceSchema,
]);

export const jimBackendSchema = z.object({
  checkedAt: z.string(),
  services: z.array(jimBackendServiceSchema),
});

export type JimBackend = z.infer<typeof jimBackendSchema>;
export type JimBackendService = z.infer<typeof jimBackendServiceSchema>;

export function getBackend(
  ctx: AdapterContext<JimConfig>,
): Promise<JimBackend> {
  return jimGet(ctx, '/v1/backend', jimBackendSchema);
}
