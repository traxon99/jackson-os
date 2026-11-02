import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONFIG_ENV_KEYS } from './config.js';

const envExamplePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.env.example',
);

function parseEnvExampleKeys(content: string): Set<string> {
  const keys = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    keys.add(trimmed.slice(0, equalsIndex).trim());
  }

  return keys;
}

describe('.env.example', () => {
  it('documents every config schema key', () => {
    const content = readFileSync(envExamplePath, 'utf8');
    const documented = parseEnvExampleKeys(content);
    const schemaKeys = new Set(CONFIG_ENV_KEYS);

    expect(documented).toEqual(schemaKeys);
  });
});
