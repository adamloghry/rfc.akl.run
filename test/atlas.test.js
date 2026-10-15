'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseIndex } = require('../scripts/lib/rfc-index');
const { buildSite } = require('../scripts/lib/model');
const assets = require('../scripts/lib/assets');
const atlas = require('../scripts/pages/atlas');

const FIX = path.join(__dirname, 'fixtures');
const site = buildSite({
  index: parseIndex(fs.readFileSync(path.join(FIX, 'rfc-index.sample.xml'), 'utf8')),
  contentDir: path.join(FIX, 'content'),
  buildDate: new Date('2026-10-15'),
});
site.newest = [...site.rfcs.values()].sort((a, b) => b.year - a.year || b.month - a.month || b.number - a.number).slice(0, 10);
test.beforeEach(() => assets.useManifest(null));

const out = () => atlas.render(site);
const page = () => out()[0].html;

test('emits only index.html', () => {
  const o = out();
  assert.equal(o.length, 1);
  assert.equal(o[0].path, 'index.html');
  assert.equal(atlas.name, 'atlas');
});

test('cool palette, site header with Atlas active, H1, lead', () => {
  const h = page();
  assert.ok(h.includes('class="pal-cool"'));
  assert.ok(h.includes('site-header--site'));
  assert.match(h, /<a href="\/" aria-current="page">Atlas<\/a>/);
  assert.ok(h.includes('The documents that built the Internet, explained.'));
  assert.ok(h.includes('rfc.akl.run/&lt;number&gt;/'));
});

test('hash forwarder is inline in head before body paint', () => {
  const h = page();
  const fwd = "var m=location.hash.match(/^#rfc(\\d+)$/i);if(m)location.replace('/'+(+m[1])+'/');";
  const i = h.indexOf(fwd);
  assert.ok(i > 0);
  assert.ok(i < h.indexOf('</head>'));
  assert.ok(i < h.indexOf('<body'));
});

test('hero search box with / kbd and 4 suggestion pills', () => {
  const h = page();
  assert.ok(h.includes('search-box search-hero'));
  assert.ok(h.includes('class="search-kbd"'));
  assert.ok(h.includes('class="search-pop" hidden'));
  assert.equal((h.match(/class="at-pill"/g) || []).length, 4);
  assert.ok(h.includes('data-search-fill="How does email get delivered?"'));
  assert.ok(h.includes('data-search-fill="2119"'));
});

test('coverage band computed from site.counts', () => {
  const h = page();
  const c = site.counts;
  const pct = (((c.summary + c.explainer + c.interactive) / c.total) * 100).toFixed(1) + '%';
  assert.ok(h.includes(`<span class="at-stat-num">${pct}</span>`));
  assert.ok(h.includes(`of ${c.total.toLocaleString('en-US')} RFCs have more than an index page`));
  assert.ok(h.includes('Coverage report'));
  assert.ok(h.includes('href="/feed.xml"'));
  const big = Object.assign(Object.create(Object.getPrototypeOf(site)), site, { counts: { total: 10065, index: 9800, summary: 200, explainer: 52, interactive: 13 } });
  const h2 = atlas.render(big)[0].html;
  assert.ok(h2.includes('of 10,065 RFCs'));
  assert.ok(h2.includes('>2.6%<'));
});

test('just published: 3 newest with number, title and meta line', () => {
  const h = page();
  const rows = h.match(/class="at-fresh-row"/g) || [];
  assert.equal(rows.length, 3);
  const r = site.newest[0];
  assert.ok(h.includes(`RFC ${r.number}</span>`));
  assert.match(h, /Oct 2026 · Proposed Standard · (index|summary|explainer|interactive) page|[A-Z][a-z]{2} \d{4} · [^<]+ · (index|summary|explainer|interactive) page/);
  assert.ok(h.includes(esc(r.title)));
});
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

test('map section: canvas, noscript link, legend counts, 11 chips + All', () => {
  const h = page();
  assert.ok(h.includes('<canvas'));
  assert.match(h, /<noscript>[\s\S]*href="\/areas\/"[\s\S]*<\/noscript>/);
  const c = site.counts;
  assert.ok(h.includes(`Deep explainer · ${c.explainer + c.interactive}`));
  assert.ok(h.includes(`Summary · ${c.summary}`));
  assert.equal((h.match(/class="at-chip"/g) || []).length, 12);
  assert.ok(h.includes('data-cat="" aria-pressed="true">All areas'));
  assert.ok(h.includes(`1 – ${site.max.toLocaleString('en-US')}`));
});

test('journeys: feature card with step rows', () => {
  const h = page();
  assert.ok(h.includes('href="/journeys/diskless-boot/"'));
  assert.ok(h.includes('2 STEPS · 2 RFCS'));
  assert.ok(h.includes('Booting a diskless machine'));
  assert.equal((h.match(/class="at-jstep"/g) || []).length, 2);
  assert.equal((h.match(/class="at-jcard"/g) || []).length, 0);
});

