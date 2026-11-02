import { expect, test } from '@playwright/test';

test('service worker never caches /api/ responses', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    undefined,
    { timeout: 15_000 },
  );

  await page.evaluate(async () => {
    try {
      await fetch('/api/health');
    } catch {
      // preview may not proxy API; SW must still bypass cache
    }
  });

  const apiCached = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      for (const request of requests) {
        if (new URL(request.url).pathname.startsWith('/api/')) {
          return true;
        }
      }
    }
    return false;
  });

  expect(apiCached).toBe(false);
});
