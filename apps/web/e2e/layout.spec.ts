import { expect, test } from '@playwright/test';

const layoutFixture = {
  id: 'default',
  items: [
    { i: 'demo.clock', x: 0, y: 0, w: 3, h: 2 },
    { i: 'demo.series', x: 3, y: 0, w: 6, h: 3 },
  ],
};

const widgetFixtures: Record<string, unknown> = {
  'demo.clock': {
    state: 'ok',
    data: { iso: '2026-01-01T12:00:00.000Z' },
    fetchedAt: '2026-01-01T12:00:00.000Z',
    stale: false,
  },
  'demo.series': {
    state: 'error',
    error: 'upstream down',
    lastGood: {
      data: [{ t: 0, v: 0.2 }],
      fetchedAt: '2026-01-01T11:00:00.000Z',
    },
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/auth/me') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signedIn: true }),
      });
      return;
    }

    if (path === '/api/layout') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(layoutFixture),
      });
      return;
    }

    const widgetMatch = path.match(/^\/api\/widgets\/(.+)$/);
    if (widgetMatch) {
      const widgetId = widgetMatch[1];
      const payload = widgetFixtures[widgetId];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload ?? { state: 'disabled' }),
      });
      return;
    }

    await route.fulfill({ status: 404, body: 'not found' });
  });
});

async function assertNoHorizontalScroll(page: import('@playwright/test').Page) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(393);
}

test('no horizontal scroll at 393px in normal and edit modes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');

  await assertNoHorizontalScroll(page);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await assertNoHorizontalScroll(page);
});
