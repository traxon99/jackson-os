import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

const jimPlanScheduledSchema = z.object({
  date: z.string(),
  routineId: z.string(),
  routineName: z.string(),
  exerciseCount: z.number(),
  programName: z.string().nullable(),
  webUrl: z.string(),
});

const jimPlanNextSchema = z.object({
  routineId: z.string(),
  routineName: z.string(),
  date: z.string().nullable(),
  webUrl: z.string(),
});

export const jimPlanSchema = z.object({
  scheduled: z.array(jimPlanScheduledSchema),
  next: jimPlanNextSchema.nullable(),
});

export type JimPlan = z.infer<typeof jimPlanSchema>;

export function getPlan(
  ctx: AdapterContext<JimConfig>,
  options: { days?: number } = {},
): Promise<JimPlan> {
  const { days = 7 } = options;
  const clampedDays = Math.min(14, Math.max(1, days));
  return jimGet(ctx, '/v1/plan', jimPlanSchema, { days: clampedDays });
}
