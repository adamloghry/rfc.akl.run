import { expect, test } from './fixtures';

const tab = (page: import('@playwright/test').Page, name: 'text' | 'plain-language') => page.locator(`#tab-${name}`);

test.describe('RFC page tabs', () => {
  test('default tab is RFC text, with no persisted preference', async ({ page }) => {
    await page.goto('/rfc903');
    await expect(tab(page, 'text')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#rfc-text')).toBeVisible();
    await expect(page.locator('#plain-language')).toBeHidden();
    await expect(page.locator('.rt-pre')).toContainText('A Reverse Address Resolution Protocol');
    // choosing the other tab is not remembered across visits
    await tab(page, 'plain-language').click();
    await page.goto('/rfc903');
    await expect(tab(page, 'text')).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('the RFC text is plain DOM text: no page-break noise, find-in-page friendly', async ({ page }) => {
    await page.goto('/rfc903');
    const text = await page.locator('.rt-pre').innerText();
    expect(text).not.toMatch(/\[Page \d+\]/);
    expect(text).not.toMatch(/^RFC 903 +June 1984$/m);
    expect(text).toContain('RARP uses the same packet format that is used by ARP');
    // links: RFC mentions become links to /rfc<n>
    await page.goto('/rfc9293');
    await expect(page.locator('.rt-pre a[href="/rfc793"]').first()).toHaveText('RFC 793');
  });

  test('#plain-language and #packet-format open ISO Plain Language; the simulator still steps', async ({ page }) => {
    await page.goto('/rfc903#plain-language');
    await expect(tab(page, 'plain-language')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#plain-language')).toBeVisible();
    await expect(page.locator('#rfc-text')).toBeHidden();
    await expect(page.locator('.ai-note')).toContainText('AI-generated explainer.');
    await expect(page.locator('.ai-note')).toContainText('Written by AI from the RFC text following ISO Plain Language guidelines and not reviewed by a human');

    await page.goto('/rfc903#packet-format');
    await expect(tab(page, 'plain-language')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#packet-format')).toBeInViewport();

    await page.goto('/rfc903#field-oper');
    await expect(tab(page, 'plain-language')).toHaveAttribute('aria-selected', 'true');

    await page.goto('/rfc903#step-3');
    await expect(tab(page, 'plain-language')).toHaveAttribute('aria-selected', 'true');
    const fig = page.locator('figure[data-viz="sequence-sim"]');
    await expect(fig.locator('.sim-permalink')).toHaveText('rfc.akl.run/rfc903#step-3');
    await fig.locator('button[aria-label="Previous step"]').click();
    await expect(fig.locator('.sim-permalink')).toHaveText('rfc.akl.run/rfc903#step-2');
    expect(new URL(page.url()).hash).toBe('#step-2');
  });

  test('the packet inspector and simulator work after switching tabs by click', async ({ page }) => {
    await page.goto('/rfc903');
    await tab(page, 'plain-language').click();
    expect(new URL(page.url()).hash).toBe('#plain-language');
    const fig = page.locator('figure[data-viz="packet"]').first();
    await expect(fig.locator('.pk-inspector')).toBeVisible();
    const cells = fig.locator('.pk-cell[id]');
    await cells.nth(2).hover();
    await expect(fig.locator('.pk-i-name')).not.toHaveText('');
    const sim = page.locator('figure[data-viz="sequence-sim"]');
    await sim.scrollIntoViewIfNeeded();
    await expect(sim.locator('.sim-primary')).toBeVisible();
    await sim.locator('.sim-primary').click();
    await expect(sim.locator('.sim-permalink')).toHaveText(/rfc\.akl\.run\/rfc903#step-\d/);
    // back to RFC text clears the hash
    await tab(page, 'text').click();
    expect(new URL(page.url()).hash).toBe('');
    await expect(page.locator('#plain-language')).toBeHidden();
  });

  test('#section-3 stays on RFC text and scrolls the heading into view below the header', async ({ page }) => {
    await page.goto('/rfc9293#section-3');
    await expect(tab(page, 'text')).toHaveAttribute('aria-selected', 'true');
    const h = page.locator('#section-3');
    await expect(h).toBeInViewport();
    const top = await h.evaluate((e) => e.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(50);
    expect(top).toBeLessThan(300);
    // the contents rail links to headings and tracks the scroll
    await page.locator('.rt-toc a[href="#section-3.5"]').click();
    await expect(page.locator('#section-3\\.5')).toBeInViewport();
    expect(new URL(page.url()).hash).toBe('#section-3.5');
  });

  test('Section references link to headings in the same RFC', async ({ page }) => {
    await page.goto('/rfc9293');
    const link = page.locator('.rt-pre a[href^="#section-"]').first();
    await expect(link).toBeVisible();
    const href = (await link.getAttribute('href')) as string;
    await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
  });

  test('keyboard: arrow keys, Home and End switch tabs', async ({ page }) => {
    await page.goto('/rfc903');
    await tab(page, 'text').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'plain-language')).toBeFocused();
    await expect(tab(page, 'plain-language')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#plain-language')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'text')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tab(page, 'plain-language')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tab(page, 'text')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveCount(2);
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
  });

  test('reading level labels', async ({ page }) => {
    await page.goto('/rfc903#plain-language');
    await expect(page.locator('[data-set-level="plain-language"]')).toContainText('Plain language');
    await expect(page.locator('[data-set-level="std"]')).toContainText('In depth');
  });

  test('the PDF-converted RFC 8 shows a note', async ({ page }) => {
    await page.goto('/rfc8');
    await expect(page.locator('.rt-note')).toContainText('converted from the RFC Editor');
    await expect(page.locator('.rt-ext')).toHaveAttribute('href', 'https://www.rfc-editor.org/rfc/rfc8.pdf');
  });

  test('without JS both panels are in the page, RFC text first', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await ctx.newPage();
    await page.goto('/rfc903');
    await expect(page.locator('#rfc-text')).toBeVisible();
    await expect(page.locator('#plain-language')).toBeVisible();
    await expect(page.locator('[role="tablist"]')).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'ISO Plain Language' })).toBeVisible();
    expect(
      await page
        .locator('#rfc-text')
        .evaluate((e) => e.compareDocumentPosition(document.getElementById('plain-language') as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBeTruthy();
    await ctx.close();
  });
});

test.describe('framing copy', () => {
  test('footer disclosure is on every kind of page', async ({ page }) => {
    for (const p of ['/', '/rfc903', '/rfc404', '/areas', '/areas/core', '/journeys', '/glossary', '/graph']) {
      await page.goto(p);
      const f = page.locator('.site-footer');
      await expect(f, p).toContainText(
        'RFC text © IETF Trust, from the RFC Editor. AI explainers are generated by AI to be ISO Plain Language explanations and are not deeply reviewed; the RFC text is authoritative.',
      );
      await expect(f.locator('a[href="https://akl.run"]'), p).toHaveCount(1);
      await expect(f.locator('a[href="https://www.rfc-editor.org"]'), p).toHaveCount(1);
      await expect(f.locator('a[href="https://www.iso.org/standard/78907.html"]'), p).toHaveCount(1);
    }
  });

  test('home copy', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toHaveText('How the Internet is engineered.');
    await expect(page.locator('.at-lead')).toHaveText(
      'Every RFC, from the first in 1969 to today, with the original text and a plain-language explainer. Each has a permanent page at rfc.akl.run/rfc<number>.',
    );
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Home');
    await expect(page.locator('.site-nav')).not.toContainText('Atlas');
    await expect(page.locator('.at-map .at-eyebrow')).toHaveText('EVERY RFC');
    await expect(page.locator('.at-map h2')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/explained|five-year-old/i);
  });
});

test.describe('RFC 8881 on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('no horizontal page scroll; long lines scroll inside the text block', async ({ page }) => {
    await page.goto('/rfc8881');
    await page.waitForLoadState('networkidle');
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      bw: document.body.scrollWidth,
    }));
    expect(m.sw, JSON.stringify(m)).toBeLessThanOrEqual(m.cw);
    expect(m.bw, JSON.stringify(m)).toBeLessThanOrEqual(m.cw);
    const pre = await page.locator('.rt-pre').evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, fs: getComputedStyle(e).fontSize }));
    expect(pre.sw).toBeGreaterThan(pre.cw);
    expect(Number.parseFloat(pre.fs)).toBeLessThan(13);
    await expect(page.locator('details.toc-disclosure:visible summary')).toHaveText(/Contents/);
    await tab(page, 'plain-language').click();
    const m2 = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(m2).toBe(true);
  });
});
