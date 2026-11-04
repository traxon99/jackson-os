import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'jim',
);

function loadWidgetFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

const jimWidgetIds = [
  'jim.status',
  'jim.week',
  'jim.recent',
  'jim.prs',
  'jim.lifts',
  'jim.body',
  'jim.next',
] as const;

const jimTitles = [
  'jim',
  'training',
  'workouts',
  'prs',
  'lifts',
  'body',
  'next',
] as const;

const jimLayout = {
  id: 'jim-e2e',
  items: [
    { i: 'jim.status', x: 0, y: 0, w: 3, h: 2 },
    { i: 'jim.week', x: 3, y: 0, w: 6, h: 3 },
    { i: 'jim.recent', x: 0, y: 3, w: 6, h: 3 },
    { i: 'jim.prs', x: 6, y: 3, w: 4, h: 3 },
    { i: 'jim.lifts', x: 0, y: 6, w: 6, h: 3 },
    { i: 'jim.body', x: 6, y: 6, w: 3, h: 3 },
    { i: 'jim.next', x: 9, y: 6, w: 4, h: 3 },
  ],
};

const sourcesFixture = [
  {
    id: 'jim',
    displayName: 'Jim',
    status: 'ok',
    lastFetchAt: '2026-11-03T22:41:09Z',
    nextFetchAt: '2026-11-03T22:46:09Z',
  },
];

function buildWidgetFixtures(mode: 'ok' | 'disabled'): Record<string, unknown> {
  if (mode === 'disabled') {
    return Object.fromEntries(
      jimWidgetIds.map((id) => [id, { state: 'disabled' }]),
    );
  }

  return {
    'jim.status': loadWidgetFixture('jim.status.json'),
    'jim.week': loadWidgetFixture('jim.week.json'),
    'jim.recent': loadWidgetFixture('jim.recent.json'),
    'jim.prs': loadWidgetFixture('jim.prs.json'),
    'jim.lifts': loadWidgetFixture('jim.lifts.json'),
    'jim.body': loadWidgetFixture('jim.body.json'),
    'jim.next': loadWidgetFixture('jim.next.json'),
  };
}

function installApiStubs(
  page: import('@playwright/test').Page,
  widgetFixtures: Record<string, unknown>,
) {
  return page.route('**/api/**', async (route) => {
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

    if (path === '/api/sources') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sourcesFixture),
      });
      return;
    }

    if (path === '/api/layout') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(jimLayout),
      });
      return;
    }

    const widgetMatch = path.match(/^\/api\/widgets\/(.+)$/);
    if (widgetMatch) {
      const widgetId = widgetMatch[1] ?? '';
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
}

async function assertNoHorizontalScroll(
  page: import('@playwright/test').Page,
  viewportWidth: number,
) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
}

async function assertJimWidgetsVisible(page: import('@playwright/test').Page) {
  for (const title of jimTitles) {
    await expect(
      page.getByRole('article', { name: title, exact: true }),
    ).toBeVisible();
  }
}

async function assertPrsErrorState(page: import('@playwright/test').Page) {
  const prs = page.getByRole('article', { name: 'prs', exact: true });
  await expect(prs.getByText('retry in 3m')).toBeVisible();
  await expect(prs.getByText(/Bench Press/)).toBeVisible();
  await expect(prs.getByText(/Squat/)).toBeVisible();
  await expect(prs.getByRole('button', { name: 'Try again' })).toBeVisible();
}

for (const [width, height, label] of [
  [393, 852, '393'],
  [1440, 900, '1440'],
] as const) {
  test(`Jim widgets at ${label}px`, async ({ page }) => {
    const widgetFixtures = buildWidgetFixtures('ok');
    await installApiStubs(page, widgetFixtures);

    await page.setViewportSize({ width, height });
    await page.goto('/');

    await assertJimWidgetsVisible(page);
    await assertNoHorizontalScroll(page, width);
    await assertPrsErrorState(page);

    const screenshotPath = join('test-results', `jim-widgets-${label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
}

test('Jim widgets disabled show Not configured', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  const widgetFixtures = buildWidgetFixtures('disabled');
  await installApiStubs(page, widgetFixtures);

  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');

  await expect(page.getByText('Not configured')).toHaveCount(7);
  expect(errors).toEqual([]);
});
