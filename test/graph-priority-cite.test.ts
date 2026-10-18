import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import * as cite from '../src/lib/cite';
import * as graph from '../src/lib/graph';
import * as priority from '../src/lib/priority';
import { entry, rec, siteOf } from './builders';

describe('priority score', () => {
  const buildDate = new Date('2026-10-15T00:00:00Z');
  const scoreOf = (e: Parameters<typeof entry>[1], opts: { traffic?: number; title?: string } = {}) => {
    const s = siteOf([entry(1, { title: opts.title ?? 'Plain', ...e })], { buildDate });
    const r = { ...rec(s, 1) };
    return priority.score(r, s, opts.traffic ?? 0);
  };

  test.each([
    'IANA Considerations for Foo',
    'Deprecating RC4 in TLS',
    'Updating References to Foo',
    'The Foo Registry',
    'Foo Registries and You',
    'Allocation of Foo Numbers',
    'Clarifications to Foo',
    'Errata Process',
    'Administrative Support for Foo',
    'Procedure for Foo',
    'Procedures for Foo',
    'Guidelines for Writing RFC Text',
    'iana considerations (lower case)',
    'DEPRECATED THING',
  ])('boilerplate title "%s" is demoted to 20%%', (title) => {
    const plain = scoreOf({ status: 'PROPOSED STANDARD' });
    assert.equal(scoreOf({ status: 'PROPOSED STANDARD' }, { title }), Math.round(plain * 0.2 * 100) / 100);
  });

  test.each([
    'Internet Protocol',
    'Guidelines for Mail Servers',
    'A Reverse Address Resolution Protocol',
    'Transmission Control Protocol',
  ])('normal title "%s" is not demoted', (title) => {
    assert.equal(scoreOf({ status: 'PROPOSED STANDARD' }, { title }), scoreOf({ status: 'PROPOSED STANDARD' }));
  });

  test('status weights; unknown statuses weigh nothing', () => {
    const weight = (status: string) => scoreOf({ status });
    assert.ok(weight('INTERNET STANDARD') > weight('BEST CURRENT PRACTICE'));
    assert.ok(weight('BEST CURRENT PRACTICE') > weight('PROPOSED STANDARD'));
    assert.ok(weight('PROPOSED STANDARD') > weight('INFORMATIONAL'));
    assert.ok(weight('INFORMATIONAL') > weight('EXPERIMENTAL'));
    assert.equal(weight('HISTORIC'), 0);
    assert.equal(weight('UNKNOWN'), 0);
  });

  test('STD membership adds 3 regardless of case', () => {
    const base = scoreOf({ status: 'HISTORIC' });
    assert.equal(scoreOf({ status: 'HISTORIC', isAlso: ['STD38'] }), base + 3);
    assert.equal(scoreOf({ status: 'HISTORIC', isAlso: ['std0038'] }), base + 3);
    assert.equal(scoreOf({ status: 'HISTORIC', isAlso: ['BCP14'] }), base);
  });

  describe('recent IETF standards-track bonus', () => {
    const published = { year: 2025, month: 10, day: 15 };
    const withAge = (days: number, extra: Parameters<typeof entry>[1] = {}) => {
      const d = new Date(Date.UTC(2026, 9, 15) - days * 86400000);
      return scoreOf({ status: 'PROPOSED STANDARD', year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), ...extra });
    };
    const old = scoreOf({ status: 'PROPOSED STANDARD', year: 1990, month: 1, day: 1 });

    test('applies up to and including 365 days, not after', () => {
      assert.equal(withAge(0), old + 2);
      assert.equal(withAge(365), old + 2);
      assert.equal(withAge(366), old);
      assert.ok(published.year);
    });

    test('a future-dated RFC gets none', () => {
      assert.equal(withAge(-1), old);
    });

    test('requires the IETF stream and a standards-track status', () => {
      assert.equal(withAge(10, { stream: 'IRTF' }), old);
      assert.equal(withAge(10, { stream: null }), old);
      assert.equal(withAge(10, { status: 'INFORMATIONAL' }), scoreOf({ status: 'INFORMATIONAL', year: 1990, month: 1, day: 1 }));
      assert.equal(withAge(10, { status: 'DRAFT STANDARD' }), scoreOf({ status: 'DRAFT STANDARD', year: 1990, month: 1, day: 1 }) + 2);
      assert.equal(
        withAge(10, { status: 'INTERNET STANDARD' }),
        scoreOf({ status: 'INTERNET STANDARD', year: 1990, month: 1, day: 1 }) + 2,
      );
    });
  });

  test('traffic adds a log-scaled bonus', () => {
    const base = scoreOf({ status: 'HISTORIC' });
    assert.equal(scoreOf({ status: 'HISTORIC' }, { traffic: 300 }), Math.round((base + Math.log2(4)) * 100) / 100);
  });

  test('obsoleted RFCs drop to 30% and stack with the boilerplate penalty; scores round to 2 places', () => {
    const live = scoreOf({ status: 'PROPOSED STANDARD', updatedBy: [2, 3, 4] });
    const dead = scoreOf({ status: 'PROPOSED STANDARD', updatedBy: [2, 3, 4], obsoletedBy: [9] });
    assert.equal(dead, Math.round(live * 0.3 * 100) / 100);
    const both = scoreOf({ status: 'PROPOSED STANDARD', updatedBy: [2, 3, 4], obsoletedBy: [9] }, { title: 'IANA Registry' });
    assert.equal(both, Math.round(live * 0.3 * 0.2 * 100) / 100);
    assert.equal(String(live).split('.')[1]?.length ?? 0, Math.min(2, String(live).split('.')[1]?.length ?? 0));
  });

  test('without a site the current time is used', () => {
    const s = siteOf([entry(1, { status: 'PROPOSED STANDARD', year: 1990 })]);
    assert.equal(priority.score(rec(s, 1)), priority.score(rec(s, 1), s));
  });
});

