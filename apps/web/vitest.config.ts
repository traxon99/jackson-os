import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/pwa/**/*.test.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
  },
});
