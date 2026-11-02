import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(8080),
  APP_ORIGIN: z.string().url(),
  DATA_DIR: z.string().default('/data'),
  RP_ID: z.string().default('os.jacksonyanek.com'),
  SETUP_TOKEN: z.string().min(32).optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function describeIssue(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? 'Required' : 'Invalid type';
    case 'invalid_string':
      if (issue.validation === 'url') {
        return 'must be a valid URL';
      }
      return 'invalid string';
    case 'too_small':
      if (issue.type === 'string') {
        return `must be at least ${issue.minimum} characters`;
      }
      return 'value too small';
    case 'invalid_enum_value':
      return 'invalid value';
    default:
      return 'invalid value';
  }
}

function formatConfigErrors(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const key = issue.path.join('.') || 'config';
    return `${key}: ${describeIssue(issue)}`;
  });
  return lines.join('\n');
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const input = {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    APP_ORIGIN: env.APP_ORIGIN,
    DATA_DIR: env.DATA_DIR,
    RP_ID: env.RP_ID,
    SETUP_TOKEN: env.SETUP_TOKEN,
  };

  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigError(formatConfigErrors(result.error));
  }

  return result.data;
}
