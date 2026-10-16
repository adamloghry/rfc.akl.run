// @ts-nocheck -- .astro imports have no TS module declarations under tsc; vitest (Astro plugins) resolves them
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Datasheet from '../src/components/rfc/Datasheet.astro';
import IndexTier from '../src/components/rfc/IndexTier.astro';
import NotIssued from '../src/components/rfc/NotIssued.astro';
import { buildSite } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import * as cite from '../src/lib/cite';
import * as status from '../src/lib/status';
import { isDupFact } from '../src/components/rfc/util';

const site = buildSite({
  index: parseIndex(fs.readFileSync('test/fixtures/rfc-index.sample.xml', 'utf8')),
  contentDir: 'test/fixtures/content',
  buildDate: new Date('2026-10-15'),
});
const container = await AstroContainer.create();
const ds = (rfc: any, s: any = site) => container.renderToString(Datasheet, { props: { rfc, site: s } });
const it = (rfc: any, s: any = site) => container.renderToString(IndexTier, { props: { rfc, site: s } });
const gz = (s: string) => zlib.gzipSync(s).length;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// The fixture content retitles 903; use the index title so the title string matches the real page.
const base903 = site.rfcs.get(903)!;
const r903: any = { ...base903, title: 'A Reverse Address Resolution Protocol' };
const r5952 = () => site.rfcs.get(5952)!;
const withContent = (rfc: any, over: any) => ({ ...rfc, content: { ...(rfc.content || {}), ...over } });

