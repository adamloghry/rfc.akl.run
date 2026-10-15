'use strict';
const { html, raw, esc } = require('../lib/html');
const { layout } = require('../lib/layout');

const ORIGIN = 'https://rfc.akl.run';

function redirectPage(target) {
  const abs = ORIGIN + target;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Redirecting to ${esc(target)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(abs)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
</head><body><p>Redirecting to <a href="${esc(target)}">${esc(target)}</a></p></body></html>
`;
}

const GOTO_JS = "(function(){var f=document.getElementById('goto-form');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var n=parseInt(document.getElementById('goto-n').value,10);if(n>0)location.href='/'+n+'/';});})();";

function notFound() {
  const main = html`<div class="container container-index" style="padding:64px 0">
<h1>No page here</h1>
<p style="color:var(--muted)">That address doesn't match anything on rfc.akl.run. If you were after an RFC, enter its number.</p>
<form id="goto-form" action="/" method="get" style="display:flex;gap:8px;margin:24px 0">
<label for="goto-n" class="visually-hidden">RFC number</label>
<input id="goto-n" type="number" min="1" inputmode="numeric" placeholder="RFC number" style="padding:8px 12px;font:inherit">
<button class="btn" type="submit">Go to RFC</button>
</form>
<p><a href="/">Atlas</a> &middot; <a href="/areas/">Areas</a></p>
<script>${raw(GOTO_JS)}</script>
</div>`;
  return layout({
    title: 'No page here — rfc.akl.run',
    description: 'That page does not exist on rfc.akl.run.',
    path: '/404.html',
    palette: 'warm',
    header: 'reader',
    breadcrumb: [{ label: 'Not found' }],
    main,
    robots: 'noindex, follow',
  });
}

function* render(site) {
  for (let n = 1; n <= site.max; n++) {
    yield { path: `rfc${n}/index.html`, html: redirectPage(`/${n}/`), sitemap: false };
  }
  for (const r of site.rfcs.values()) {
    const slug = r.slug || (r.content && r.content.slug);
    if (slug) yield { path: `${slug}/index.html`, html: redirectPage(`/${r.number}/`), sitemap: false };
  }
  yield { path: '404.html', html: notFound(), sitemap: false };
  yield { path: 'robots.txt', html: `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`, sitemap: false };
}

module.exports = { name: 'special', render };
