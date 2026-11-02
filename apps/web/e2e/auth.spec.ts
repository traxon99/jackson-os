import { expect, test } from '@playwright/test';

const setupToken = '01234567890123456789012345678901';

async function addVirtualAuthenticator(page: import('@playwright/test').Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
}

test('register with setup token then sign in with passkey', async ({
  page,
}) => {
  await addVirtualAuthenticator(page);

  await page.goto('/setup');
  await page.getByLabel('Setup token').fill(setupToken);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await page.getByRole('button', { name: 'I saved these' }).click();
  await expect(page.getByText('Server OK')).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByText('Server OK')).toBeVisible({ timeout: 15_000 });
});
