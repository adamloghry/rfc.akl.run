import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { decode as decodeCoverageDiff } from '../scripts/coverage-diff';
import { CATEGORIES } from '../src/lib/areas';
import {
  coverageJson,
  dataFiles,
  graphJson,
  ORIGIN,
  questionsJson,
  redirectsFile,
  robotsTxt,
  STATE,
  sitemapUrls,
  sitemapXml,
  titleShards,
  xmlEsc,
} from '../src/lib/data-files';
import type { RfcContent } from '../src/lib/model';
import { decode } from '../src/scripts/atlas';
import { entry, rec, siteOf } from './builders';

const TIER_CONTENT: Array<[string, RfcContent]> = [
  ['index', {}],
  ['summary', { summary: '<p>s</p>' }],
  ['explainer', { sections: [{ id: 'a', title: 'A', content: '<p>x</p>' }] }],
  ['interactive', { viz: [{ type: 'sequence-sim' }] }],
];

describe('coverage.json cell packing', () => {
  // One RFC for every (tier, category) pair, a bogus category, not-issued and reserved gaps.
  const cats = CATEGORIES.map((c) => c.key);
  const rows: Array<{ n: number; tier: string; category: string }> = [];
  for (const [t, [tier]] of TIER_CONTENT.entries())
    for (const [c, category] of cats.entries()) rows.push({ n: 1 + t * cats.length + c, tier, category });
  const bogus = rows.length + 1;
  const notIssued = [bogus + 1, bogus + 2];
  const max = bogus + 6; // leaves reserved numbers at the end
  const site = siteOf([...rows.map((r) => entry(r.n)), entry(bogus)], {
    notIssued,
    max,
    contents: [
      ...rows.map((r) => ({ number: r.n, category: r.category, ...(TIER_CONTENT.find(([t]) => t === r.tier)?.[1] ?? {}) })),
      { number: bogus, category: 'not-a-category' },
    ],
  });

  test('every state and category survives a round trip through the client decoder', () => {
    const c = JSON.parse(coverageJson(site));
    assert.equal(c.max, max);
    assert.deepEqual(c.categories, cats);
    const { state, cat } = decode(c.cells);
    assert.equal(state.length, max);
    for (const r of rows) {
      assert.equal(state[r.n - 1], STATE[r.tier], `state of ${r.n}`);
      assert.equal(c.categories[cat[r.n - 1] as number], r.category, `category of ${r.n}`);
    }
  });

  test('gaps carry state 0 (not issued) or 1 (reserved) and no category; unknown categories become "none" (15)', () => {
    const { state, cat } = decode(JSON.parse(coverageJson(site)).cells);
    assert.equal(state[bogus - 1], STATE.index);
    assert.equal(cat[bogus - 1], 15);
    for (const n of notIssued) assert.deepEqual([state[n - 1], cat[n - 1]], [STATE['not-issued'], 15]);
    for (let n = bogus + 3; n <= max; n++) assert.deepEqual([state[n - 1], cat[n - 1]], [STATE.reserved, 15], `reserved ${n}`);
  });

  test('the CI coverage-diff decoder reads the same bytes', () => {
    const c = JSON.parse(coverageJson(site));
    const cells = decodeCoverageDiff(c);
    assert.equal(cells.length, max);
    const first = cells[0];
    assert.deepEqual(first, { state: STATE.index, category: cats[0] });
    assert.deepEqual(cells[bogus - 1], { state: STATE.index, category: null });
    assert.deepEqual(cells[notIssued[0] - 1], { state: 0, category: null });
  });

  test('the highest valid category index is 14; sixteen categories are refused', () => {
    const tooMany = siteOf([entry(1)]);
    tooMany.categories = Array.from({ length: 16 }, (_, i) => ({ key: `c${i}`, name: `C${i}` }));
    assert.throws(() => coverageJson(tooMany), /4 bits/);
    const fifteen = siteOf([entry(1)], { contents: [{ number: 1, category: 'c14' }] });
    fifteen.categories = Array.from({ length: 15 }, (_, i) => ({ key: `c${i}`, name: `C${i}` }));
    const { cat } = decode(JSON.parse(coverageJson(fifteen)).cells);
    assert.equal(cat[0], 14);
  });

  test('build date is the ISO day', () => {
    assert.equal(JSON.parse(coverageJson(siteOf([entry(1)], { buildDate: new Date('2031-02-03T23:59:59Z') }))).buildDate, '2031-02-03');
  });
});

