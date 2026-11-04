import { z } from 'zod';
import type { AdapterContext } from '../../contracts.js';
import { jimGet } from '../client.js';
import type { JimConfig } from '../config.js';

export const jimStatusSchema = z.object({
  user: z.object({
    username: z.string(),
    units: z.enum(['lb', 'kg']),
    weekStart: z.number().int().min(0).max(6),
    timeZone: z.string(),
  }),
  lastSyncedAt: z.string().nullable(),
  activeWorkout: z
    .object({
      id: z.string(),
      name: z.string(),
      startedAt: z.string(),
    })
    .nullable(),
  tokenScope: z.enum(['read', 'read_write']),
});

export type JimStatus = z.infer<typeof jimStatusSchema>;

export function getStatus(ctx: AdapterContext<JimConfig>): Promise<JimStatus> {
  return jimGet(ctx, '/v1/status', jimStatusSchema);
}
