import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

const jimDprLiftSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  unit: z.string(),
  next: z.object({
    weight: z.number(),
    reps: z.number(),
    intensity: z.number().nullable(),
  }),
  e1rm: z.number().nullable(),
  goal: z.number().nullable(),
  lastDecision: z.string().nullable(),
});

const jimDprBlockSchema = z.object({
  name: z.string(),
  week: z.number(),
  weeks: z.number(),
  lifts: z.array(jimDprLiftSchema),
});

export const jimDprSchema = z.object({
  block: jimDprBlockSchema.nullable(),
});

export type JimDpr = z.infer<typeof jimDprSchema>;

export function getDpr(ctx: AdapterContext<JimConfig>): Promise<JimDpr> {
  return jimGet(ctx, '/v1/dpr', jimDprSchema);
}