test('journeys: renders with zero journeys and with several', () => {
  const none = Object.assign(Object.create(Object.getPrototypeOf(site)), site, { journeys: [] });
  assert.ok(atlas.render(none)[0].html.includes('id="journeys"'));
  const mk = (slug, featuredFlag) => ({ slug, title: slug, description: 'd', featured: featuredFlag, steps: [{ title: 's', rfcs: [{ number: 1 }, { number: 2 }] }] });
  const many = Object.assign(Object.create(Object.getPrototypeOf(site)), site, { journeys: ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => mk(s, s === 'c')) });
  const h = atlas.render(many)[0].html;
  assert.match(h, /class="at-feature" href="\/journeys\/c\/"/);
  assert.equal((h.match(/class="at-jcard"/g) || []).length, 4);
  const nofeat = Object.assign(Object.create(Object.getPrototypeOf(site)), site, { journeys: [mk('x', false), mk('y', false)] });
  assert.match(atlas.render(nofeat)[0].html, /class="at-feature" href="\/journeys\/x\/"/);
});

test('areas grid: 11 cards, covered counts, relative bars, explainer examples', () => {
  const h = page();
  assert.equal((h.match(/class="at-acard"/g) || []).length, 11);
  for (const k of site.categories) assert.ok(h.includes(`href="/areas/${k.key}/"`));
  const r = site.rfcs.get(903);
  const cat = r.category;
  const m = h.match(new RegExp(`href="/areas/${cat}/"[\\s\\S]*?</a>`))[0];
  assert.match(m, /\d+ covered/);
  assert.ok(m.includes(r.shortTitle || r.title));
  assert.match(m, /width:100\.00%|width:\d+\.\d\d%/);
});

test('timeline: 1969..max year with title tooltips', () => {
  const h = page();
  const maxYear = Math.max(...[...site.rfcs.values()].map((r) => r.year));
  assert.equal((h.match(/class="at-tl-col"/g) || []).length, maxYear - 1969 + 1);
  assert.ok(h.includes('title="1984: '));
  assert.ok(h.includes(`<span>${maxYear}</span>`));
});

test('footer copy and atlas.js script', () => {
  const h = page();
  assert.ok(h.includes('RFC text © IETF Trust.'));
  assert.ok(h.includes('href="https://akl.run"'));
  assert.ok(h.includes('/assets/atlas.js'));
  assert.ok(h.includes('/assets/search.js'));
});

// ---- client scripts -------------------------------------------------------
const JS = path.join(__dirname, '..', 'src', 'assets', 'js');
function load(file, doc) {
  const win = { addEventListener() {}, location: { href: '' }, matchMedia: () => ({ matches: false }) };
  const ctx = { atob: (s) => Buffer.from(s, 'base64').toString('latin1'), window: win, document: doc, console, setTimeout, clearTimeout, localStorage: {}, getComputedStyle: () => ({ getPropertyValue: () => '' }) };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, file), 'utf8'), ctx, { filename: file });
  return ctx;
}
const emptyDoc = { querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, documentElement: {}, getElementById: () => null };

test('search.js and atlas.js are no-ops without their elements', () => {
  assert.doesNotThrow(() => load('search.js', emptyDoc));
  assert.doesNotThrow(() => load('atlas.js', emptyDoc));
});

test('search core: questions need every word >= 3 chars to match; numbers parse', () => {
  const { window } = load('search.js', emptyDoc);
  const S = window.RarpSearch;
  const qs = [
    { q: 'how does email get delivered', href: '/journeys/email/', label: 'JOURNEY', title: 'Email' },
    { q: 'why is the padlock there', href: '/journeys/padlock/', label: 'JOURNEY', title: 'Padlock' },
  ];
  assert.equal(S.matchQuestions('email delivered', qs).length, 1);
  assert.equal(S.matchQuestions('email padlock', qs).length, 0);
  assert.equal(S.matchQuestions('is', qs).length, 0);
  assert.equal(S.matchQuestions('PADLOCK', qs)[0].href, '/journeys/padlock/');
  assert.equal(S.parseNumber('903', 10065), 903);
  assert.equal(S.parseNumber('0903', 10065), 903);
  assert.equal(S.parseNumber('10066', 10065), null);
  assert.equal(S.parseNumber('tcp', 10065), null);
  assert.equal(S.parseNumber('0', 10065), null);
});

test('atlas decode: state and category from the packed byte', () => {
  const { window } = load('atlas.js', emptyDoc);
  const A = window.RarpAtlas;
  const b64 = Buffer.from([0x04 | (3 << 4), 0x00, 0x02 | (15 << 4), 0x05 | (0 << 4)]).toString('base64');
  const d = A.decode(b64);
  assert.deepEqual(Array.from(d.state), [4, 0, 2, 5]);
  assert.deepEqual(Array.from(d.cat), [3, 0, 15, 0]);
});
