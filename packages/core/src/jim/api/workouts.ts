import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

export const jimWorkoutSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  routineName: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMinutes: z.number(),
  exerciseCount: z.number(),
  workingSets: z.number(),
  volume: z.number(),
  prCount: z.number(),
  gym: z.string().nullable(),
  webUrl: z.string(),
});

export const jimWorkoutsListSchema = z.object({
  workouts: z.array(jimWorkoutSummarySchema),
});

export type JimWorkoutSummary = z.infer<typeof jimWorkoutSummarySchema>;
export type JimWorkoutsList = z.infer<typeof jimWorkoutsListSchema>;

export function listWorkouts(
  ctx: AdapterContext<JimConfig>,
  options: { from?: string; to?: string; limit?: number } = {},
): Promise<JimWorkoutsList> {
  const { from, to, limit = 10 } = options;
  const clampedLimit = Math.min(50, Math.max(1, limit));
  return jimGet(ctx, '/v1/workouts', jimWorkoutsListSchema, {
    from,
    to,
    limit: clampedLimit,
  });
}
