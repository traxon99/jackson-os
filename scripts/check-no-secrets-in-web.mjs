#!/usr/bin/env node
/**
 * Ensures server secret env var names never appear in the web source or bundle.
 * Keep SECRET_KEY_NAMES aligned with SECRET_KEYS in apps/server/src/config.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {readonly string[]} */
const SECRET_KEY_NAMES = [
  'SETUP_TOKEN',
  'JIM_PAT',
  'GITHUB_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID',
];

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const scanRoots = [
  join(repoRoot, 'apps/web/src'),
  join(repoRoot, 'apps/web/dist'),
];

/**
 * @param {string} dir
 * @param {string[]} files
 */
function collectFiles(dir, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'ENOENT'
    ) {
      return;
    }
    throw err;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(path, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push(path);
  }
}

/** @type {{ key: string; file: string }[]} */
const violations = [];

for (const root of scanRoots) {
  /** @type {string[]} */
  const files = [];
  collectFiles(root, files);

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const key of SECRET_KEY_NAMES) {
      if (content.includes(key)) {
        violations.push({ key, file });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Secret env var names must not appear in the web app:\n');
  for (const { key, file } of violations) {
    console.error(`  ${key} found in ${file}`);
  }
  process.exit(1);
}

console.info('check-no-secrets-in-web: ok');
