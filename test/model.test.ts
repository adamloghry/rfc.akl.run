import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import * as areas from '../src/lib/areas';
import * as graph from '../src/lib/graph';
import { buildSite } from '../src/lib/model';
import * as priority from '../src/lib/priority';
import { type IndexEntry, parseIndex, type RfcIndex } from '../src/lib/rfc-index';
import * as status from '../src/lib/status';
import { must } from './helpers';

const HERE = `${process.cwd()}/test`;

const CONTENT = path.join(HERE, 'fixtures', 'content');

function entry(number: number, over: Partial<IndexEntry> = {}): IndexEntry {
  return Object.assign(
    {
      number,
      title: `Title of RFC ${number}`,
      authors: ['A. Author'],
      editors: [],
      year: 1990,
      month: 1,
      day: null,
      status: 'INFORMATIONAL',
      pubStatus: 'INFORMATIONAL',
      stream: 'IETF',
      area: null,
      wg: null,
      abstract: null,
      keywords: [],
      pageCount: null,
      doi: `10.17487/RFC${String(number).padStart(4, '0')}`,
      errataUrl: null,
      isAlso: [],
      obsoletes: [],
      obsoletedBy: [],
      updates: [],
      updatedBy: [],
    },
    over,
  );
}

function makeIndex(): RfcIndex {
  const list = [
    entry(1, { title: 'Host Software', year: 1969, month: 4, status: 'UNKNOWN', pubStatus: 'UNKNOWN' }),
    entry(826, {
      title: 'An Ethernet Address Resolution Protocol',
      authors: ['D. Plummer'],
      year: 1982,
      month: 11,
      status: 'INTERNET STANDARD',
      isAlso: ['STD37'],
    }),
    entry(903, {
      title: 'A Reverse Address Resolution Protocol',
      authors: ['R. Finlayson', 'T. Mann', 'J.C. Mogul', 'M. Theimer'],
      year: 1984,
      month: 6,
      status: 'INTERNET STANDARD',
      pubStatus: 'INTERNET STANDARD',
      isAlso: ['STD38'],
      pageCount: 4,
    }),
    entry(951, { year: 1985, month: 9, updatedBy: [1084, 1497, 1542] }),
    entry(1084, { year: 1988, month: 12, updates: [951], updatedBy: [1542] }),
    entry(1497, { year: 1993, month: 8, obsoletes: [1084], updates: [951], obsoletedBy: [1542] }),
    entry(1542, { year: 1993, month: 10, obsoletes: [1497], updates: [951, 1084], obsoletedBy: [2131, 2132] }),
    entry(2131, { year: 1997, month: 3, obsoletes: [1542] }),
    entry(2132, { year: 1997, month: 3, obsoletes: [1542] }),
    entry(5952, {
      title: 'Recommendation for IPv6 Address Text Representation',
      year: 2010,
      month: 8,
      status: 'PROPOSED STANDARD',
      pubStatus: 'PROPOSED STANDARD',
      day: 15,
      wg: 'v6ops',
    }),
  ];
  return { entries: new Map(list.map((e) => [e.number, e])), notIssued: new Set([2]), max: 5953 };
}

const BUILD = new Date('2010-09-01T00:00:00Z');
const site = () => buildSite({ index: makeIndex(), contentDir: CONTENT, buildDate: BUILD });

test('merge: title from content, status/dates from index', () => {
  const r = must(site().rfcs.get(903));
  assert.equal(r.title, 'RARP: Finding Your Own Address');
  assert.equal(r.shortTitle, 'RARP');
  assert.deepEqual(r.authors, ['Ross Finlayson']);
  assert.equal(r.status, 'internet-standard');
  assert.equal(r.statusLabel, 'Internet Standard');
  assert.equal(r.statusTone, 'green');
  assert.equal(r.year, 1984);
  assert.equal(r.dateLabel, 'June 1984');
  assert.equal(r.url, '/903/');
  assert.equal(r.pageCount, 4);
  assert.deepEqual(r.isAlso, ['STD38']);
});

test('merge: index-only record uses index title and authors', () => {
  const r = must(site().rfcs.get(826));
  assert.equal(r.title, 'An Ethernet Address Resolution Protocol');
  const r1 = must(site().rfcs.get(1));
  assert.equal(r1.title, 'Host Software');
  assert.equal(r1.shortTitle, null);
  assert.deepEqual(r1.authors, ['A. Author']);
  assert.equal(r1.content, null);
  assert.equal(r1.status, 'unknown');
});