describe('title shards, questions, graph', () => {
  test('shard k holds numbers floor((n-1)/1000); each row is [short|null, title, year, status]', () => {
    const s = siteOf([entry(1000, { year: 1999 }), entry(1001), entry(2000), entry(2001)], {
      contents: [{ number: 1001, shortTitle: 'Short' }],
    });
    const shards = titleShards(s);
    assert.deepEqual(Object.keys(shards).sort(), ['0', '1', '2']);
    assert.deepEqual(Object.keys(JSON.parse(shards['0'] ?? '{}')), ['1000']);
    assert.deepEqual(Object.keys(JSON.parse(shards['1'] ?? '{}')), ['1001', '2000']);
    assert.deepEqual(JSON.parse(shards['0'] ?? '{}')['1000'], [null, 'Title of RFC 1000', 1999, 'informational']);
    assert.equal(JSON.parse(shards['1'] ?? '{}')['1001'][0], 'Short');
  });

  test('questions come from journeys and explainer-tier RFCs only, labelled for the search popup', () => {
    const s = siteOf([entry(1), entry(2), entry(3)], {
      contents: [
        { number: 1, questions: ['index tier question'] },
        { number: 2, sections: [{ id: 'a' }], questions: ['explainer question'], shortTitle: 'Two' },
        { number: 3, viz: [{ type: 'sequence-sim' }], questions: ['interactive question'] },
      ],
      journeys: [{ slug: 'trip', title: 'Trip', questions: ['journey question'], steps: [] }],
    });
    const q = JSON.parse(questionsJson(s));
    assert.deepEqual(q, [
      { q: 'journey question', href: '/journeys/trip/', label: 'JOURNEY', title: 'Trip' },
      { q: 'explainer question', href: '/2/', label: 'RFC 2', title: 'Two: Title of RFC 2' },
      { q: 'interactive question', href: '/3/', label: 'RFC 3', title: 'Title of RFC 3' },
    ]);
  });

  test('graph.json lists only RFCs with relations, using short titles when available', () => {
    const s = siteOf([entry(1, { obsoletedBy: [2] }), entry(2, { obsoletes: [1] }), entry(3)], {
      contents: [{ number: 2, shortTitle: 'Two' }],
    });
    const g = JSON.parse(graphJson(s));
    assert.deepEqual(Object.keys(g), ['1', '2']);
    assert.deepEqual(g['1'], { o: [], ob: [2], u: [], ub: [], t: 'Title of RFC 1', y: 1990 });
    assert.equal(g['2'].t, 'Two');
  });

  test('dataFiles aggregates every file under dist-relative paths', () => {
    const files = dataFiles(siteOf([entry(1)]));
    for (const p of [
      'data/coverage.json',
      'data/titles/0.json',
      'data/questions.json',
      'data/graph.json',
      'data/search/meta.json',
      'data/search/docs.json',
    ])
      assert.ok(p in files, p);
    for (const [p, body] of Object.entries(files)) assert.doesNotThrow(() => JSON.parse(body), p);
  });
});

describe('sitemap, robots, redirects', () => {
  test('sitemap urls: static pages, each RFC, areas and journeys; "/" first then natural order', () => {
    const s = siteOf([entry(10), entry(2), entry(100)], { journeys: [{ slug: 'trip', title: 'T', steps: [] }] });
    const urls = sitemapUrls(s);
    assert.equal(urls[0], '/');
    assert.ok(urls.indexOf('/2/') < urls.indexOf('/10/') && urls.indexOf('/10/') < urls.indexOf('/100/'), 'numeric-aware order');
    assert.ok(urls.includes('/journeys/trip/') && urls.includes('/areas/dns/') && urls.includes('/graph/'));
    assert.ok(!urls.includes('/contribute/') && !urls.includes('/coverage/'));
    assert.equal(new Set(urls).size, urls.length);
  });

  test('sitemapXml escapes and prefixes the origin', () => {
    const xml = sitemapXml(['/', '/a&b/']);
    assert.ok(xml.includes(`<loc>${ORIGIN}/</loc>`) && xml.includes(`<loc>${ORIGIN}/a&amp;b/</loc>`));
    assert.ok(xml.startsWith('<?xml') && xml.endsWith('</urlset>\n'));
  });

  test('robots.txt points at the sitemap', () => {
    assert.match(robotsTxt(), /^User-agent: \*\nAllow: \/\n\nSitemap: https:\/\/rfc\.akl\.run\/sitemap\.xml\n$/);
  });

  test('xmlEsc covers the XML specials', () => {
    assert.equal(xmlEsc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    assert.equal(xmlEsc(12), '12');
  });

  test('redirects: one rule per slug (from the record or its content), then the generic /rfcN rule last', () => {
    const s = siteOf([entry(1), entry(2), entry(3)], { contents: [{ number: 2, slug: 'two' }] });
    const body = redirectsFile(s);
    assert.ok(body.includes('/two /2/ 301\n'));
    assert.ok(body.endsWith('/rfc:num /:num/ 301\n'));
    assert.ok(!body.includes('/one'));
    assert.equal(
      redirectsFile(siteOf([entry(1)]))
        .split('\n')
        .filter((l) => l.endsWith('301')).length,
      2,
    );
    assert.ok(rec(s, 2).slug === 'two');
  });
});
