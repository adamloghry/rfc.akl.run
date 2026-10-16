'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { layout } = require('../scripts/lib/layout');
const assets = require('../scripts/lib/assets');
const { raw } = require('../scripts/lib/html');

const base = {
  title: 'RFC 903 — RARP · rfc.akl.run', description: 'Desc "q" & more', path: '/903/',
  palette: 'warm', header: 'reader',
  breadcrumb: [{ label: 'Core Protocols', href: '/areas/core/' }, { label: 'RFC 903' }],
  main: raw('<h1>Hi</h1>'),
};

test.beforeEach(() => assets.useManifest(null));

test('reader layout basics', () => {
  const h = layout(base);
  assert.match(h, /^<!doctype html>/i);
  assert.ok(h.includes('<link rel="canonical" href="https://rfc.akl.run/903/">'));
  assert.ok(h.includes('class="pal-warm"'));
  assert.ok(h.includes('theme-icon-sun') && h.includes('theme-icon-moon'));
  assert.ok(h.includes('class="search-pop" hidden'));
  assert.ok(h.includes('RFC text © IETF Trust. Explanations on rfc.akl.run. Static site, rebuilt daily from the RFC Editor index.'));
  assert.ok(h.includes('href="https://akl.run"'));
  assert.ok(h.includes('Desc &quot;q&quot; &amp; more'));
});

test('pre-paint script precedes the stylesheet and sets level', () => {
  const h = layout(base);
  const s = h.indexOf("localStorage.getItem('rfc-theme')");
  const c = h.indexOf('rel="stylesheet"');
  assert.ok(s > 0 && c > s);
  assert.ok(h.includes("localStorage.getItem('rfc-level')"));
  assert.ok(h.includes("data-level"));
});

test('breadcrumb: links, last bold without href', () => {
  const h = layout(base);
  assert.ok(h.includes('<a href="/areas/core/">Core Protocols</a>'));
  assert.match(h, /<span class="crumb-current"[^>]*>RFC 903<\/span>/);
});

test('no Pagefind markup; main is a plain landmark', () => {
  const h = layout({ ...base, searchable: true, pagefindMeta: { number: 903, tier: 'interactive', title: 'x' } });
  assert.ok(!h.includes('pagefind'));
  assert.ok(h.includes('<main id="main">'));
});

test('site header with active nav and cool palette', () => {
  const h = layout({ ...base, palette: 'cool', header: 'site', active: 'journeys' });
  assert.ok(h.includes('class="pal-cool"'));
  assert.match(h, /<a href="\/journeys\/" aria-current="page">Journeys<\/a>/);
  assert.ok(h.includes('Contribute an explainer'));
  assert.ok(!h.includes('search-pop'));
});

test('scripts: theme.js and search.js always, extras, defer, order', () => {
  const h = layout({ ...base, scripts: ['reader.js'] });
  const t = h.indexOf('/assets/theme.js'), r = h.indexOf('/assets/reader.js'), s = h.indexOf('/assets/search.js');
  assert.ok(t > 0 && r > 0 && s > 0);
  assert.match(h, /<script defer src="\/assets\/theme\.js">/);
});

test('with manifest, missing search.js is skipped but missing others throw', () => {
  assets.useManifest({ 'site.css': '/assets/site.aaaaaaaa.css', 'theme.js': '/assets/theme.bbbbbbbb.js',
    'ibm-plex-sans-latin-400-normal.woff2': '/assets/fonts/a.woff2', 'ibm-plex-sans-latin-600-normal.woff2': '/assets/fonts/b.woff2' });
  const h = layout(base);
  assert.ok(h.includes('/assets/theme.bbbbbbbb.js'));
  assert.ok(!h.includes('search.'));
  assert.throws(() => layout({ ...base, scripts: ['nope.js'] }), /nope\.js/);
});

test('footer extra row and head extra', () => {
  const h = layout({ ...base, footer: raw('<div id="x-foot">prev</div>'), head: raw('<meta name="x" content="y">') });
  assert.ok(h.includes('id="x-foot"'));
  assert.ok(h.includes('<meta name="x" content="y">'));
});

test('container option sets header and footer width; defaults follow header', () => {
  const idx = layout({ ...base, container: 'index' });
  assert.match(idx, /container container-index hdr-inner/);
  assert.match(idx, /<footer class="site-footer">\s*<div class="container container-index">/);
  const site = layout({ ...base, header: 'site', active: 'atlas' });
  assert.match(site, /container container-atlas hdr-inner/);
  assert.match(site, /<footer class="site-footer">\s*<div class="container container-atlas">/);
  const rd = layout(base);
  assert.match(rd, /<footer class="site-footer">\s*<div class="container container-reader">/);
  const bad = layout({ ...base, container: 'nope' });
  assert.match(bad, /container-reader hdr-inner/);
});
