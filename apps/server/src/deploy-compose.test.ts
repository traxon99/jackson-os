import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const deployDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../deploy',
);

describe('deploy/compose.tunnel.yaml', () => {
  it('sets TRUST_CLOUDFLARE on the app service for tunnel deployments', () => {
    const content = readFileSync(
      join(deployDir, 'compose.tunnel.yaml'),
      'utf8',
    );
    expect(content).toMatch(/TRUST_CLOUDFLARE:\s*["']?true["']?/);
    expect(content).toMatch(/^\s*app:\s*$/m);
  });
});