describe('graph.lineage', () => {
  const chain = (extra: Record<number, Parameters<typeof entry>[1]> = {}) =>
    siteOf(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry(n, { year: 1990 + n, month: 3, ...extra[n] })),
      {},
    );

  test('an RFC with no relations is its own lineage', () => {
    const s = chain();
    const l = graph.lineage(rec(s, 4), s);
    assert.equal(l.title, 'Lineage');
    assert.deepEqual(
      l.items.map((i) => [i.number, i.current]),
      [[4, true]],
    );
  });

  test('related RFCs are listed by date, duplicates once, unknown numbers dropped', () => {
    const s = chain({ 4: { obsoletes: [2, 3, 999], updates: [3], obsoletedBy: [6, 6] } });
    const l = graph.lineage(rec(s, 4), s);
    assert.deepEqual(
      l.items.map((i) => i.number),
      [2, 3, 4, 6],
    );
    assert.deepEqual(
      l.items.map((i) => i.current),
      [false, false, true, false],
    );
  });

  test('a window of five centres on the subject but clamps at both ends', () => {
    const all = [1, 2, 3, 4, 5, 6, 7];
    const rel = { obsoletes: all.filter((n) => n < 4), obsoletedBy: all.filter((n) => n > 4) };
    const s = chain({ 4: rel });
    const nums = (n: number) => graph.lineage(rec(s, n), s).items.map((i) => i.number);
    assert.deepEqual(nums(4), [2, 3, 4, 5, 6]);
    const s2 = chain({ 1: { obsoletedBy: [2, 3, 4, 5, 6, 7] } });
    assert.deepEqual(
      graph.lineage(rec(s2, 1), s2).items.map((i) => i.number),
      [1, 2, 3, 4, 5],
    );
    const s3 = chain({ 8: { obsoletes: [1, 2, 3, 4, 5, 6, 7] } });
    assert.deepEqual(
      graph.lineage(rec(s3, 8), s3).items.map((i) => i.number),
      [4, 5, 6, 7, 8],
    );
  });

  test('items carry year, url and the short title when there is one', () => {
    const s = siteOf([entry(1, { year: 1999 }), entry(2, { year: 2001, obsoletes: [1] })], {
      contents: [{ number: 1, shortTitle: 'One' }],
    });
    const l = graph.lineage(rec(s, 2), s);
    assert.deepEqual(l.items[0], { number: 1, year: 1999, label: 'One', current: false, url: '/rfc1' });
    assert.equal(l.items[1]?.label, 'Title of RFC 2');
  });

  test('curated lineage keeps its order, title and skips unknown numbers; an empty list falls back to auto', () => {
    const s = siteOf([entry(1), entry(2), entry(3, { obsoletes: [1] })], {
      contents: [
        { number: 3, lineage: { title: 'How it went', rfcs: [3, 77, 1] } },
        { number: 2, lineage: { rfcs: [2, 1] } },
        { number: 1, lineage: { rfcs: [] } },
      ],
    });
    const l3 = graph.lineage(rec(s, 3), s);
    assert.equal(l3.title, 'How it went');
    assert.deepEqual(
      l3.items.map((i) => i.number),
      [3, 1],
    );
    assert.equal(graph.lineage(rec(s, 2), s).title, 'Lineage');
    assert.deepEqual(
      graph.lineage(rec(s, 1), s).items.map((i) => i.number),
      [1],
    );
  });
});

