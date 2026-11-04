import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

const muscleStatusSchema = z.enum(['under', 'within', 'over']);

export const jimWeekSchema = z.object({
  weekStart: z.string(),
  workouts: z.number(),
  workingSets: z.number(),
  volume: z.number(),
  durationMinutes: z.number(),
  muscles: z.array(
    z.object({
      muscle: z.string(),
      sets: z.number(),
      target: z.object({ low: z.number(), high: z.number() }),
      status: muscleStatusSchema,
    }),
  ),
  topExercises: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      sets: z.number(),
      volume: z.number(),
    }),
  ),
});

export const jimWeeksSchema = z.object({
  weeks: z.array(jimWeekSchema),
});

export type JimWeek = z.infer<typeof jimWeekSchema>;
export type JimWeeks = z.infer<typeof jimWeeksSchema>;

export function getWeeks(
  ctx: AdapterContext<JimConfig>,
  options: { weeks?: number; goal?: 'strength' | 'hypertrophy' } = {},
): Promise<JimWeeks> {
  const { weeks = 2, goal } = options;
  const clampedWeeks = Math.min(12, Math.max(1, weeks));
  const query: Record<string, string | number | undefined> = {
    weeks: clampedWeeks,
  };
  if (goal !== undefined) {
    query.goal = goal;
  }
  return jimGet(ctx, '/v1/weeks', jimWeeksSchema, query);
}
