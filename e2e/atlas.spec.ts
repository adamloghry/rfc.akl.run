import { expect, test } from './fixtures';

const COLS = 200;

test.describe('Atlas (home)', () => {
  test('renders hero, map canvas draws pixels', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    const canvas = page.locator('#atlas-map');
    await expect(canvas).toBeVisible();
    // the canvas is sized to its CSS width only once coverage.json has loaded and draw() ran
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.height > 0 && c.width > 0)).toBe(true);
    const painted = () =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      });
    await expect.poll(painted).toBeGreaterThan(5000);
  });

  test('hero flows into the map: no coverage or just-published panels, no GitHub, no feed', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('rfc.akl.run — the RFCs, explained');
    await expect(page.locator('.at-goal, .at-fresh, .at-cov')).toHaveCount(0);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/GOAL ·|JUST PUBLISHED|Coverage report|Follow \(RSS\)|Contribute an explainer|github/i);
    await expect(page.locator('a[href*="feed.xml"], a[href*="/contribute"], a[href*="/coverage"]')).toHaveCount(0);
    await expect(page.locator('.at-legend')).toContainText('Summary');
  });

  test('hover shows a caption and clicking a cell navigates to that RFC', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#atlas-map');
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.height)).toBeGreaterThan(0);
    await canvas.scrollIntoViewIfNeeded();
    const b = (await canvas.boundingBox())!;
    const cell = b.width / COLS;
    const n = 903,
      i = n - 1;
    const x = b.x + ((i % COLS) + 0.5) * cell,
      y = b.y + (Math.floor(i / COLS) + 0.5) * cell;
    await page.mouse.move(x, y);
    await expect(page.locator('.at-cap-label')).toContainText('RFC 903');
    await page.mouse.click(x, y);
    await page.waitForURL('**/903/');
    await expect(page.locator('h1')).toContainText(/RARP|Reverse/i);
  });

  test('keyboard: arrows move the cursor, Enter opens it', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#atlas-map');
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.height)).toBeGreaterThan(0);
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.at-cap-label')).toContainText('RFC 2');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/2/');
  });

  test('legacy /#rfc903 forwards to /903/', async ({ page }) => {
    await page.goto('/#rfc903');
    await page.waitForURL('**/903/');
  });
});

test.describe('theme', () => {
  test('toggle persists across reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.locator('.theme-toggle').first().click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('rfc-theme'))).toBe('dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.goto('/903/');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('follows prefers-color-scheme until a choice is stored', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/glossary/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('no flash: data-theme is set before the stylesheet has loaded', async ({ page }) => {
    await page.goto('/');
    await page.locator('.theme-toggle').first().click(); // store "dark"
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    await page.route('**/assets/*.css', async (route) => {
      await gate;
      await route.continue();
    });
    const nav = page.goto('/glossary/', { waitUntil: 'commit' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', null, { timeout: 10_000 });
    const sheets = await page.evaluate(() => [...document.styleSheets].filter((s) => s.href).length);
    expect(sheets, 'external stylesheet must still be pending').toBe(0);
    release();
    await nav;
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
