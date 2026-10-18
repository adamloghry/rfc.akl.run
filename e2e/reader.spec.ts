import { expect, test } from './fixtures';

test.describe('reading level', () => {
  test('switch toggles plainLanguage and persists', async ({ page }) => {
    await page.goto('/rfc903#plain-language');
    const html = page.locator('html');
    const plainLanguage = page.locator('[data-set-level="plain-language"]');
    const std = page.locator('[data-set-level="std"]');
    await expect(plainLanguage).toHaveAttribute('aria-pressed', 'false');
    await expect(html).not.toHaveAttribute('data-level', 'plain-language');
    await plainLanguage.click();
    await expect(html).toHaveAttribute('data-level', 'plain-language');
    await expect(plainLanguage).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(html).toHaveAttribute('data-level', 'plain-language');
    await expect(page.locator('[data-set-level="plain-language"]')).toHaveAttribute('aria-pressed', 'true');
    await std.click();
    await expect(html).not.toHaveAttribute('data-level', 'plain-language');
    await page.reload();
    await expect(html).not.toHaveAttribute('data-level', 'plain-language');
  });

  test('?level=plain-language works (before first paint)', async ({ page }) => {
    await page.goto('/rfc903?level=plain-language#plain-language');
    await expect(page.locator('html')).toHaveAttribute('data-level', 'plain-language');
    await expect(page.locator('[data-set-level="plain-language"]')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('packet viewer', () => {
  test('inspector follows hover and focus', async ({ page }) => {
    await page.goto('/rfc903#plain-language');
    const fig = page.locator('figure[data-viz="packet"]').first();
    const name = fig.locator('.pk-i-name');
    await expect(fig.locator('.pk-inspector')).toBeVisible();
    const cells = fig.locator('.pk-cell[id]');
    const count = await cells.count();
    expect(count).toBeGreaterThan(3);
    const a = cells.nth(1),
      b = cells.nth(count - 1);
    await a.hover();
    await expect(name).toHaveText((await a.getAttribute('data-name'))!);
    await b.hover();
    await expect(name).toHaveText((await b.getAttribute('data-name'))!);
    await a.focus();
    await expect(name).toHaveText((await a.getAttribute('data-name'))!);
    await expect(fig.locator('.pk-i-desc')).toHaveText((await a.getAttribute('data-desc'))!);
  });

  test('Request/Reply toggle swaps values and tints changed fields', async ({ page }) => {
    await page.goto('/rfc903#plain-language');
    const fig = page.locator('figure[data-viz="packet"]').first();
    const body = fig.locator('.pk-body');
    const req = fig.locator('button[data-mode="req"]');
    const rep = fig.locator('button[data-mode="rep"]');
    await expect(req).toHaveAttribute('aria-pressed', 'true');
    const changedReq = await fig.locator('.pk-cell.is-changed').evaluateAll((e) => e.map((x) => x.getAttribute('data-key')));
    await rep.click();
    await expect(body).toHaveAttribute('data-mode', 'rep');
    await expect(rep).toHaveAttribute('aria-pressed', 'true');
    await expect(req).toHaveAttribute('aria-pressed', 'false');
    const changedRep = await fig.locator('.pk-cell.is-changed').evaluateAll((e) => e.map((x) => x.getAttribute('data-key')));
    expect(changedRep.length).toBeGreaterThan(0);
    expect(changedRep).not.toEqual(changedReq);
    // tinted cells have a different background from untinted ones
    const bg = (sel: string) =>
      fig
        .locator(sel)
        .first()
        .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(await bg('.pk-cell.is-changed')).not.toBe(await bg('.pk-cell:not(.is-changed)'));
    // the visible value of a changed field differs between modes
    const key = changedRep[0]!;
    const visible = () => fig.locator(`.pk-cell[data-key="${key}"] .pk-v:not([hidden])`).first().textContent();
    const repVal = await visible();
    await req.click();
    expect(await visible()).not.toBe(repVal);
  });
});

test.describe('sequence simulator', () => {
  test('steps update the permalink and #step-N deep links work', async ({ page }) => {
    await page.goto('/rfc903#plain-language');
    const fig = page.locator('figure[data-viz="sequence-sim"]');
    const chip = fig.locator('.sim-permalink');
    const primary = fig.locator('.sim-primary');
    await expect(primary).toHaveText('Play step 1 →');
    await expect(chip).toHaveText('rfc.akl.run/rfc903#step-1');
    await primary.click();
    await expect(primary).toHaveText('Next step →');
    await expect(chip).toHaveText('rfc.akl.run/rfc903#step-2');
    expect(new URL(page.url()).hash).toBe('#step-2');
    await primary.click();
    expect(new URL(page.url()).hash).toBe('#step-3');
    await fig.locator('button[aria-label="Previous step"]').click();
    expect(new URL(page.url()).hash).toBe('#step-2');
  });

  test('/rfc903#step-3 deep link opens at step 3', async ({ page }) => {
    await page.goto('/rfc903#step-3');
    const fig = page.locator('figure[data-viz="sequence-sim"]');
    await expect(fig.locator('.sim-permalink')).toHaveText('rfc.akl.run/rfc903#step-3');
    await expect(fig.locator('.sim-seg').nth(2)).toBeVisible();
    await expect(fig.locator('button[aria-label="Previous step"]')).toBeEnabled();
    await page.evaluate(() => {
      location.hash = '#step-1';
    });
    await expect(fig.locator('.sim-permalink')).toHaveText('rfc.akl.run/rfc903#step-1');
  });

  test('router toggle switches to the failure branch', async ({ page }) => {
    await page.goto('/rfc903#step-2');
    const fig = page.locator('figure[data-viz="sequence-sim"]');
    const sw = fig.locator('[role="switch"]');
    const title = fig.locator('.sim-step-title');
    const boundary = fig.locator('.sim-boundary');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(boundary).toBeHidden();
    const before = await title.textContent();
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(boundary).toBeVisible();
    await expect(title).not.toHaveText(before!);
    await sw.click();
    await expect(title).toHaveText(before!);
  });
});

test('copy link shows "Link copied" and writes the permalink', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/rfc903#plain-language');
  const btn = page.locator('[data-copy]').first();
  const url = await btn.getAttribute('data-copy');
  expect(url).toBe('https://rfc.akl.run/rfc903');
  await btn.click();
  await expect(btn).toContainText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await expect(btn).not.toContainText('Link copied', { timeout: 5000 }); // label restores
});

test.describe('graph', () => {
  for (const n of [903, 2616]) {
    test(`renders the neighbourhood of RFC ${n}`, async ({ page }) => {
      await page.goto(`/graph#${n}`);
      const svg = page.locator('#graph svg');
      await expect(svg).toBeVisible();
      await expect(page.locator('#graph')).toContainText(String(n));
      expect(await svg.locator('g').count()).toBeGreaterThan(1);
      await expect(page.locator('#graph-n')).toHaveValue(String(n));
    });
  }
});

test.describe('404 page form', () => {
  test('go-to-RFC input navigates (inline script allowed by CSP hash)', async ({ page, allowedFailures }) => {
    allowedFailures.push('/this/is/not/a/page/'); // an intentional 404 navigation
    await page.goto('/this/is/not/a/page/');
    await page.locator('#goto-n').fill('903');
    await page.getByRole('button', { name: 'Go to RFC' }).click();
    await page.waitForURL('**/rfc903');
  });
});
