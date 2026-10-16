import { test as base, expect } from '@playwright/test';

/**
 * Every test fails on a Content-Security-Policy violation (securitypolicyviolation event or the
 * console message Chromium prints), on an uncaught page error, and on any same-origin response with
 * status >= 400 the page itself received (documents, scripts, styles, fonts, fetches). Tests that
 * intentionally load error pages list them explicitly:
 *
 *   test('...', async ({ page, allowedFailures }) => { allowedFailures.push('/no/such/page'); ... });
 *
 * Entries are exact pathnames or RegExps tested against the pathname. (Requests made through the
 * `request` fixture are not page traffic and are asserted by the tests themselves.)
 */
export const test = base.extend<{ guard: undefined; allowedFailures: Array<string | RegExp> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object destructuring pattern here
  allowedFailures: async ({}, use) => {
    await use([]);
  },
  guard: [
    async ({ page, allowedFailures, baseURL }, use) => {
      const failed: string[] = [];
      page.on('response', (res) => {
        const url = new URL(res.url());
        if (url.origin !== new URL(baseURL as string).origin) return;
        if (res.status() < 400) return;
        const ok = allowedFailures.some((a) => (typeof a === 'string' ? a === url.pathname : a.test(url.pathname)));
        if (!ok) failed.push(`${res.status()} ${res.request().method()} ${url.pathname}${url.search}`);
      });
      const csp: string[] = [];
      const errors: string[] = [];
      await page.exposeFunction('__reportCsp', (s: string) => csp.push(s));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as unknown as { __reportCsp(msg: string): void }).__reportCsp(
            `${e.violatedDirective} blocked ${e.blockedURI || 'inline'} @ ${e.sourceFile || location.href}`,
          );
        });
      });
      page.on('console', (m) => {
        if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(`console: ${m.text()}`);
        else if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console.error: ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await use();
      expect(csp, 'CSP violations').toEqual([]);
      expect(errors, 'page errors').toEqual([]);
      expect(failed, 'failed same-origin requests (allow intentional ones via allowedFailures)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
