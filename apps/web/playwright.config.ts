import { existsSync } from 'node:fs';
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
const setupToken = '01234567890123456789012345678901';
const appOrigin = 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: appOrigin,
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },
  webServer: {
    command: [
      'DATABASE_URL=pglite://memory',
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
