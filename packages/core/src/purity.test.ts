import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const BARE_NODE_BUILTINS = new Set([
  'fs',
  'path',
  'http',
  'crypto',
  'child_process',
  'os',
  'net',
]);

const FORBIDDEN_PACKAGES = new Set(['hono', 'drizzle-orm', 'better-sqlite3']);

function walkSourceTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceTsFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const fromPattern = /\bfrom\s+['"]([^'"]+)['"]/g;
  const sideEffectPattern = /\bimport\s+['"]([^'"]+)['"]/g;

  for (const pattern of [fromPattern, sideEffectPattern]) {
    for (const match of source.matchAll(pattern)) {
      const spec = match[1];
      if (spec !== undefined) {
        specifiers.push(spec);
      }
    }
  }

  return specifiers;
}

function isForbiddenImport(specifier: string): boolean {
  if (specifier.startsWith('node:')) {
    return true;
  }

  const root = specifier.split('/')[0] ?? specifier;
  if (BARE_NODE_BUILTINS.has(root)) {
    return true;
  }
  if (FORBIDDEN_PACKAGES.has(root)) {
    return true;
  }

  return false;
}

describe('packages/core purity', () => {
  it('does not import I/O, Node built-ins, or framework packages', () => {
    const srcDir = join(packageRoot, 'src');
    const violations: string[] = [];

    for (const filePath of walkSourceTsFiles(srcDir)) {
      const source = readFileSync(filePath, 'utf8');
      for (const specifier of extractImportSpecifiers(source)) {
        if (isForbiddenImport(specifier)) {
          violations.push(
            `${relative(packageRoot, filePath)}: forbidden import "${specifier}"`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('lists only zod in dependencies', () => {
    const pkg = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const dependencyNames = Object.keys(pkg.dependencies ?? {});
    const disallowed = dependencyNames.filter((name) => name !== 'zod');

    expect(disallowed).toEqual([]);
  });
});
