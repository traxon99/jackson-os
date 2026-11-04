import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

const jimBodyKindSchema = z.object({
  kind: z.string(),
  latest: z
    .object({
      value: z.number(),
      unit: z.string(),
      measuredAt: z.string(),
    })
    .nullable(),
  change: z.number().nullable(),
  points: z.array(
    z.object({
      measuredAt: z.string(),
      value: z.number(),
    }),
  ),
});

export const jimBodySchema = z.object({
  kinds: z.array(jimBodyKindSchema),
});

export type JimBody = z.infer<typeof jimBodySchema>;

export function getBodyMeasurements(
  ctx: AdapterContext<JimConfig>,
  options: {
    kinds?: string[];
    from?: string;
    to?: string;
  } = {},
): Promise<JimBody> {
  const { kinds = ['bodyweight'], from, to } = options;
  return jimGet(ctx, '/v1/body-measurements', jimBodySchema, {
    kinds: kinds.join(','),
    from,
    to,
  });
}
