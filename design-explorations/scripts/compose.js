const { chromium } = require('/opt/node22/lib/node_modules/playwright/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const [layoutJson, outPath] = process.argv.slice(2);
  const layout = JSON.parse(fs.readFileSync(layoutJson, 'utf8'));

  // layout: { width, title, sections: [{label, images: [path,...]}] }
  const sectionsHtml = layout.sections.map(s => {
    const imgs = s.images.map(p => {
      const data = fs.readFileSync(p);
      const b64 = data.toString('base64');
      return `<img src="data:image/png;base64,${b64}" />`;
    }).join('');
    return `<section><h2>${s.label}</h2><div class="row">${imgs}</div></section>`;
  }).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,Segoe UI,Inter,sans-serif;background:#0a0e17;color:#e2e8f0;padding:28px 28px 36px;}
    h1{font-size:24px;margin:0 0 22px;font-weight:600;letter-spacing:-0.01em;color:#fff;}
    section{margin-bottom:24px;}
    h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:#94a3b8;margin:0 0 10px;}
    .row{display:flex;gap:14px;align-items:flex-start;}
    img{flex:1;min-width:0;width:100%;height:auto;border-radius:10px;border:1px solid rgba(148,163,184,0.18);box-shadow:0 10px 30px rgba(0,0,0,0.4);}
  </style></head><body>
    <h1>${layout.title}</h1>
    ${sectionsHtml}
  </body></html>`;

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: layout.width || 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const el = await page.$('body');
  await el.screenshot({ path: outPath });
  console.log('saved', outPath);
  await browser.close();
})();