test('tiers', () => {
  const s = site();
  assert.equal(must(s.rfcs.get(903)).tier, 'interactive');
  assert.equal(must(s.rfcs.get(826)).tier, 'explainer');
  assert.equal(must(s.rfcs.get(5952)).tier, 'summary');
  assert.equal(must(s.rfcs.get(1)).tier, 'index');
  assert.deepEqual(s.counts, { total: 10, index: 7, summary: 1, explainer: 1, interactive: 1 });
});

test('reserved, notIssued, categories', () => {
  const s = site();
  assert.ok(s.notIssued.has(2));
  assert.ok(!s.reserved.has(2));
  assert.ok(s.reserved.has(3));
  assert.ok(s.reserved.has(904));
  assert.ok(!s.reserved.has(903));
  assert.ok(!s.reserved.has(0));
  assert.equal(s.max, 5953);
  assert.equal(s.categories[0].key, 'core');
  assert.equal(s.categories.length, 11);
});

test('category: content override, categoryReviewed from legacy list', () => {
  const s = site();
  assert.equal(must(s.rfcs.get(903)).category, 'core');
  assert.equal(must(s.rfcs.get(903)).categoryReviewed, true);
  assert.equal(must(s.rfcs.get(826)).categoryReviewed, false);
  assert.equal(must(s.rfcs.get(1)).categoryReviewed, false);
  assert.equal(must(s.rfcs.get(1)).category, 'meta');
});

test('guessCategory', () => {
  assert.equal(areas.guessCategory({ wg: 'httpbis' }), 'http');
  assert.equal(areas.guessCategory({ title: 'Domain Names - Concepts and Facilities' }), 'dns');
  assert.equal(areas.guessCategory({ area: 'rtg' }), 'routing');
  assert.equal(areas.guessCategory({}), 'meta');
  assert.equal(areas.guessCategory({ wg: 'tls', title: 'Domain Name thing' }), 'security');
  assert.equal(areas.guessCategory({ title: 'The Hypertext Transfer Protocol' }), 'http');
  assert.equal(areas.guessCategory({ title: 'Simple Mail Transfer Protocol' }), 'email');
  assert.equal(areas.guessCategory({ title: 'Address Resolution', area: 'tsv' }), 'core');
  assert.equal(areas.guessCategory({ area: 'ops' }), 'infrastructure');
  assert.equal(areas.name('http'), 'HTTP & Web');
  assert.throws(() => areas.name('nope'));
});

test('status.normalize', () => {
  assert.deepEqual(status.normalize('PROPOSED STANDARD'), { key: 'proposed-standard', label: 'Proposed Standard', tone: 'green' });
  assert.deepEqual(status.normalize('HISTORIC'), { key: 'historic', label: 'Historic', tone: 'amber' });
  assert.equal(status.normalize('BEST CURRENT PRACTICE').key, 'bcp');
  assert.equal(status.normalize('UNKNOWN').tone, 'neutral');
  assert.throws(() => status.normalize('SOMETHING NEW'), /SOMETHING NEW/);
});

test('isNew: within 30 days, last day of month when day is null', () => {
  const mk = (buildDate: Date) => buildSite({ index: makeIndex(), contentDir: CONTENT, buildDate }).rfcs;
  // 5952: 2010-08-15 (day known)
  assert.equal(must(mk(new Date('2010-09-14T12:00:00Z')).get(5952)).isNew, true);
  assert.equal(must(mk(new Date('2010-09-15T00:00:00Z')).get(5952)).isNew, false);
  // 2131: March 1997, day null -> March 31
  assert.equal(must(mk(new Date('1997-04-30T00:00:00Z')).get(2131)).isNew, true);
  assert.equal(must(mk(new Date('1997-05-01T00:00:00Z')).get(2131)).isNew, false);
  // same month, day unknown: pubDate (Mar 31) is after buildDate, still new
  assert.equal(must(mk(new Date('1997-03-10T00:00:00Z')).get(2131)).isNew, true);
});

test('mentionedIn: content references and links', () => {
  const s = site();
  assert.ok(must(s.rfcs.get(826)).mentionedIn.includes(903));
  assert.ok(!must(s.rfcs.get(903)).mentionedIn.includes(903));
  assert.deepEqual(
    must(s.rfcs.get(826)).mentionedIn,
    [...must(s.rfcs.get(826)).mentionedIn].sort((a, b) => a - b),
  );
  // journey and glossary wiring
  assert.deepEqual(must(s.rfcs.get(903)).journeys, ['diskless-boot']);
  assert.deepEqual(must(s.rfcs.get(826)).journeys, ['diskless-boot']);
  assert.deepEqual(must(s.rfcs.get(1)).journeys, []);
  assert.equal(s.journeys.length, 1);
  assert.deepEqual(must(s.glossary.get('mac-address')).usedBy, [903]);
  assert.equal(must(s.glossary.get('mac-address')).term, 'MAC address');
});

