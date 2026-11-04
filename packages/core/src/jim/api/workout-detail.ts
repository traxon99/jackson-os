import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

const jimWorkoutSetSchema = z.object({
  kind: z.string(),
  weight: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  distance: z.number().nullable().optional(),
  rpe: z.number().nullable().optional(),
  rir: z.number().nullable().optional(),
  isPr: z.boolean().optional(),
});

export const jimWorkoutDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      sets: z.array(jimWorkoutSetSchema),
    }),
  ),
});

export type JimWorkoutDetail = z.infer<typeof jimWorkoutDetailSchema>;

export function getWorkout(
  ctx: AdapterContext<JimConfig>,
  id: string,
): Promise<JimWorkoutDetail> {
  return jimGet(
    ctx,
    `/v1/workouts/${encodeURIComponent(id)}`,
    jimWorkoutDetailSchema,
  );
}
