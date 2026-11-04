import { z } from 'zod';

export const jimConfigSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string(),
});

export type JimConfig = z.infer<typeof jimConfigSchema>;