describe('graph.contentMentions and mentions', () => {
  test('finds RFC n, RFCn and /n/ links across summary, today, sections and references', () => {
    const found = graph.contentMentions({
      summary: 'See RFC 791 and RFC826.',
      today: '<a href="/rfc903">x</a>',
      sections: [{ content: 'RFC 1 <a href="/rfc2">two</a>' }, { content: 42 }],
      references: [{ text: 'RFC 3', rfc: 4 }, { text: 'plain', rfc: 'x' }, { rfc: 5.5 }],
    });
    assert.deepEqual(
      [...found].sort((a, b) => a - b),
      [1, 2, 3, 4, 791, 826, 903],
    );
  });

  test('numbers with more than five digits are not RFC references', () => {
    assert.equal(graph.contentMentions({ summary: 'RFC 123456 and RFC 12345' }).has(123456), false);
    assert.equal(graph.contentMentions({ summary: 'RFC 12345' }).has(12345), true);
  });

  test('scanning the same text repeatedly gives the same answer (global regexes are reset)', () => {
    const c = { summary: 'RFC 1 RFC 2 RFC 3' };
    assert.deepEqual([...graph.contentMentions(c)], [1, 2, 3]);
    assert.deepEqual([...graph.contentMentions(c)], [1, 2, 3]);
  });

  test('null or empty content mentions nothing', () => {
    assert.equal(graph.contentMentions(null).size, 0);
    assert.equal(graph.contentMentions(undefined).size, 0);
    assert.equal(graph.contentMentions({}).size, 0);
  });

  test('mentionedIn is sorted, excludes self and unknown RFCs, and lists each citing RFC once', () => {
    const s = siteOf([entry(1), entry(2), entry(3)], {
      contents: [
        { number: 3, summary: 'RFC 1 RFC 1 RFC 2 RFC 3 RFC 999' },
        { number: 2, summary: 'RFC 1' },
      ],
    });
    assert.deepEqual(rec(s, 1).mentionedIn, [2, 3]);
    assert.deepEqual(rec(s, 2).mentionedIn, [3]);
    assert.deepEqual(rec(s, 3).mentionedIn, []);
  });
});

