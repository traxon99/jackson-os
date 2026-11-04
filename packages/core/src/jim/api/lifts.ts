import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

export const jimLiftsSchema = z.object({
  selection: z.enum(['dpr', 'most_trained', 'explicit']),
  lifts: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      unit: z.string(),
      current: z.number().nullable(),
      best: z.number().nullable(),
      predicted: z.number().nullable(),
      series: z.array(
        z.object({
          date: z.string(),
          e1rm: z.number(),
        }),
      ),
    }),
  ),
});

export type JimLifts = z.infer<typeof jimLiftsSchema>;

export function getLifts(
  ctx: AdapterContext<JimConfig>,
  options: {
    exercises?: string[];
    from?: string;
    to?: string;
  } = {},
): Promise<JimLifts> {
  const { exercises, from, to } = options;
  const query: Record<string, string | number | undefined> = { from, to };
  if (exercises !== undefined && exercises.length > 0) {
    query.exercises = exercises.join(',');
  }
  return jimGet(ctx, '/v1/lifts', jimLiftsSchema, query);
}
