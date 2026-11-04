import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

function serverPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function resolveWebDist(raw: string): string {
  if (isAbsolute(raw)) {
    return raw;
  }
  return resolve(serverPackageRoot(), raw);
}

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(8080),
  APP_ORIGIN: z.string().url(),
  WEB_DIST: z.string().default('../web/dist'),
  DATA_DIR: z.string().default('/data'),
  RP_ID: z.string().default('os.jacksonyanek.com'),
  SETUP_TOKEN: z.string().min(32).optional(),
  JIM_API_URL: z
    .string()
    .url()
    .default('https://jim-mcp.fly.dev'),
  JIM_PAT: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  TRUST_CLOUDFLARE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type AppConfig = z.infer<typeof configSchema>;

export const SECRET_KEYS = [
  'SETUP_TOKEN',
  'JIM_PAT',
  'GITHUB_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID',
] as const;

export type SourceName = 'jim' | 'github' | 'portfolio';
export type SourceStatusValue = 'enabled' | 'disabled';
export type SourceStatus = Record<SourceName, SourceStatusValue>;

export function sourceStatus(config: AppConfig): SourceStatus {
  const has = (value: string | undefined) =>
    value !== undefined && value !== '';

  return {
    jim: has(config.JIM_PAT) ? 'enabled' : 'disabled',
    github: has(config.GITHUB_TOKEN) ? 'enabled' : 'disabled',
    portfolio:
      has(config.CLOUDFLARE_API_TOKEN) && has(config.CLOUDFLARE_ZONE_ID)
        ? 'enabled'
        : 'disabled',
  };
}

export function logDisabledSources(
  config: AppConfig,
  log: (message: string) => void,
): void {
  const status = sourceStatus(config);
  for (const [source, state] of Object.entries(status) as [
    SourceName,
    SourceStatusValue,
  ][]) {
    if (state === 'disabled') {
      log(`${source} source disabled`);
    }
  }
}

export const CONFIG_ENV_KEYS = Object.keys(
  configSchema.shape,
) as (keyof AppConfig)[];

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
    WEB_DIST: resolvedEnv.WEB_DIST,
    DATA_DIR: resolvedEnv.DATA_DIR,
    RP_ID: resolvedEnv.RP_ID,
    SETUP_TOKEN: resolvedEnv.SETUP_TOKEN,
    JIM_API_URL: resolvedEnv.JIM_API_URL,
    JIM_PAT: resolvedEnv.JIM_PAT,
    GITHUB_TOKEN: resolvedEnv.GITHUB_TOKEN,
    CLOUDFLARE_API_TOKEN: resolvedEnv.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID: resolvedEnv.CLOUDFLARE_ZONE_ID,
    TRUST_CLOUDFLARE: resolvedEnv.TRUST_CLOUDFLARE,
  };

  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigError(formatConfigErrors(result.error));
  }

  return {
    ...result.data,
    WEB_DIST: resolveWebDist(result.data.WEB_DIST),
  };
}
