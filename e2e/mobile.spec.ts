/** Accessibility smoke at phone width (390 px). Runs in the "mobile" project. */
import { expect, test } from './fixtures';

for (const p of ['/', '/903/', '/5952/', '/glossary/', '/glossary/m/']) {
  test.describe(p, () => {
    test('no horizontal scrollbar at 390px', async ({ page }) => {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        iw: innerWidth,
        bw: document.body.scrollWidth,
      }));
      expect(m.iw).toBe(390);
      expect(m.sw, JSON.stringify(m)).toBeLessThanOrEqual(m.cw);
      expect(m.bw, JSON.stringify(m)).toBeLessThanOrEqual(m.cw);
    });

    test('search is focusable and controls are labelled', async ({ page }) => {
      await page.goto(p);
      // Reader pages collapse the header search into an icon link to the Atlas search field (/#search).
      const icon = page.locator('a.hdr-search-icon');
      if (await icon.isVisible()) {
        await expect(icon).toHaveAttribute('aria-label', 'Search RFCs');
        await expect(icon).toHaveAttribute('href', '/#search');
        await icon.click();
        await page.waitForURL('**/#search');
      }
      const input = page.locator('.search-input:visible').first();
      await expect(input).toBeVisible();
      await input.focus();
      await expect(input).toBeFocused();
      const unlabeled = await page.evaluate(() => {
        const bad: string[] = [];
        const named = (e: Element) =>
          !!(
            e.getAttribute('aria-label') ||
            e.getAttribute('aria-labelledby') ||
            e.getAttribute('title') ||
            (e.textContent || '').trim() ||
            (e as HTMLInputElement).labels?.length
          );
        for (const e of document.querySelectorAll('img'))
          if (!e.hasAttribute('alt')) bad.push(`img without alt: ${e.outerHTML.slice(0, 80)}`);
        for (const e of document.querySelectorAll('svg, canvas')) {
          if (e.closest('[aria-hidden="true"]') || e.getAttribute('aria-hidden') === 'true') continue;
          if (e.closest('button, a') && named(e.closest('button, a')!)) continue;
          if (!(e.getAttribute('role') === 'img' && named(e)) && !e.querySelector('title'))
            bad.push(`${e.tagName} without accessible name: ${e.outerHTML.slice(0, 80)}`);
        }
        for (const e of document.querySelectorAll('button, a[href], input, select, textarea')) {
          if ((e as HTMLInputElement).type === 'hidden' || (e as HTMLElement).hidden || e.closest('[hidden]')) continue;
          if (!named(e)) bad.push(`${e.tagName} without name: ${e.outerHTML.slice(0, 80)}`);
        }
        return bad;
      });
      expect(unlabeled).toEqual([]);
    });
  });
}

test('page has a lang, a main landmark and a skip link', async ({ page }) => {
  await page.goto('/903/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main#main')).toHaveCount(1);
  await expect(page.locator('a.skip-link[href="#main"]')).toHaveCount(1);
});
