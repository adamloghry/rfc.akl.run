import { expect, test } from './fixtures';

test.describe('Glossary', () => {
  test('index lists letters with term counts and links to letter pages', async ({ page }) => {
    await page.goto('/glossary');
    await expect(page.locator('h1')).toHaveText('Glossary');
    const m = page.locator('.gloss-index a[href="/glossary/m"]');
    await expect(m).toContainText(/^M\s*\d+ terms?$/);
    await expect(page.locator('.gloss-entry')).toHaveCount(0);
    await m.click();
    await page.waitForURL('**/glossary/m');
    await expect(page.locator('dt#mac-address')).toBeVisible();
    await expect(page.locator('.jump-bar a[aria-current="page"]')).toHaveText('M');
  });

  test('a RFC page glossary chip opens the letter page at the term', async ({ page }) => {
    await page.goto('/rfc903#eli5');
    await page.locator('.chips a.chip[href="/glossary/m#mac-address"]').click();
    await page.waitForURL('**/glossary/m#mac-address');
    await expect(page.locator('dt#mac-address')).toBeInViewport();
  });

  test('old /glossary#id links are forwarded by the inline script (no CSP violation)', async ({ page }) => {
    await page.goto('/glossary#mac-address');
    await page.waitForURL('**/glossary/m#mac-address');
    await expect(page.locator('dt#mac-address')).toBeVisible();
    await page.goto('/glossary#letter-M');
    await page.waitForURL('**/glossary/m');
  });

  test('a term whose first letter differs from its id (legacy link) is forwarded through the exceptions map', async ({ page }) => {
    await page.goto('/glossary#dns-zone');
    await page.waitForURL('**/glossary/z#dns-zone');
    await expect(page.locator('dt#dns-zone')).toBeVisible();
  });

  test('without a hash the index stays put', async ({ page }) => {
    await page.goto('/glossary');
    await expect(page).toHaveURL(/\/glossary$/);
  });
});
