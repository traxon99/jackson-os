import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

export const jimPrSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  kind: z.string(),
  value: z.number(),
  unit: z.string(),
  previousValue: z.number().nullable(),
  achievedAt: z.string(),
  workoutId: z.string(),
  tier: z.string().nullable().optional(),
});

export const jimPrsListSchema = z.object({
  prs: z.array(jimPrSchema),
});

export type JimPr = z.infer<typeof jimPrSchema>;
export type JimPrsList = z.infer<typeof jimPrsListSchema>;

export function listPrs(
  ctx: AdapterContext<JimConfig>,
  options: { since?: string; limit?: number } = {},
): Promise<JimPrsList> {
  const { since, limit = 10 } = options;
  const clampedLimit = Math.min(50, Math.max(1, limit));
  return jimGet(ctx, '/v1/prs', jimPrsListSchema, {
    since,
    limit: clampedLimit,
  });
}
