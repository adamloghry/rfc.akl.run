'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { buildSite } = require('../scripts/lib/model');
const { parseIndex } = require('../scripts/lib/rfc-index');
const assets = require('../scripts/lib/assets');
const cite = require('../scripts/lib/cite');
const status = require('../scripts/lib/status');
const { renderDatasheet } = require('../scripts/templates/datasheet');

const xml = fs.readFileSync('test/fixtures/rfc-index.sample.xml', 'utf8');
const site = buildSite({ index: parseIndex(xml), contentDir: 'test/fixtures/content', buildDate: new Date('2026-10-15') });
test.beforeEach(() => assets.useManifest(null));

// The fixture content retitles 903; use the index title so the title string matches the real page.
// The fixture's sim data is a stub, so borrow the viz fixture.
const realSim = JSON.parse(fs.readFileSync('test/fixtures/viz/rarp-sim.json', 'utf8'));
const base903 = site.rfcs.get(903);
const r903 = {
  ...base903, title: 'A Reverse Address Resolution Protocol',
  content: { ...base903.content, viz: base903.content.viz.map((v) => (v.type === 'sequence-sim' ? { ...realSim, anchor: v.anchor, position: v.position } : v)) },
};
const page = () => renderDatasheet(r903, site);

test('head: tier meta and title', () => {
  const h = page();
  assert.ok(h.includes('<meta name="rfc-tier" content="interactive">'));
  assert.ok(h.includes('<title>RFC 903 — RARP: A Reverse Address Resolution Protocol · rfc.akl.run</title>'));
  assert.match(h, /<h1[^>]*>RARP: A Reverse Address Resolution Protocol<\/h1>/);
});

test('badges: green for standard, amber for historic', () => {
  const h = page();
  assert.match(h, /class="badge badge-solid"[^>]*>RFC 903</);
  assert.match(h, /class="badge badge-green"[^>]*>INTERNET STANDARD</);
  const hist = { ...r903, ...(() => { const s = status.normalize('HISTORIC'); return { status: s.key, statusLabel: s.label, statusTone: s.tone }; })() };
  assert.match(renderDatasheet(hist, site), /class="badge badge-amber"[^>]*>HISTORIC</);
});

