'use strict';
const { html, raw, esc } = require('./html');
const assets = require('./assets');

const ORIGIN = 'https://rfc.akl.run';
const FOOTER_COPY = 'RFC text © IETF Trust. Explanations on rfc.akl.run. Static site, rebuilt daily from the RFC Editor index.';

// Pre-paint: theme (handoff README §Theme) extended with the reading level.
const PREPAINT = "(function(){try{var s=localStorage.getItem('rfc-theme');var t=s||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);var l=new URLSearchParams(location.search).get('level')||localStorage.getItem('rfc-level');if(l==='eli5')document.documentElement.setAttribute('data-level','eli5');}catch(e){}})();";

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F4E1}</text></svg>");

const THEME_TOGGLE = raw(`<button class="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle light/dark mode">
<svg class="theme-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
<svg class="theme-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
</button>`);

const NAV = [
  ['atlas', '/', 'Atlas'],
  ['journeys', '/journeys/', 'Journeys'],
  ['areas', '/areas/', 'Areas'],
  ['glossary', '/glossary/', 'Glossary'],
];

function siteHeader(active, cont) {
  return html`<header class="site-header site-header--site">
<div class="container container-${cont} hdr-inner">
<a class="wordmark" href="/">rfc.akl.run</a>
<nav class="site-nav" aria-label="Main">${NAV.map(([key, href, label]) =>
    raw(`<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`))}</nav>
<div class="hdr-grow"></div>
<a class="hdr-contribute" href="/contribute/">Contribute an explainer</a>
${THEME_TOGGLE}
</div>
</header>`;
}

function readerHeader(breadcrumb, cont) {
  const items = (breadcrumb || []).map((c, i, arr) => {
    const last = i === arr.length - 1;
    const sep = i > 0 ? '<span class="crumb-sep" aria-hidden="true">/</span>' : '';
    const el = last || !c.href
      ? `<span class="crumb-current"${last ? ' aria-current="page"' : ''}>${esc(c.label)}</span>`
      : `<a href="${esc(c.href)}">${esc(c.label)}</a>`;
    return raw(sep + el);
  });
  return html`<header class="site-header site-header--reader">
<div class="container container-${cont} hdr-inner">
<a class="logo" href="/"><span class="logo-tile">R</span><span class="logo-word">rfc.akl.run</span></a>
<nav class="crumbs" aria-label="Breadcrumb">${items}</nav>
<div class="hdr-grow"></div>
<div class="search-box" role="search"><span class="search-ring" aria-hidden="true"></span><input class="search-input" type="search" placeholder="Jump to RFC, protocol, or term" aria-label="Search RFCs" autocomplete="off" spellcheck="false"><span class="search-kbd" aria-hidden="true">/</span><div class="search-pop" hidden><div role="listbox"></div></div></div>
<a class="hdr-search-icon" href="/#search" aria-label="Search RFCs"><span class="search-ring" aria-hidden="true"></span></a>
<a class="hdr-link" href="/areas/">Index</a>
<a class="hdr-link" href="/journeys/">Journeys</a>
${THEME_TOGGLE}
</div>
</header>`;
}

function scriptTag(name, optional) {
  if (optional && !assets.has(name)) return '';
  return `<script defer src="${esc(assets.url(name))}"></script>`;
}

/** @param {object} o options, see C11 in the plan @returns {string} complete HTML document */
function layout(o) {
  const canonical = ORIGIN + o.path;
  const palette = o.palette === 'cool' ? 'cool' : 'warm';
  const cont = ['reader', 'atlas', 'index'].includes(o.container) ? o.container : (o.header === 'site' ? 'atlas' : 'reader');
  const header = o.header === 'site' ? siteHeader(o.active, cont) : readerHeader(o.breadcrumb, cont);
  const containerCls = 'container-' + cont;

  const fontPreloads = ['ibm-plex-sans-latin-400-normal.woff2', 'ibm-plex-sans-latin-600-normal.woff2']
    .map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${esc(assets.url(f))}">`).join('\n');

  const scripts = [scriptTag('theme.js'), scriptTag('search.js', true)];
  for (const s of o.scripts || []) {
    if (s === 'theme.js' || s === 'search.js') continue;
    scripts.push(scriptTag(s));
  }

  // The theme-color hex values in the <head> below mirror the --bg tokens (warm/cool x light/dark) in src/assets/css/tokens.css.
  const t = o.title, d = o.description || '';
  const doc = html`<!doctype html>
<html lang="en" class="pal-${palette}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${raw(PREPAINT)}</script>
<title>${o.title}</title>
<meta name="description" content="${d}">
<meta name="robots" content="${o.robots || 'index, follow'}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="rfc.akl.run">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="theme-color" content="${palette === 'warm' ? '#f6f5f1' : '#f7f7f8'}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${palette === 'warm' ? '#121110' : '#0e0f12'}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${FAVICON}">
${raw(fontPreloads)}
<link rel="stylesheet" href="${assets.url('site.css')}">
${o.head}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header}
<main id="main">
${o.main}
</main>
<footer class="site-footer">
<div class="container ${containerCls}">
${o.footer ? html`<div class="footer-extra">${o.footer}</div>` : ''}
<div class="footer-copy"><span>${FOOTER_COPY}</span><a href="https://akl.run">akl.run</a></div>
</div>
</footer>
${raw(scripts.filter(Boolean).join('\n'))}
</body>
</html>
`;
  return doc.toString();
}

module.exports = { layout };