describe('graph dates', () => {
  test('pubDate uses the last day of the month when the day is missing', () => {
    assert.equal(graph.pubDate({ year: 2024, month: 2, day: null }).toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(graph.pubDate({ year: 2023, month: 2, day: null }).toISOString(), '2023-02-28T00:00:00.000Z');
    assert.equal(graph.pubDate({ year: 2023, month: 12, day: null }).toISOString(), '2023-12-31T00:00:00.000Z');
    assert.equal(graph.pubDate({ year: 2023, month: 12, day: 5 }).toISOString(), '2023-12-05T00:00:00.000Z');
  });

  test('byDate orders by date then number', () => {
    const a = { number: 2, year: 2000, month: 1, day: 5 };
    const b = { number: 1, year: 2000, month: 1, day: 5 };
    const c = { number: 3, year: 1999, month: 12, day: null };
    assert.deepEqual(
      [a, b, c].sort(graph.byDate).map((r) => r.number),
      [3, 1, 2],
    );
  });
});

describe('citations', () => {
  const base = { number: 7, title: 'T', authors: ['A. Author'], year: 2001, month: 4 };

  test.each([
    [['STD38'], 'STD 38'],
    [['STD0038'], 'STD 38'],
    [['BCP0014'], 'BCP 14'],
    [['FYI0004'], 'FYI 4'],
    [['bcp 14'], 'BCP 14'],
    [['STD0038', 'BCP0014'], 'STD 38, BCP 14'],
    [['weird-id'], 'weird-id'],
  ])('isAlso %j renders as "%s" between title and RFC number', (isAlso, text) => {
    assert.match(cite.rfcEditor({ ...base, isAlso }), new RegExp(`"T", ${text}, RFC 7,`));
  });

  test('editors: one, two (direct "and"), many; a mixed list marks only the editors', () => {
    const one = cite.rfcEditor({ ...base, authors: ['J. Postel'], editors: ['J. Postel'] });
    assert.ok(one.startsWith('Postel, J., Ed., "T"'));
    const two = cite.rfcEditor({ ...base, authors: ['J. Postel', 'J. Reynolds'], editors: ['J. Reynolds'] });
    assert.ok(two.startsWith('Postel, J. and J. Reynolds, Ed., "T"'));
    const mixed = cite.rfcEditor({ ...base, authors: ['A. One', 'B. Two', 'C. Three'], editors: ['B. Two'] });
    assert.ok(mixed.startsWith('One, A., Two, B., Ed., and C. Three, "T"'));
  });

  test('names: hyphenated initials, several surname words, mononyms', () => {
    const r = cite.rfcEditor({ ...base, authors: ['J.-P. Van Der Berg', 'Voltaire', 'M. Rose'] });
    assert.ok(r.startsWith('Van Der Berg, J.-P., Voltaire, and M. Rose, "T"'), r);
  });

  test('no authors drops the author list; indexTitle wins over title', () => {
    assert.ok(cite.rfcEditor({ ...base, authors: [], indexTitle: 'Index Title' }).startsWith('"Index Title", RFC 7'));
    assert.equal(cite.bibtex({ ...base, authors: [] }).includes('author = {},'), true);
  });

  test('indexAuthors win over authors in both formats', () => {
    const r = { ...base, authors: ['Full Name'], indexAuthors: ['F. Name'] };
    assert.ok(cite.rfcEditor(r).startsWith('Name, F., "T"'));
    assert.ok(cite.bibtex(r).includes('author = {F. Name},'));
  });

  test('bibtex months and optional fields', () => {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    for (const [i, m] of months.entries()) assert.ok(cite.bibtex({ ...base, month: i + 1 }).includes(`month = ${m},`), m);
    const full = cite.bibtex({ ...base, doi: '10.17487/RFC0007', pageCount: 12 });
    assert.ok(full.includes('doi = {10.17487/RFC0007},') && full.includes('pagetotal = 12,'));
    const bare = cite.bibtex(base);
    assert.ok(!bare.includes('doi') && !bare.includes('pagetotal'));
    assert.ok(bare.startsWith('@misc{rfc7,') && bare.endsWith('}'));
  });

  test('the DOI and URL appear in the RFC Editor style', () => {
    assert.match(
      cite.rfcEditor({ ...base, doi: '10.17487/RFC0007' }),
      /RFC 7, DOI 10\.17487\/RFC0007, April 2001, <https:\/\/www\.rfc-editor\.org\/info\/rfc7>\.$/,
    );
  });
});
