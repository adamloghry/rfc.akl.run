import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, test } from 'vitest';
import { buildSite, readDir, tierOf } from '../src/lib/model';
import { entry, indexOf, rec, siteOf } from './builders';

const tmpDirs: string[] = [];
function tmpContent(files: Record<string, unknown> = {}): string {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'model-edge-'));
  tmpDirs.push(dir);
  for (const [rel, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof data === 'string' ? data : JSON.stringify(data));
  }
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('tierOf', () => {
  test('no content is an index page', () => {
    assert.equal(tierOf(null), 'index');
    assert.equal(tierOf({}), 'index');
  });

  test('a sequence-sim viz makes it interactive, even without sections', () => {
    assert.equal(tierOf({ viz: [{ type: 'packet' }, { type: 'sequence-sim' }] }), 'interactive');
    assert.equal(tierOf({ viz: [{ type: 'sequence-sim' }], sections: [{ id: 'a' }] }), 'interactive');
  });

  test('other viz types alone do not promote a page', () => {
    assert.equal(tierOf({ viz: [{ type: 'packet' }, { type: 'sequence' }] }), 'index');
  });

  test('sections make an explainer; an empty or non-array sections list does not', () => {
    assert.equal(tierOf({ sections: [{ id: 'a' }] }), 'explainer');
    assert.equal(tierOf({ sections: [] }), 'index');
    assert.equal(tierOf({ sections: 'nope' }), 'index');
    assert.equal(tierOf({ sections: [], summary: '<p>x</p>' }), 'summary');
  });

  test('a summary needs real text', () => {
    assert.equal(tierOf({ summary: '<p>x</p>' }), 'summary');
    assert.equal(tierOf({ summary: '   \n ' }), 'index');
    assert.equal(tierOf({ summary: '' }), 'index');
    assert.equal(tierOf({ summary: 42 }), 'index');
  });
});

describe('isNew', () => {
  const at = (e: Parameters<typeof entry>[1], build: string) => rec(siteOf([entry(1, e)], { buildDate: new Date(build) }), 1).isNew;

  test('30 whole days after a dated RFC is still new, 31 is not', () => {
    const e = { year: 2020, month: 5, day: 10 };
    assert.equal(at(e, '2020-06-09T00:00:00Z'), true);
    assert.equal(at(e, '2020-06-09T23:59:59Z'), true);
    assert.equal(at(e, '2020-06-10T00:00:00Z'), false);
  });

  test('the publication day itself and earlier build dates are new', () => {
    const e = { year: 2020, month: 5, day: 10 };
    assert.equal(at(e, '2020-05-10T00:00:00Z'), true);
    assert.equal(at(e, '2019-01-01T00:00:00Z'), true); // published "in the future" relative to the build
  });

  test('a missing day counts as the last day of the month, including February in a leap year', () => {
    const feb = { year: 2024, month: 2, day: null };
    assert.equal(at(feb, '2024-03-30T00:00:00Z'), true); // Feb 29 + 30 days
    assert.equal(at(feb, '2024-03-31T00:00:00Z'), false);
    const feb23 = { year: 2023, month: 2, day: null };
    assert.equal(at(feb23, '2023-03-30T00:00:00Z'), true); // Feb 28 + 30
    assert.equal(at(feb23, '2023-03-31T00:00:00Z'), false);
  });

  test('December rolls into the next year', () => {
    const dec = { year: 2025, month: 12, day: null };
    assert.equal(at(dec, '2026-01-30T00:00:00Z'), true);
    assert.equal(at(dec, '2026-01-31T00:00:00Z'), false);
  });
});

describe('merging index and content', () => {
  test('content overrides title, short title, slug, organization and non-empty authors', () => {
    const s = siteOf([entry(7)], {
      contents: [{ number: 7, title: 'Seven', shortTitle: 'VII', slug: 'seven', organization: 'Org', authors: ['Full Name'] }],
    });
    const r = rec(s, 7);
    assert.deepEqual([r.title, r.shortTitle, r.slug, r.organization, r.authors], ['Seven', 'VII', 'seven', 'Org', ['Full Name']]);
    assert.equal(r.indexTitle, 'Title of RFC 7', 'the index title is kept for citations');
    assert.deepEqual(r.indexAuthors, ['A. Author']);
  });

  test('empty content authors fall back to the index', () => {
    const r = rec(siteOf([entry(7)], { contents: [{ number: 7, authors: [] }] }), 7);
    assert.deepEqual(r.authors, ['A. Author']);
  });

  test('editors default to none and the date label is month name plus year', () => {
    const r = rec(siteOf([entry(7, { month: 11, year: 2001 })]), 7);
    assert.deepEqual(r.editors, []);
    assert.equal(r.dateLabel, 'November 2001');
    assert.equal(r.url, '/7/');
  });

  test('content for an RFC that is not in the index is rejected', () => {
    assert.throws(() => siteOf([entry(7)], { contents: [{ number: 8 }] }), /RFC 8 is not in the RFC index/);
  });

  test('categoryReviewed needs an explicit true in content or a listing in legacy-reviewed.json', () => {
    const dir = tmpContent({ 'legacy-reviewed.json': [3] });
    const s = buildSite({
      index: indexOf([entry(1), entry(2), entry(3)]),
      contentDir: dir,
      rfcs: [
        { number: 1, categoryReviewed: true, category: 'dns' },
        { number: 2, categoryReviewed: 'yes' },
      ],
      journeys: [],
      glossary: [],
    });
    assert.deepEqual(
      [1, 2, 3].map((n) => rec(s, n).categoryReviewed),
      [true, false, true],
    );
    assert.equal(rec(s, 1).category, 'dns');
  });

  test('the traffic signal feeds priority', () => {
    const dir = tmpContent({ 'signals/traffic.json': { '7': 10000 } });
    const base = siteOf([entry(7)]);
    const s = buildSite({ index: indexOf([entry(7)]), contentDir: dir, rfcs: [], journeys: [], glossary: [], buildDate: base.buildDate });
    assert.ok(rec(s, 7).priority > rec(base, 7).priority);
  });
});

