import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

function systemChromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  for (const path of [
    '/usr/local/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]) {
    if (existsSync(path)) {
      return path;
    }
  }
  return undefined;
}

const chromiumExecutable = systemChromiumPath();
const e2eDataDir = mkdtempSync(join(tmpdir(), 'jos-e2e-'));
const setupToken = '01234567890123456789012345678901';
const appOrigin = 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: appOrigin,
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },
  webServer: {
    command: [
      `DATA_DIR=${e2eDataDir}`,
      `APP_ORIGIN=${appOrigin}`,
      'RP_ID=localhost',
      `SETUP_TOKEN=${setupToken}`,
      'NODE_ENV=development',
      'PORT=8080',
      'pnpm --filter server exec tsx src/index.ts',
    ].join(' '),
    port: 8080,
    reuseExistingServer: false,
  },
});