describe('Datasheet', () => {
  test('head: tier meta and title; badges', async () => {
    const h = await ds(r903);
    expect(h).toContain('<meta name="rfc-tier" content="interactive">');
    expect(h).toContain('<title>RFC 903 — RARP: A Reverse Address Resolution Protocol · rfc.akl.run</title>');
    expect(h).toMatch(/<h1[^>]*>RARP: A Reverse Address Resolution Protocol<\/h1>/);
    expect(h).toMatch(/class="badge badge-solid"[^>]*>RFC 903</);
    expect(h).toMatch(/class="badge badge-green"[^>]*>INTERNET STANDARD</);
    const s = status.normalize('HISTORIC');
    const hist = await ds({ ...r903, status: s.key, statusLabel: s.label, statusTone: s.tone });
    expect(hist).toMatch(/class="badge badge-amber"[^>]*>HISTORIC</);
  });

  test('meta dl, lineage strip, TOC and section anchors', async () => {
    const h = await ds(r903);
    expect(h).toContain('PUBLISHED');
    expect(h).toContain('June 1984');
    expect(h).toContain('LINEAGE · HOW HOSTS LEARN THEIR ADDRESS');
    for (const n of [826, 903, 951, 1542, 2131]) expect(h).toContain(`href="/${n}/"`);
    expect(h).toMatch(/<a[^>]*href="\/903\/"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/903\/"/);
    expect(h).toContain('href="/graph/#903"');
    for (const id of ['introduction', 'packet-format']) {
      expect(h).toContain(`href="#${id}"`);
      expect(h).toMatch(new RegExp(`<section[^>]*id="${id}"`));
    }
    expect(h).toMatch(/class="sec-anchor"[^>]*>§1</);
  });

  test('lineage strip hidden for a single item', async () => {
    expect(await ds(r5952())).not.toContain('class="container container-reader lineage"');
  });

  test('reading level control only when eli5 exists', async () => {
    const h = await ds(r903);
    expect(h).toContain('data-level="eli5"');
    expect(h).toContain('data-level="std"');
    expect(h).toMatch(/class="rail-block level-ctl"/);
    const p826 = await ds(site.rfcs.get(826));
    expect(p826).not.toContain('level-ctl');
    expect(p826.replace(/<script[\s\S]*?<\/script>/g, '')).not.toMatch(/data-level=/);
  });

  test('tl;dr only when present', async () => {
    expect(await ds(r903)).not.toContain('class="tldr"');
    const h = await ds(withContent(r903, { tldr: { problem: 'P', mechanism: 'M', outcome: 'O', outcomeLabel: 'Why it faded' } }));
    expect(h).toContain('class="tldr"');
    expect(h).toContain('WHY IT FADED');
  });

  test('cite block has the exact RFC Editor string and bibtex pre', async () => {
    const h = await ds(r903);
    expect(h).toContain(esc(cite.rfcEditor(r903)));
    expect(h).toMatch(/<pre[^>]*>@misc\{rfc903/);
    expect(h).toMatch(/aria-controls="cite"/);
    expect(h).toContain('data-copy="https://rfc.akl.run/903/"');
    expect(h).toContain('https://www.rfc-editor.org/rfc/rfc903.html');
  });

  test('right rail: eli5, glossary, journeys; unknown glossary ids skipped', async () => {
    const h = await ds(r903);
    expect(h).toContain('A computer shouts its name tag number');
    expect(h).toContain('href="/glossary/#mac-address"');
    expect(h).toContain('MAC address');
    expect(h).toContain('href="/journeys/diskless-boot/"');
    expect(await ds(withContent(r903, { eli5: undefined }))).not.toContain('class="pullquote"');
    const g = await ds(withContent(r903, { glossary: ['mac-address', 'no-such-term'] }));
    expect(g).toContain('href="/glossary/#mac-address"');
    expect(g).not.toContain('no-such-term');
  });

  test('references link to RFC pages; footer prev/next; viz inside its section; reader script', async () => {
    const h = await ds(r903);
    expect(h).toMatch(/<a[^>]*href="\/826\/"[^>]*class="ref-row"|<a[^>]*class="ref-row"[^>]*href="\/826\/"/);
    expect(h).toContain('href="/902/"');
    expect(h).toContain('href="/904/"');
    const sec = h.slice(h.indexOf('id="packet-format"'));
    expect(sec.slice(0, sec.indexOf('</section>'))).toContain('data-viz=');
  });

  test('obsoleted banner and tie-break on equal dates (lowest number wins)', async () => {
    const h = await ds({ ...r903, obsoletedBy: [2131] });
    expect(h).toMatch(/Obsoleted by[\s\S]*RFC 2131[\s\S]*Which version should I read\?/);
    expect(await ds(r903)).not.toContain('Which version should I read?');
    const b = { ...site.rfcs.get(2131), number: 9990, url: '/9990/' };
    const s2 = { ...site, rfcs: new Map(site.rfcs).set(9990, b as any) };
    expect(await ds({ ...r903, obsoletedBy: [9990, 2131] }, s2)).toMatch(/Start with <a href="\/2131\/">/);
  });

  test('plain-text fields are HTML-escaped', async () => {
    const h = await ds({ ...r903, authors: ['A <b>Evil</b> & Co'], organization: '<script>x</script>', content: { ...r903.content, subtitle: 'x <i>y</i>' } });
    expect(h).toContain('A &lt;b&gt;Evil&lt;/b&gt; &amp; Co');
    expect(h).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(h).toContain('x &lt;i&gt;y&lt;/i&gt;');
  });

  test('orphan viz without a matching anchor renders before References', async () => {
    const spec = r903.content.viz[0];
    const h = await ds(withContent(r903, { viz: [{ ...spec, anchor: 'nope' }] }));
    const at = h.indexOf('data-viz=');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(h.indexOf('id="references"'));
  });

  test('mentioned-in capped at 8; nested packet shape feeds the permalink note', async () => {
    const h = await ds({ ...r903, mentionedIn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const block = h.slice(h.indexOf('MENTIONED IN'));
    expect((block.slice(0, block.indexOf('</aside>')).match(/class="chip"/g) || []).length).toBe(8);
    const pk = { type: 'packet', anchor: 'packet-format', data: { title: 't', bytes: 4, width: 32, fields: [{ key: 'hrd', name: 'H', bits: 16, desc: 'd' }, { key: 'pro', name: 'P', bits: 16, desc: 'd' }] } };
    expect(await ds(withContent(r903, { viz: [pk] }))).toContain('rfc.akl.run/903/#field-hrd');
  });

  test('facts: RFC n linkified only for known RFCs; long values not mono', async () => {
    const h = await ds(withContent(r903, { lineage: undefined, facts: [
      { label: 'Related', value: 'RFC 826 — ARP, RFC 99999 — nope' },
      { label: 'EtherType', value: '0x8035' },
    ] }));
    expect(h).toMatch(/<dd>[^<]*<a href="\/826\/">RFC 826<\/a> — ARP, RFC 99999 — nope<\/dd>/);
    expect(h).toMatch(/<dd class="mono">0x8035<\/dd>/);
  });

  test('facts: duplicates of computed rows hidden, others kept', async () => {
    const facts = [
      { label: 'Published', value: 'DUPPUB' }, { label: ' Author ', value: 'DUPAUTH' }, { label: 'Status', value: 'DUPSTAT' },
      { label: 'Obsoleted By', value: 'DUPOBS' }, { label: 'Builds on', value: 'DUPBUILD' }, { label: 'Updates', value: 'DUPUPD' },
      { label: 'Packet size', value: 'KEEPSIZE' }, { label: 'Port', value: 'KEEPPORT' },
    ];
    const h = await ds({ ...r903, obsoletes: [826], updates: [], obsoletedBy: [826], updatedBy: [826], content: { ...r903.content, facts } });
    for (const k of ['DUPPUB', 'DUPAUTH', 'DUPSTAT', 'DUPOBS', 'DUPBUILD', 'DUPUPD']) expect(h).not.toContain(k);
    expect(h).toContain('KEEPSIZE');
    expect(h).toContain('KEEPPORT');
    expect((h.match(/<dt>PUBLISHED<\/dt>/g) || []).length).toBe(1);
  });

  test('facts: relation facts kept when the computed row is absent, hidden when present', async () => {
    const facts = [{ label: 'Builds on', value: 'KEEPBUILD' }, { label: 'Updated by', value: 'KEEPUPD' }, { label: 'Status', value: 'DUPSTAT' }];
    const none = { ...r903, obsoletes: [], updates: [], obsoletedBy: [], updatedBy: [], content: { ...r903.content, facts } };
    const h1 = await ds(none);
    expect(h1).toContain('KEEPBUILD');
    expect(h1).toContain('KEEPUPD');
    expect(h1).not.toContain('DUPSTAT');
    const h2 = await ds({ ...none, obsoletes: [826], updatedBy: [826] });
    expect(h2).not.toContain('KEEPBUILD');
    expect(h2).not.toContain('KEEPUPD');
    expect(isDupFact({ label: 'Status' })).toBe(true);
  });
});

describe('IndexTier', () => {
  test('summary tier (5952): head, badges, lede, buttons', async () => {
    const out = await it(r5952());
    expect(out).toContain('<meta name="rfc-tier" content="summary">');
    expect(out).toContain('<link rel="canonical" href="https://rfc.akl.run/5952/">');
    expect(out).toMatch(/badge-green[^>]*>PROPOSED STANDARD</);
    expect(out).toMatch(/badge-dashed[^>]*>SUMMARY</);
    expect(out).toContain('<h1 class="it-h1">A Recommendation for IPv6 Address Text Representation</h1>');
    expect(out).toMatch(/<div class="it-lede"><p>Describes how to write IPv6 addresses/);
    expect(out).toContain('Read the RFC ↗');
    expect(out).toContain('href="https://www.rfc-editor.org/rfc/rfc5952.html"');
    expect(out).toContain('href="https://datatracker.ietf.org/doc/rfc5952/"');
    expect(out).toContain("AUTHORS' ABSTRACT");
    expect(out).toContain('As IPv6 deployment increases');
    expect(out).not.toContain('Abstract from the RFC Editor index');
  });

  test('eli5 block, draft note', async () => {
    const out = await it(withContent(r5952(), { eli5: { summary: '<p>Write it one way.</p>' }, provenance: { source: 'llm-draft', reviewedBy: null } }));
    expect(out).toContain("Like I'm 5");
    expect(out).toContain('Write it one way.');
    expect(out).toContain('Draft · machine-assisted, not yet reviewed');
    const plain = await it(r5952());
    expect(plain).not.toContain('machine-assisted');
    expect(plain).not.toContain("Like I'm 5");
  });

  test('dl: facts, guessed area, doi', async () => {
    const out = await it(r5952());
    for (const k of ['PUBLISHED', 'AUTHORS', 'STREAM', 'UPDATES', 'DOI']) expect(out).toContain('>' + k + '<');
    expect(out).toContain('August 2010');
    expect(out).toContain('S. Kawamura, M. Kawashima');
    expect(out).toContain('AREA (GUESSED)');
    expect(out).toContain('from IETF area, unreviewed');
    expect(out).toContain('10.17487/RFC5952');
    expect(out).toMatch(/<a href="\/4291\/">RFC 4291/);
    expect(await it({ ...r5952(), categoryReviewed: true })).not.toContain('AREA (GUESSED)');
  });

  test('lineage 3-cell strip, has explainer, obsoleted warning', async () => {
    const out = await it(r5952());
    expect(out).toContain('class="it-lin"');
    expect(out).toContain('None — current');
    expect(out).toContain('UPDATED / OBSOLETED BY');
    expect(out).not.toContain('has explainer');
    const s2 = { ...site, rfcs: new Map(site.rfcs) };
    s2.rfcs.set(4291, { ...r5952(), number: 4291, tier: 'explainer', title: 'IPv6 Addressing Architecture' } as any);
    const out2 = await it(r5952(), s2);
    expect(out2).toContain('IPv6 Addressing Architecture');
    expect(out2).toContain('has explainer');
    const ob = await it({ ...r5952(), obsoletedBy: [9999] });
    expect(ob).not.toContain('None — current');
    expect(ob).toContain('class="it-warn"');
    expect(ob).toContain('href="/9999/"');
  });

  test('mentioned in only if non-empty', async () => {
    expect(await it(r5952())).not.toContain('MENTIONED IN');
    const out = await it({ ...r5952(), mentionedIn: [826, 903] });
    expect(out).toContain('MENTIONED IN');
    expect(out).toContain('href="/826/"');
  });

  test('coverage ladder: 4 cells, done ink, next tint, demand line', async () => {
    const out = await it(r5952());
    expect((out.match(/class="it-cell/g) || []).length).toBe(4);
    expect((out.match(/class="it-dot it-done">✓</g) || []).length).toBe(2);
    expect((out.match(/it-cell it-next/g) || []).length).toBe(1);
    expect(out).toMatch(/it-next[^]*?>3</);
    expect(out).not.toContain('readers requested');
    expect(((await it(site.rfcs.get(1)!)).match(/class="it-dot it-done">✓</g) || []).length).toBe(1);
    expect(await it({ ...r5952(), demand: 3 })).toContain('3 readers requested an explainer · counted daily');
  });

  test('help cover it links', async () => {
    const out = await it(r5952());
    const start = out.match(/href="(https:\/\/github.com\/adamloghry\/rfc.org\/new\/trunk\/content\/rfcs\?filename=5952.json&amp;value=[^"]+)"/);
    expect(start).toBeTruthy();
    const val = decodeURIComponent(start![1].split('value=')[1]);
    expect(JSON.parse(val)).toEqual({ number: 5952, category: 'core', summary: '', eli5: { summary: '' }, questions: [] });
    expect(out).toContain('href="https://github.com/adamloghry/rfc.akl.run/issues/new?template=request.yml&amp;title=Explainer%20request%3A%20RFC%205952"');
    expect(out).toContain('href="/contribute/"');
    expect(out).toContain('Start the explainer ↗');
    expect(out).toContain('How explainers work');
  });

  test('index tier: abstract is lede, AUTO notice, NEW badge, no-abstract wording', async () => {
    const rfc = site.rfcs.get(10055)!;
    expect(rfc.tier).toBe('index');
    const out = await it({ ...rfc, isNew: true });
    expect(out).toContain('<meta name="rfc-tier" content="index">');
    expect(out).toMatch(/badge-dashed[^>]*>INDEX PAGE</);
    expect(out).toContain('Abstract from the RFC Editor index · no summary yet');
    expect(out).toContain('class="it-lede"');
    expect(out).toContain('AUTO');
    expect(out).toMatch(/badge-new[^>]*>NEW · OCT 2026</);
    expect(out).not.toContain("AUTHORS' ABSTRACT");
    expect(await it(site.rfcs.get(1)!)).not.toContain('badge-new');
    const none = await it({ ...site.rfcs.get(1)!, abstract: null });
    expect(none).toContain('has no abstract for this RFC; read the original for details');
    expect(none).not.toContain("Below is the authors' abstract");
  });

  test('prev/next footer and relation cap', async () => {
    const out = await it(r5952());
    expect(out).toContain('rfc.akl.run/5952/');
    expect(out).toContain('href="/5951/">← RFC 5951');
    expect(out).toContain('href="/5953/">RFC 5953 →');
    expect(await it(site.rfcs.get(1)!)).not.toContain('href="/0/"');
    expect(await it(site.rfcs.get(10055)!)).not.toContain('href="/10056/"');
    const many = Array.from({ length: 40 }, (_, i) => 100 + i);
    const capped = await it({ ...r5952(), updatedBy: many });
    expect(capped).toContain('and 28 more');
    expect(capped).toContain('href="/graph/#5952"');
  });

  test('gzip budget < 8192 (fixtures)', async () => {
    for (const n of [5952, 1, 10055]) expect(gz(await it(site.rfcs.get(n)!))).toBeLessThan(8192);
  });

  test('plain-text fields are escaped', async () => {
    const x = '<script>alert(1)</script>';
    const out = await it({ ...r5952(), title: x, authors: [x], abstract: x });
    // '<' inside a quoted meta attribute is legal HTML; what matters is that no element is injected.
    expect(out.replace(/<meta[^>]*>/g, '')).not.toContain('<script>alert(1)');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('NotIssued', () => {
  test('never issued vs reserved copy, neighbours, noindex', async () => {
    const a = await container.renderToString(NotIssued, { props: { number: 14, kind: 'not-issued', max: 10055 } });
    expect(a).toContain('<meta name="rfc-tier" content="not-issued">');
    expect(a).toContain('RFC 14 was never issued');
    expect(a).toContain('NEVER ISSUED');
    expect(a).toContain('content="noindex, follow"');
    expect(a).toContain('href="/13/" rel="prev"');
    expect(a).toContain('href="/15/" rel="next"');
    const r = await container.renderToString(NotIssued, { props: { number: 10055, kind: 'reserved', max: 10055 } });
    expect(r).toContain('NOT YET PUBLISHED');
    expect(r).not.toContain('rel="next"');
    const first = await container.renderToString(NotIssued, { props: { number: 1, kind: 'reserved', max: 10055 } });
    expect(first).not.toContain('rel="prev"');
  });
});
