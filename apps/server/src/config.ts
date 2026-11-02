import { readFileSync } from 'node:fs';
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

export const SECRET_KEYS = ['SETUP_TOKEN'] as const;

export type ReadFileFn = (path: string) => string;

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

export function resolveFileVars(
  env: Record<string, string | undefined>,
  readFile: ReadFileFn,
): Record<string, string | undefined> {
  const resolved = { ...env };

  for (const key of SECRET_KEYS) {
    const fileVar = `${key}_FILE`;
    const filePath = env[fileVar];
    if (filePath === undefined || filePath === '') {
      continue;
    }

    const directValue = env[key];
    if (directValue !== undefined && directValue !== '') {
      throw new ConfigError(`${key}: cannot set both ${key} and ${fileVar}`);
    }

    try {
      resolved[key] = readFile(filePath).trim();
    } catch {
      throw new ConfigError(`${key}: failed to read secret file`);
    }
  }

  return resolved;
}

export function loadConfig(
  env: Record<string, string | undefined>,
  readFile: ReadFileFn = (path) => readFileSync(path, 'utf8'),
): AppConfig {
  const resolvedEnv = resolveFileVars(env, readFile);

  const input = {
    NODE_ENV: resolvedEnv.NODE_ENV,
    PORT: resolvedEnv.PORT,
    APP_ORIGIN: resolvedEnv.APP_ORIGIN,
    DATA_DIR: resolvedEnv.DATA_DIR,
    RP_ID: resolvedEnv.RP_ID,
    SETUP_TOKEN: resolvedEnv.SETUP_TOKEN,
  };

  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigError(formatConfigErrors(result.error));
  }

  return result.data;
}
