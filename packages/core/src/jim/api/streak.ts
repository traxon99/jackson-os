import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

export const jimStreakSchema = z.object({
  weeks: z.number(),
  target: z.number(),
  thisWeek: z.object({
    done: z.number(),
    target: z.number(),
  }),
  longest: z.number(),
});

export type JimStreak = z.infer<typeof jimStreakSchema>;

export function getStreak(ctx: AdapterContext<JimConfig>): Promise<JimStreak> {
  return jimGet(ctx, '/v1/streak', jimStreakSchema);
}
