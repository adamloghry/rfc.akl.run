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
  searchFiles,
  sitemapUrls,
  sitemapXml,
  titleShards,
  xmlEsc,
} from '../src/lib/data-files';
import { decode } from '../src/scripts/atlas';
import { entry, rec, siteOf } from './builders';

/** [raw index status, obsoletedBy, expected status class] */
const STATUS_CASES: Array<[string, number[], keyof typeof STATE]> = [
  ['INTERNET STANDARD', [], 'standard'],
  ['DRAFT STANDARD', [], 'standard'],
  ['PROPOSED STANDARD', [], 'standard'],
  ['BEST CURRENT PRACTICE', [], 'standard'],
  ['INFORMATIONAL', [], 'informational'],
  ['EXPERIMENTAL', [], 'informational'],
  ['UNKNOWN', [], 'unknown'],
  ['HISTORIC', [], 'historic'],
  ['PROPOSED STANDARD', [99999], 'historic'], // obsoleted wins over the published status
  ['INFORMATIONAL', [99999], 'historic'],
];

describe('coverage.json cell packing', () => {
  // One RFC for every (status case, category) pair, a bogus category, not-issued and reserved gaps.
  const cats = CATEGORIES.map((c) => c.key);
  const rows: Array<{ n: number; raw: string; obs: number[]; cls: keyof typeof STATE; category: string }> = [];
  for (const [t, [raw, obs, cls]] of STATUS_CASES.entries())
    for (const [c, category] of cats.entries()) rows.push({ n: 1 + t * cats.length + c, raw, obs, cls, category });
  const bogus = rows.length + 1;
  const notIssued = [bogus + 1, bogus + 2];
  const max = bogus + 6; // leaves reserved numbers at the end
  const site = siteOf([...rows.map((r) => entry(r.n, { status: r.raw, obsoletedBy: r.obs })), entry(bogus)], {
    notIssued,
    max,
    contents: [...rows.map((r) => ({ number: r.n, category: r.category })), { number: bogus, category: 'not-a-category' }],
  });

  test('every status class and category survives a round trip through the client decoder', () => {
    const c = JSON.parse(coverageJson(site));
    assert.equal(c.max, max);
    assert.deepEqual(c.categories, cats);
    const { state, cat } = decode(c.cells);
    assert.equal(state.length, max);
    for (const r of rows) {
      assert.equal(state[r.n - 1], STATE[r.cls], `state of ${r.n}`);
      assert.equal(c.categories[cat[r.n - 1] as number], r.category, `category of ${r.n}`);
    }
  });

  test('gaps carry state 0 (not issued) or 1 (reserved) and no category; unknown categories become "none" (15)', () => {
    const { state, cat } = decode(JSON.parse(coverageJson(site)).cells);
    assert.equal(state[bogus - 1], STATE.informational); // the builder default status is Informational
    assert.equal(cat[bogus - 1], 15);
    for (const n of notIssued) assert.deepEqual([state[n - 1], cat[n - 1]], [STATE['not-issued'], 15]);
    for (let n = bogus + 3; n <= max; n++) assert.deepEqual([state[n - 1], cat[n - 1]], [STATE.reserved, 15], `reserved ${n}`);
  });

  test('the CI coverage-diff decoder reads the same bytes', () => {
    const c = JSON.parse(coverageJson(site));
    const cells = decodeCoverageDiff(c);
    assert.equal(cells.length, max);
    const first = cells[0];
    assert.deepEqual(first, { state: STATE.standard, category: cats[0] });
    assert.deepEqual(cells[bogus - 1], { state: STATE.informational, category: null });
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
  test('shard k holds numbers floor((n-1)/1000); each row is [short|null, title, year, status, tier]', () => {
    const s = siteOf([entry(1000, { year: 1999 }), entry(1001), entry(2000), entry(2001)], {
      contents: [{ number: 1001, shortTitle: 'Short' }],
    });
    const shards = titleShards(s);
    assert.deepEqual(Object.keys(shards).sort(), ['0', '1', '2']);
    assert.deepEqual(Object.keys(JSON.parse(shards['0'] ?? '{}')), ['1000']);
    assert.deepEqual(Object.keys(JSON.parse(shards['1'] ?? '{}')), ['1001', '2000']);
    assert.deepEqual(JSON.parse(shards['0'] ?? '{}')['1000'], [null, 'Title of RFC 1000', 1999, 'informational', 'index']);
    assert.equal(JSON.parse(shards['1'] ?? '{}')['1001'][0], 'Short');
  });

  test('questions.json holds journey questions only; RFC questions live in the search index', () => {
    const s = siteOf([entry(1), entry(2), entry(3)], {
      contents: [
        { number: 1, questions: ['index tier question'] },
        { number: 2, sections: [{ id: 'a' }], questions: ['explainer question'], shortTitle: 'Two' },
        { number: 3, viz: [{ type: 'sequence-sim' }], questions: ['interactive question'] },
      ],
      journeys: [{ slug: 'trip', title: 'Trip', questions: ['journey question'], steps: [] }],
    });
    assert.deepEqual(JSON.parse(questionsJson(s)), [{ q: 'journey question', href: '/journeys/trip', label: 'JOURNEY', title: 'Trip' }]);
    const index = searchFiles(s);
    const all = Object.entries(index)
      .filter(([f]) => f.startsWith('t-'))
      .map(([, v]) => v)
      .join('');
    assert.ok(all.includes('"explainer"') && all.includes('"interactive"'), 'RFC question words are in the shards');
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
    assert.ok(urls.indexOf('/rfc2') < urls.indexOf('/rfc10') && urls.indexOf('/rfc10') < urls.indexOf('/rfc100'), 'numeric-aware order');
    assert.ok(urls.includes('/journeys/trip') && urls.includes('/areas/dns') && urls.includes('/graph'));
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

  test('redirects: one rule per slug (from the record or its content), and no generic /rfcN rule', () => {
    const s = siteOf([entry(1), entry(2), entry(3)], { contents: [{ number: 2, slug: 'two' }] });
    const body = redirectsFile(s);
    assert.ok(body.includes('/two /rfc2 301\n'));
    assert.ok(!body.includes('rfc:num'));
    assert.ok(!body.includes('/one'));
    assert.equal(
      redirectsFile(siteOf([entry(1)]))
        .split('\n')
        .filter((l) => l.endsWith('301')).length,
      0,
    );
    assert.ok(rec(s, 2).slug === 'two');
  });
});