test('meta dl, lineage strip, TOC and section anchors', () => {
  const h = page();
  assert.ok(h.includes('PUBLISHED') && h.includes('June 1984') && h.includes('AUTHORS'));
  assert.ok(h.includes('LINEAGE · HOW HOSTS LEARN THEIR ADDRESS'));
  for (const n of [826, 903, 951, 1542, 2131]) assert.ok(h.includes(`href="/${n}/"`), `lineage ${n}`);
  assert.match(h, /<a[^>]*href="\/903\/"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/903\/"/);
  assert.ok(h.includes('href="/graph/#903"'));
  for (const id of ['introduction', 'packet-format']) {
    assert.ok(h.includes(`href="#${id}"`), `toc ${id}`);
    assert.match(h, new RegExp(`<section[^>]*id="${id}"`));
  }
  assert.match(h, /class="sec-anchor"[^>]*>§1</);
});

test('lineage strip hidden for single item', () => {
  const r = site.rfcs.get(5952);
  assert.ok(!renderDatasheet(r, site).includes('class="lineage"'));
});

test('reading level control only when eli5 exists', () => {
  const h = page();
  assert.ok(h.includes('data-level="eli5"') && h.includes('data-level="std"'));
  assert.ok(/class="rail-block level-ctl"/.test(h));
  const p826 = renderDatasheet(site.rfcs.get(826), site);
  assert.ok(!p826.includes('level-ctl'));
  assert.ok(!/data-level=/.test(p826.replace(/<script[\s\S]*?<\/script>/g, '')));
});

test('tl;dr only when present', () => {
  assert.ok(!page().includes('class="tldr"'));
  const withTldr = { ...r903, content: { ...r903.content, tldr: { problem: 'P', mechanism: 'M', outcome: 'O', outcomeLabel: 'Why it faded' } } };
  const h = renderDatasheet(withTldr, site);
  assert.ok(h.includes('class="tldr"') && h.includes('WHY IT FADED'));
});

test('cite block has exact RFC Editor string and bibtex pre', () => {
  const h = page();
  const { esc } = require('../scripts/lib/html');
  assert.ok(h.includes(esc(cite.rfcEditor(r903))));
  assert.match(h, /<pre[^>]*>@misc\{rfc903/);
  assert.match(h, /aria-controls="cite"/);
  assert.ok(h.includes('data-copy="https://rfc.akl.run/903/"'));
  assert.ok(h.includes('https://www.rfc-editor.org/rfc/rfc903.html'));
});

test('right rail: eli5, glossary, journeys', () => {
  const h = page();
  assert.ok(h.includes('A computer shouts its name tag number'));
  assert.ok(h.includes('href="/glossary/#mac-address"') && h.includes('MAC address'));
  assert.ok(h.includes('href="/journeys/diskless-boot/"'));
  const noEli = { ...r903, content: { ...r903.content, eli5: undefined } };
  assert.ok(!renderDatasheet(noEli, site).includes('class="pullquote"'));
});

test('references link to RFC pages; footer prev/next; viz inside section', () => {
  const h = page();
  assert.match(h, /<a[^>]*href="\/826\/"[^>]*class="ref-row"|<a[^>]*class="ref-row"[^>]*href="\/826\/"/);
  assert.ok(h.includes('href="/902/"') && h.includes('href="/904/"'));
  const sec = h.slice(h.indexOf('id="packet-format"'));
  const secEnd = sec.indexOf('</section>');
  assert.ok(sec.slice(0, secEnd).includes('data-viz="sequence-sim"'));
});

test('scripts include reader.js and viz scripts', () => {
  const h = page();
  assert.ok(h.includes('/assets/reader.js') && h.includes('/assets/sim.js'));
  assert.ok(!renderDatasheet(site.rfcs.get(826), site).includes('/assets/sim.js'));
});

test('obsoleted banner', () => {
  const r = { ...r903, obsoletedBy: [2131] };
  const h = renderDatasheet(r, site);
  assert.match(h, /Obsoleted by[\s\S]*RFC 2131[\s\S]*Which version should I read\?/);
  assert.ok(!page().includes('Which version should I read?'));
});

test('search markup', () => {
  const withQ = { ...r903, content: { ...r903.content, questions: ['how does a diskless computer get an ip address'] } };
  const h = renderDatasheet(withQ, site);
  assert.ok(h.includes('data-pagefind-body'));
  assert.match(h, /data-pagefind-meta="number:903/);
  assert.ok(h.includes('<div class="visually-hidden" data-pagefind-weight="8">how does a diskless computer get an ip address</div>'));
});

test('plain-text fields are HTML-escaped', () => {
  const r = { ...r903, authors: ['A <b>Evil</b> & Co'], organization: '<script>x</script>', content: { ...r903.content, subtitle: 'x <i>y</i>' } };
  const h = renderDatasheet(r, site);
  assert.ok(h.includes('A &lt;b&gt;Evil&lt;/b&gt; &amp; Co'));
  assert.ok(h.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.ok(h.includes('x &lt;i&gt;y&lt;/i&gt;'));
});

test('orphan viz without a matching anchor still renders, before References', () => {
  const sim = { ...realSim, anchor: 'nope' };
  const r = { ...r903, content: { ...r903.content, viz: [sim] } };
  const h = renderDatasheet(r, site);
  const at = h.indexOf('data-viz="sequence-sim"');
  assert.ok(at > 0 && at < h.indexOf('id="references"'));
});

test('mentioned-in is capped at 8; nested packet shape feeds the permalink note', () => {
  const r = { ...r903, mentionedIn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
  const h = renderDatasheet(r, site);
  const block = h.slice(h.indexOf('MENTIONED IN'));
  assert.strictEqual((block.slice(0, block.indexOf('</aside>')).match(/class="chip"/g) || []).length, 8);
  const pk = { type: 'packet', anchor: 'packet-format', data: { title: 't', bytes: 4, width: 32, fields: [{ key: 'hrd', name: 'H', bits: 16, desc: 'd' }, { key: 'pro', name: 'P', bits: 16, desc: 'd' }] } };
  const h2 = renderDatasheet({ ...r903, content: { ...r903.content, viz: [pk] } }, site);
  assert.ok(h2.includes('rfc.akl.run/903/#field-hrd'));
});

test('obsoleted tie-break picks the lowest number on equal dates', () => {
  const a = { ...site.rfcs.get(2131) }, b = { ...site.rfcs.get(2131), number: 9990, url: '/9990/' };
  const s2 = { ...site, rfcs: new Map(site.rfcs).set(9990, b) };
  const h = renderDatasheet({ ...r903, obsoletedBy: [9990, 2131] }, s2);
  assert.match(h, /Start with <a href="\/2131\/">/);
});

test('facts: RFC n linkified only for known RFCs; long values not mono; auto lineage eyebrow', () => {
  const rfc = { ...r903, content: { ...r903.content, lineage: undefined, facts: [
    { label: 'Related', value: 'RFC 826 — ARP, RFC 99999 — nope' },
    { label: 'EtherType', value: '0x8035' },
  ] } };
  const h = renderDatasheet(rfc, site);
  assert.match(h, /<dd>[^<]*<a href="\/826\/">RFC 826<\/a> — ARP, RFC 99999 — nope<\/dd>/);
  assert.match(h, /<dd class="mono">0x8035<\/dd>/);
  assert.ok(!h.includes('LINEAGE · LINEAGE'));
});

test('glossary chips are skipped for ids missing from the glossary', () => {
  const r = { ...r903, content: { ...r903.content, glossary: ['mac-address', 'no-such-term'] } };
  const h = renderDatasheet(r, site);
  assert.ok(h.includes('href="/glossary/#mac-address"'));
  assert.ok(!h.includes('no-such-term'));
});

test('facts: ones duplicating computed rows or status are hidden, others kept', () => {
  const facts = [
    { label: 'Published', value: 'DUPPUB' }, { label: ' Author ', value: 'DUPAUTH' }, { label: 'Status', value: 'DUPSTAT' },
    { label: 'Obsoleted By', value: 'DUPOBS' }, { label: 'Builds on', value: 'DUPBUILD' }, { label: 'Updates', value: 'DUPUPD' },
    { label: 'Packet size', value: 'KEEPSIZE' }, { label: 'Port', value: 'KEEPPORT' },
  ];
  const h = renderDatasheet({ ...r903, obsoletes: [826], updates: [], obsoletedBy: [826], updatedBy: [826], content: { ...r903.content, facts } }, site);
  for (const k of ['DUPPUB', 'DUPAUTH', 'DUPSTAT', 'DUPOBS', 'DUPBUILD', 'DUPUPD']) assert.ok(!h.includes(k), k);
  assert.ok(h.includes('KEEPSIZE') && h.includes('KEEPPORT'));
  assert.equal((h.match(/<dt>PUBLISHED<\/dt>/g) || []).length, 1);
});

test('facts: relation facts kept when the computed row is absent (903-style), hidden when present', () => {
  const facts = [{ label: 'Builds on', value: 'KEEPBUILD' }, { label: 'Updated by', value: 'KEEPUPD' }, { label: 'Status', value: 'DUPSTAT' }];
  const none = { ...r903, obsoletes: [], updates: [], obsoletedBy: [], updatedBy: [], content: { ...r903.content, facts } };
  const h1 = renderDatasheet(none, site);
  assert.ok(h1.includes('KEEPBUILD') && h1.includes('KEEPUPD') && !h1.includes('DUPSTAT'));
  const rel = { ...none, obsoletes: [826], updatedBy: [826] };
  const h2 = renderDatasheet(rel, site);
  assert.ok(!h2.includes('KEEPBUILD') && !h2.includes('KEEPUPD'));
});
