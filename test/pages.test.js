'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseIndex } = require('../scripts/lib/rfc-index');
const { buildSite } = require('../scripts/lib/model');
const assets = require('../scripts/lib/assets');

const ROOT = path.join(__dirname, '..');
const site = buildSite({
  index: parseIndex(fs.readFileSync(path.join(__dirname, 'fixtures', 'rfc-index.sample.xml'), 'utf8')),
  contentDir: path.join(__dirname, 'fixtures', 'content'),
  buildDate: new Date('2026-10-15'),
});
const mod = (n) => require(`../scripts/pages/${n}.js`);
const out = (n, s = site) => new Map([...mod(n).render(s)].map((p) => [p.path, p.html]));
test.beforeEach(() => assets.useManifest(null));

test('every module exports name + render, never emits root index.html', () => {
  for (const n of ['areas', 'journeys', 'glossary', 'coverage', 'contribute', 'graph']) {
    assert.equal(mod(n).name, n);
    for (const p of out(n).keys()) assert.notEqual(p, 'index.html');
  }
});

test('areas: listing has 11 cards, cool palette, active areas', () => {
  const o = out('areas');
  const h = o.get('areas/index.html');
  assert.equal((h.match(/class="area-card"/g) || []).length, 11);
  assert.ok(h.includes('class="pal-cool"'));
  assert.match(h, /<a href="\/areas\/" aria-current="page">Areas<\/a>/);
  assert.equal([...o.keys()].filter((p) => /^areas\/[a-z]+\/index\.html$/.test(p)).length, 11);
});

test('areas: area page groups by tier', () => {
  const r = site.rfcs.get(903);
  const h = out('areas').get(`areas/${r.category}/index.html`);
  assert.ok(h.includes('Explainers') && h.includes('Index pages'));
  assert.ok(h.includes('href="/903/"'));
  assert.match(h, /RFC \d+ · /);
});

test('areas: large area paginates into <details> per 1000 block and stays small', () => {
  const rfcs = new Map();
  for (let n = 1; n <= 2500; n++) rfcs.set(n, { number: n, title: `Title ${n}`, shortTitle: null, category: 'meta', tier: 'index', status: 'informational', statusLabel: 'Informational', statusTone: 'neutral', priority: 0, content: null, year: 2000, url: `/${n}/` });
  const big = { ...site, rfcs, counts: { total: 2500, index: 2500, summary: 0, explainer: 0, interactive: 0 } };
  const h = out('areas', big).get('areas/meta/index.html');
  assert.equal((h.match(/<details/g) || []).length, 3);
  assert.ok(h.includes('RFC 2500 · Title 2500'));
  assert.ok(h.includes('1–1000') || h.includes('1&ndash;1000') || h.includes('1000'));
});

test('journeys: index cards and warm prose page', () => {
  const o = out('journeys');
  const idx = o.get('journeys/index.html');
  assert.ok(idx.includes('class="pal-cool"') && idx.includes('/journeys/diskless-boot/'));
  assert.ok(!idx.includes('data-pagefind-body'));
  const h = o.get('journeys/diskless-boot/index.html');
  assert.ok(h.includes('class="pal-warm"'));
  assert.ok(h.includes('Booting a diskless machine'));
  assert.ok(h.includes('href="/826/"') && h.includes('href="/903/"'));
  assert.ok(h.includes('data-pagefind-body'));
  assert.ok(h.includes('tier:journey, title:Booting a diskless machine'));
  assert.match(h, /data-pagefind-weight="10"[^>]*>[\s\S]*how does a diskless computer get an ip address/);
  assert.ok(h.indexOf('Find the neighbour') < h.indexOf('Learn your address'));
});

test('glossary: dl with ids, eli5, used-in, jump bar', () => {
  const h = out('glossary').get('glossary/index.html');
  assert.ok(h.includes('class="pal-warm"'));
  assert.ok(h.includes('<dt id="mac-address"') || h.includes('id="mac-address"'));
  assert.ok(h.includes('A name tag for your network card.'));
  assert.ok(h.includes('href="/826/"') && h.includes('href="/903/"'));
  assert.ok(h.includes('href="#letter-M"'));
  assert.ok(h.includes('data-pagefind-body'));
});

test('coverage: ladder, tables, top 50 uncovered', () => {
  const h = out('coverage').get('coverage/index.html');
  assert.ok(h.includes('class="pal-cool"'));
  assert.ok(h.includes(`${site.counts.total}`));
  assert.match(h, /\d+(\.\d)?%/);
  assert.ok(h.includes('1980s') || h.includes('1980'));
  assert.ok(h.includes('issues/new?template=request.yml'));
  assert.match(h, /log2/);
  const rows = h.match(/class="uncovered-row"/g) || [];
  const eligible = [...site.rfcs.values()].filter((r) => r.tier === 'index' || r.tier === 'summary').length;
  assert.equal(rows.length, Math.min(50, eligible));
  assert.ok(!h.includes('href="/903/" class="uncovered'));
});

test('contribute: ladder, JSON starters, viz gallery, templates, redirect', () => {
  const o = out('contribute');
  const h = o.get('contribute/index.html');
  assert.ok(h.includes('class="pal-warm"'));
  for (const t of ['packet', 'sequence-sim', 'sequence', 'compare-table', 'contrast', 'key-grid', 'layers', 'timeline', 'state-machine', 'tree', 'opcodes', 'code']) assert.ok(h.includes(`data-gallery="${t}"`), t);
  for (const t of ['request.yml', 'question.yml', 'error.yml']) assert.ok(h.includes(`template=${t}`));
  assert.ok(h.includes('llm-draft'));
  const pres = [...h.matchAll(/<pre[^>]*data-starter="(\w+)"[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)];
  assert.deepEqual(pres.map((m) => m[1]).sort(), ['explainer', 'summary']);
  for (const m of pres) {
    const obj = JSON.parse(m[2].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
    assert.ok(Number.isInteger(obj.number));
    assert.equal(obj.provenance.reviewedBy, null);
  }
  const q = o.get('contribute/question/index.html');
  assert.ok(q.includes('http-equiv="refresh"') && q.includes('template=question.yml'));
});

test('contribute starters validate against the rfc schema', () => {
  const Ajv = require('ajv/dist/2020');
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/schema/rfc.schema.json'), 'utf8')));
  const { starters } = mod('contribute');
  for (const [k, v] of Object.entries(starters())) assert.ok(validate(v), k + JSON.stringify(validate.errors));
});

test('graph page and client script', () => {
  const h = out('graph').get('graph/index.html');
  assert.ok(h.includes('class="pal-warm"') && h.includes('id="graph"') && h.includes('<noscript>'));
  assert.ok(h.includes('graph.js'));
  const js = fs.readFileSync(path.join(ROOT, 'src/assets/js/graph.js'), 'utf8');
  new Function(js); // parses
  assert.ok(js.includes('/data/graph.json') && js.includes('location.hash'));
  assert.ok(!/\bimport\b|\brequire\(/.test(js));
});
