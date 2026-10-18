import { expect, test } from './fixtures';

const ctx = [
  {
    name: 'hero search on the Atlas',
    path: '/',
    input: '.search-hero .search-input',
  },
  {
    name: 'reader header search on /rfc903',
    path: '/rfc903',
    input: 'header .search-input',
  },
];

for (const c of ctx) {
  test.describe(c.name, () => {
    test('finds RFC 903 by number', async ({ page }) => {
      await page.goto(c.path);
      const input = page.locator(c.input).first();
      await input.focus();
      await input.fill('903');
      const row = page.locator('.search-row[href="/rfc903"]').first();
      await expect(row).toBeVisible();
      await expect(row).toContainText('RFC 903');
    });

    test('"diskless" finds a journey', async ({ page }) => {
      await page.goto(c.path);
      const input = page.locator(c.input).first();
      await input.focus();
      await input.fill('diskless');
      await expect(page.locator('.search-row[href^="/journeys"]').first()).toBeVisible();
    });

    test('arrow keys move selection, Enter navigates, Escape closes', async ({ page }) => {
      await page.goto(c.path);
      const input = page.locator(c.input).first();
      await input.focus();
      await input.fill('diskless');
      const rows = page.locator('.search-pop:not([hidden]) .search-row');
      await expect(rows.first()).toBeVisible();
      expect(await rows.count()).toBeGreaterThan(0);
      await page.keyboard.press('ArrowDown');
      await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
      if ((await rows.count()) > 1) {
        await page.keyboard.press('ArrowDown');
        await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('ArrowUp');
        await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('.search-pop').first()).toBeHidden();
      await expect(input).toHaveAttribute('aria-expanded', 'false');
      // reopen and navigate with Enter
      await input.fill('903');
      await expect(page.locator('.search-row[href="/rfc903"]').first()).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/rfc903');
    });
  });
}

test('Enter on a bare number jumps without waiting for results', async ({ page }) => {
  await page.goto('/glossary');
  const input = page.locator('.search-input').first();
  await input.focus();
  await input.fill('2616');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/rfc2616');
});

test('"/" focuses search', async ({ page }) => {
  await page.goto('/glossary');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('/');
  await expect(page.locator('.search-input').first()).toBeFocused();
});