test('graph.mentions fills mentionedIn from a site', () => {
  const s = site();
  must(s.rfcs.get(826)).mentionedIn = [];
  graph.mentions(s);
  assert.ok(must(s.rfcs.get(826)).mentionedIn.includes(903));
});

test('lineage: curated list in order, current marked, unknown numbers skipped', () => {
  const s = site();
  const l = graph.lineage(must(s.rfcs.get(903)), s);
  assert.equal(l.title, 'How hosts learn their address');
  assert.deepEqual(
    l.items.map((i) => i.number),
    [826, 903, 951, 1542, 2131],
  );
  assert.deepEqual(
    l.items.map((i) => i.current),
    [false, true, false, false, false],
  );
  assert.equal(l.items[1].year, 1984);
  assert.equal(l.items[1].url, '/903/');
  assert.equal(l.items[1].label, 'RARP');
});

test('lineage: auto from relations, max 5, self centered', () => {
  const s = site();
  const l = graph.lineage(must(s.rfcs.get(1542)), s);
  assert.equal(l.items.length, 5);
  const nums = l.items.map((i) => i.number);
  assert.ok(nums.includes(1542));
  assert.deepEqual(nums, [1084, 1497, 1542, 2131, 2132]);
  assert.equal(must(l.items.find((i) => i.current)).number, 1542);
  const l2 = graph.lineage(must(s.rfcs.get(1497)), s);
  assert.deepEqual(
    l2.items.map((i) => i.number),
    [951, 1084, 1497, 1542],
  );
  assert.deepEqual(
    graph.lineage(must(s.rfcs.get(1)), s).items.map((i) => i.number),
    [1],
  );
});

test('priority monotonic and multipliers', () => {
  const s = site();
  const base = { ...must(s.rfcs.get(5952)) };
  const p0 = priority.score(base, s, 0);
  assert.equal(typeof p0, 'number');
  assert.ok(priority.score({ ...base, updatedBy: [1, 2] }, s, 0) > p0);
  assert.ok(priority.score({ ...base, mentionedIn: [1, 2, 3] }, s, 0) > p0);
  assert.ok(priority.score(base, s, 5000) > p0);
  const dead = priority.score({ ...base, obsoletedBy: [9999] }, s, 0);
  assert.equal(dead, Math.round(p0 * 0.3 * 100) / 100);
  const reg = priority.score({ ...base, title: 'IANA Registry for Foo' }, s, 0);
  assert.equal(reg, Math.round(p0 * 0.2 * 100) / 100);
});

test('priority: exact value for a known case', () => {
  const s = site();
  const r = { ...must(s.rfcs.get(903)), mentionedIn: [], updatedBy: [], obsoletes: [] };
  // internet-standard 4 + STD 3 ; stream IETF but old
  assert.equal(priority.score(r, s, 0), 7);
});

test('buildSite works on the parsed XML fixture index', () => {
  const index = parseIndex(fs.readFileSync(path.join(HERE, 'fixtures', 'rfc-index.sample.xml'), 'utf8'));
  const s = buildSite({ index, contentDir: CONTENT, buildDate: BUILD });
  const r = must(s.rfcs.get(903));
  assert.equal(r.status, 'internet-standard');
  assert.equal(r.pageCount, 4);
  assert.deepEqual(r.isAlso, ['STD38']);
  assert.equal(r.tier, 'interactive');
  assert.equal(must(s.rfcs.get(826)).tier, 'explainer');
  assert.equal(must(s.rfcs.get(5952)).tier, 'summary');
  assert.equal(must(s.rfcs.get(1)).tier, 'index');
  assert.ok(must(s.rfcs.get(826)).mentionedIn.includes(903));
  assert.equal(s.max, index.max);
  assert.ok(s.reserved.size > 0);
});

test('isNew: current-month RFC without a day is new; older is not', () => {
  const index = parseIndex(fs.readFileSync(path.join(HERE, 'fixtures', 'rfc-index.sample.xml'), 'utf8'));
  const s = buildSite({ index, contentDir: CONTENT, buildDate: new Date('2026-10-15T00:00:00Z') });
  assert.equal(must(s.rfcs.get(10055)).isNew, true);
  assert.equal(must(s.rfcs.get(903)).isNew, false);
});
