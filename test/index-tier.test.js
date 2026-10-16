'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { parseIndex, loadIndex } = require('../scripts/lib/rfc-index');
const { buildSite } = require('../scripts/lib/model');
const { renderIndexTier } = require('../scripts/templates/index-tier');

const site = buildSite({
  index: parseIndex(fs.readFileSync('test/fixtures/rfc-index.sample.xml', 'utf8')),
  contentDir: 'test/fixtures/content',
  buildDate: new Date('2026-10-15'),
});
const gz = (s) => zlib.gzipSync(s).length;
const r5952 = () => site.rfcs.get(5952);
const withContent = (rfc, over) => ({ ...rfc, content: { ...(rfc.content || {}), ...over } });

test('summary tier (5952): head, badges, lede, buttons', () => {
  const out = renderIndexTier(r5952(), site);
  assert.match(out, /<meta name="rfc-tier" content="summary">/);
  assert.doesNotMatch(out, /pagefind/);
  assert.match(out, /<link rel="canonical" href="https:\/\/rfc.akl.run\/5952\/">/);
  assert.match(out, /badge-green[^>]*>PROPOSED STANDARD</);
  assert.match(out, /badge-dashed[^>]*>SUMMARY</);
  assert.match(out, /<h1 class="it-h1">A Recommendation for IPv6 Address Text Representation<\/h1>/);
  assert.match(out, /<div class="it-lede"><p>Describes how to write IPv6 addresses/);
  assert.match(out, /Read the RFC ↗/);
  assert.ok(out.includes('href="https://www.rfc-editor.org/rfc/rfc5952.html"'));
  assert.ok(out.includes('href="https://datatracker.ietf.org/doc/rfc5952/"'));
  assert.match(out, /Datatracker ↗/);
  assert.match(out, /AUTHORS' ABSTRACT/);
  assert.match(out, /As IPv6 deployment increases/);
  assert.doesNotMatch(out, /Abstract from the RFC Editor index/);
});

test('eli5 block, draft note', () => {
  const rfc = withContent(r5952(), { eli5: { summary: '<p>Write it one way.</p>' }, provenance: { source: 'llm-draft', reviewedBy: null } });
  const out = renderIndexTier(rfc, site);
  assert.match(out, /Like I'm 5/);
  assert.match(out, /Write it one way\./);
  assert.match(out, /Draft · machine-assisted, not yet reviewed/);
  assert.doesNotMatch(renderIndexTier(r5952(), site), /machine-assisted/);
  assert.doesNotMatch(renderIndexTier(r5952(), site), /Like I'm 5/);
});

test('dl: facts, guessed area, doi', () => {
  const out = renderIndexTier(r5952(), site);
  for (const k of ['PUBLISHED', 'AUTHORS', 'STREAM', 'UPDATES', 'DOI']) assert.ok(out.includes('>' + k + '<'), k);
  assert.match(out, /August 2010/);
  assert.match(out, /S\. Kawamura, M\. Kawashima/);
  assert.match(out, /AREA \(GUESSED\)/);
  assert.match(out, /from IETF area, unreviewed/);
  assert.match(out, /10\.17487\/RFC5952/);
  assert.match(out, /<a href="\/4291\/">RFC 4291/);
  const reviewed = renderIndexTier({ ...r5952(), categoryReviewed: true }, site);
  assert.doesNotMatch(reviewed, /AREA \(GUESSED\)/);
});

test('lineage 3-cell strip, has explainer', () => {
  const out = renderIndexTier(r5952(), site);
  assert.match(out, /class="it-lin"/);
  assert.match(out, /None — current/);
  assert.match(out, /UPDATED \/ OBSOLETED BY/);
  assert.doesNotMatch(out, /has explainer/);
  const s2 = { ...site, rfcs: new Map(site.rfcs) };
  s2.rfcs.set(4291, { ...r5952(), number: 4291, tier: 'explainer', title: 'IPv6 Addressing Architecture' });
  const out2 = renderIndexTier(r5952(), s2);
  assert.match(out2, /IPv6 Addressing Architecture/);
  assert.match(out2, /has explainer/);
  const ob = renderIndexTier({ ...r5952(), obsoletedBy: [9999] }, site);
  assert.doesNotMatch(ob, /None — current/);
  assert.match(ob, /class="it-warn"/);
  assert.match(ob, /href="\/9999\/"/);
});

test('mentioned in only if non-empty', () => {
  assert.doesNotMatch(renderIndexTier(r5952(), site), /MENTIONED IN/);
  const out = renderIndexTier({ ...r5952(), mentionedIn: [826, 903] }, site);
  assert.match(out, /MENTIONED IN/);
  assert.match(out, /href="\/826\/"/);
});

test('coverage ladder: 4 cells, done ink, next tint, demand line', () => {
  const out = renderIndexTier(r5952(), site);
  assert.equal((out.match(/class="it-cell/g) || []).length, 4);
  assert.equal((out.match(/class="it-dot it-done">✓</g) || []).length, 2);
  assert.equal((out.match(/it-cell it-next/g) || []).length, 1);
  assert.match(out, /it-next[^]*?>3</);
  assert.doesNotMatch(out, /readers requested/);
  const idx = renderIndexTier(site.rfcs.get(1), site);
  assert.equal((idx.match(/class="it-dot it-done">✓</g) || []).length, 1);
  const d = renderIndexTier({ ...r5952(), demand: 3 }, site);
  assert.match(d, /3 readers requested an explainer · counted daily/);
});

test('help cover it links', () => {
  const out = renderIndexTier(r5952(), site);
  const start = out.match(/href="(https:\/\/github.com\/adamloghry\/rfc.org\/new\/trunk\/content\/rfcs\?filename=5952.json&amp;value=[^"]+)"/);
  assert.ok(start, 'start link');
  const val = decodeURIComponent(start[1].split('value=')[1]);
  assert.deepEqual(JSON.parse(val), { number: 5952, category: 'core', summary: '', eli5: { summary: '' }, questions: [] });
  assert.ok(out.includes('href="https://github.com/adamloghry/rfc.akl.run/issues/new?template=request.yml&amp;title=Explainer%20request%3A%20RFC%205952"'));
  assert.ok(out.includes('href="/contribute/"'));
  assert.match(out, /Start the explainer ↗/);
  assert.match(out, /Request an explainer ↗/);
  assert.match(out, /How explainers work/);
});

test('index tier: abstract is lede, AUTO notice, NEW badge', () => {
  const rfc = site.rfcs.get(10055);
  assert.equal(rfc.tier, 'index');
  const out = renderIndexTier({ ...rfc, isNew: true }, site);
  assert.match(out, /<meta name="rfc-tier" content="index">/);
  assert.match(out, /badge-dashed[^>]*>INDEX PAGE</);
  assert.match(out, /Abstract from the RFC Editor index · no summary yet/);
  assert.match(out, /class="it-lede"/);
  assert.match(out, /AUTO/);
  assert.match(out, /badge-new[^>]*>NEW · OCT 2026</);
  assert.doesNotMatch(out, /AUTHORS' ABSTRACT/);
  const old = renderIndexTier(site.rfcs.get(1), site);
  assert.doesNotMatch(old, /badge-new/);
  assert.match(old, /AUTO/);
});

test('no hidden questions block (questions live in the search index)', () => {
  const out = renderIndexTier(withContent(r5952(), { questions: ['how to write ipv6'] }), site);
  assert.doesNotMatch(out, /how to write ipv6|visually-hidden/);
});

test('prev/next footer', () => {
  const out = renderIndexTier(r5952(), site);
  assert.match(out, /rfc\.akl\.run\/5952\//);
  assert.match(out, /href="\/5951\/">← RFC 5951/);
  assert.match(out, /href="\/5953\/">RFC 5953 →/);
  const first = renderIndexTier(site.rfcs.get(1), site);
  assert.doesNotMatch(first, /href="\/0\/"/);
  const last = renderIndexTier(site.rfcs.get(10055), site);
  assert.doesNotMatch(last, /href="\/10056\/"/);
});

test('relation lists are capped with "and N more"', () => {
  const many = Array.from({ length: 40 }, (_, i) => 100 + i);
  const out = renderIndexTier({ ...r5952(), updatedBy: many }, site);
  assert.match(out, /and 28 more/);
  assert.ok(out.includes('href="/graph/#5952"'));
});

test('gzip budget < 8192 (fixtures)', () => {
  for (const n of [5952, 1, 10055]) {
    const size = gz(renderIndexTier(site.rfcs.get(n), site));
    assert.ok(size < 8192, `RFC ${n}: ${size}`);
  }
});

test('gzip budget with the real index worst cases', { skip: !fs.existsSync('.cache/rfc-index.xml') }, async () => {
  const index = await loadIndex({ offline: true });
  const real = buildSite({ index, contentDir: 'test/fixtures/content', buildDate: new Date('2026-10-15') });
  const sizes = {};
  for (const n of [8996, 8148, 10055, 5952, 1]) {
    const rfc = real.rfcs.get(n);
    if (!rfc) continue;
    sizes[n] = gz(renderIndexTier(rfc, real));
    assert.ok(sizes[n] < 8192, `RFC ${n}: ${sizes[n]}`);
  }
  console.log('real-index gz sizes', JSON.stringify(sizes));
});

test('no abstract: honest wording, no abstract claim', () => {
  const out = renderIndexTier({ ...site.rfcs.get(1), abstract: null }, site);
  assert.match(out, /has no abstract for this RFC; read the original for details/);
  assert.doesNotMatch(out, /Below is the authors' abstract/);
  assert.doesNotMatch(out, /Abstract from the RFC Editor index/);
});

test('plain-text fields are escaped', () => {
  const x = '<script>alert(1)</script>';
  const out = renderIndexTier({ ...r5952(), title: x, authors: [x], abstract: x }, site);
  assert.doesNotMatch(out, /<script>alert\(1\)/);
  assert.ok(out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  const idx = renderIndexTier({ ...site.rfcs.get(1), title: x, authors: [x], abstract: x }, site);
  assert.doesNotMatch(idx, /<script>alert\(1\)/);
});