describe('journeys and glossary', () => {
  const journey = (slug: string, ...numbers: number[]) => ({
    slug,
    title: slug,
    steps: [{ title: 's', rfcs: numbers.map((number) => ({ number })) }],
  });

  test('journeys are sorted by slug and each RFC lists a journey once', () => {
    const s = siteOf([entry(1), entry(2)], { journeys: [journey('b', 1, 1, 2), journey('a', 1, 999)] });
    assert.deepEqual(
      s.journeys.map((j) => j.slug),
      ['a', 'b'],
    );
    assert.deepEqual(rec(s, 1).journeys, ['a', 'b']);
    assert.deepEqual(rec(s, 2).journeys, ['b']);
  });

  test('journey steps without rfcs are tolerated', () => {
    const s = siteOf([entry(1)], { journeys: [{ slug: 'x', title: 'x', steps: [{ title: 's' } as never] }] });
    assert.deepEqual(rec(s, 1).journeys, []);
  });

  test('glossary usedBy is sorted, de-duplicated and ignores unknown ids', () => {
    const s = buildSite({
      index: indexOf([entry(9), entry(3)]),
      contentDir: path.join(process.cwd(), 'test', 'fixtures', 'none'),
      rfcs: [
        { number: 9, glossary: ['t1', 't1', 'ghost'] },
        { number: 3, glossary: ['t1'] },
      ],
      journeys: [],
      glossary: [
        { id: 't2', term: 'T2', definition: 'd' },
        { id: 't1', term: 'T1', definition: 'd', rfcs: [3] },
      ],
    });
    assert.deepEqual([...s.glossary.keys()], ['t1', 't2']);
    assert.deepEqual(s.glossary.get('t1')?.usedBy, [3, 9]);
    assert.deepEqual(s.glossary.get('t1')?.rfcs, [3]);
    assert.deepEqual(s.glossary.get('t2')?.rfcs, []);
    assert.deepEqual(s.glossary.get('t2')?.usedBy, []);
  });
});

describe('counts and gaps', () => {
  test('tier counts, reserved and not-issued numbers', () => {
    const s = siteOf([entry(1), entry(2), entry(5)], {
      notIssued: [3],
      max: 6,
      contents: [
        { number: 2, summary: '<p>x</p>' },
        { number: 5, sections: [{ id: 'a' }] },
      ],
    });
    assert.deepEqual(s.counts, { total: 3, index: 1, summary: 1, explainer: 1, interactive: 0 });
    assert.deepEqual([...s.reserved], [4, 6]);
    assert.deepEqual([...s.notIssued], [3]);
    assert.equal(s.max, 6);
    assert.equal(s.categories.length, 11);
  });
});

describe('content on disk', () => {
  test('readDir lists only .json files, sorted, and reports the file of a broken one', () => {
    const dir = tmpContent({ 'x/b.json': { n: 2 }, 'x/a.json': { n: 1 }, 'x/readme.txt': 'hi' });
    assert.deepEqual(
      readDir<{ n: number }>(path.join(dir, 'x')).map((f) => f.data.n),
      [1, 2],
    );
    assert.deepEqual(readDir(path.join(dir, 'missing')), []);
    fs.writeFileSync(path.join(dir, 'x', 'c.json'), '{broken');
    assert.throws(() => readDir(path.join(dir, 'x')), /c\.json/);
  });

  test('unsafe HTML on disk fails the build, naming file and field', () => {
    const dir = tmpContent({
      'rfcs/7.json': { number: 7, summary: '<script>alert(1)</script>' },
      'journeys/.keep': '',
    });
    assert.throws(() => buildSite({ index: indexOf([entry(7)]), contentDir: dir }), /rfcs\/7\.json: unsafe HTML at \/summary/);
  });

  test('glossary on disk is checked too, and RFC files for unknown numbers fail', () => {
    const bad = tmpContent({ 'glossary/t.json': { id: 't', term: 'T', definition: '<img src=x onerror=y>' } });
    assert.throws(() => buildSite({ index: indexOf([entry(7)]), contentDir: bad }), /glossary\/t\.json: unsafe HTML/);
    const unknown = tmpContent({ 'rfcs/8.json': { number: 8 } });
    assert.throws(() => buildSite({ index: indexOf([entry(7)]), contentDir: unknown }), /RFC 8 is not in the RFC index/);
  });

  test('a clean content directory builds, reading journeys and glossary from disk', () => {
    const dir = tmpContent({
      'rfcs/7.json': { number: 7, summary: '<p>fine</p>' },
      'journeys/j.json': { slug: 'j', title: 'J', steps: [{ title: 's', rfcs: [{ number: 7 }] }] },
      'glossary/g.json': { id: 'g', term: 'G', definition: '<p>d</p>' },
    });
    const s = buildSite({ index: indexOf([entry(7)]), contentDir: dir });
    assert.equal(rec(s, 7).tier, 'summary');
    assert.deepEqual(rec(s, 7).journeys, ['j']);
    assert.ok(s.glossary.has('g'));
  });
});
