const { chromium } = require('/opt/node22/lib/node_modules/playwright/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [url, out, mode, css] = process.argv.slice(2);
  // mode: 'top' | 'scroll:Npx' | 'full'
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (css) {
    const text = fs.readFileSync(css, 'utf8');
    await page.addInitScript((cssText) => {
      document.addEventListener('DOMContentLoaded', () => {
        const tag = document.createElement('style');
        tag.id = 'inject-style';
        tag.textContent = cssText;
        document.head.appendChild(tag);
      });
    }, text);
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  if (mode && mode.startsWith('scroll:')) {
    const y = parseInt(mode.split(':')[1], 10);
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: out, fullPage: mode === 'full' });
  console.log('saved', out);
  await browser.close();
})();
