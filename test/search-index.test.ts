import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { buildSite } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import * as idx from '../src/lib/search-index';

import * as core from '../src/scripts/search-core';
import { must } from './helpers';

const HERE = `${process.cwd()}/test`;
const withCore = test;

const site = buildSite({
  index: parseIndex(fs.readFileSync(path.join(HERE, 'fixtures', 'rfc-index.sample.xml'), 'utf8')),
  contentDir: path.join(HERE, 'fixtures', 'content'),
  buildDate: new Date('2026-10-15'),
});
// The fixture's RFC 903 has no questions and a different title; give it the real ones.
const r903 = must(site.rfcs.get(903));
site.rfcs.set(903, {
  ...r903,
  title: 'A Reverse Address Resolution Protocol',
  content: { ...r903.content, questions: ['how does a diskless computer get an ip address'] },
});
const built = idx.buildSearchIndex(site);
const byPath = new Map<string, unknown>(built.files.map((f) => [f.path, JSON.parse(f.json)]));
const docs = byPath.get('data/search/docs.json') as core.DocRowIn[];
const meta = byPath.get('data/search/meta.json') as { version: number; shards: number; docCount: number };
const prefix = byPath.get('data/search/prefix.json') as Record<string, string[]>;

/** Run a query end to end against the built files, using the client logic. */
function query(q: string) {
  const p = core.plan(q, prefix);
  const postings: core.Postings = {};
  for (const k of core.shardsOf(p, meta.shards)) Object.assign(postings, byPath.get(`data/search/t-${String(k).padStart(2, '0')}.json`));
  return core.rank(p, postings, 10).map((r) => core.docRow(must(docs[r.id])));
}

test('tokenize: lowercase, ASCII fold, split, stopwords, short tokens', () => {
  assert.deepEqual(idx.tokenize('How does the Résumé of TLS-1.3 work with IP?'), ['resume', 'tls', 'work', 'ip']);
  assert.deepEqual(idx.tokenize('RFC 903 a x NS'), ['903', 'ns']);
  assert.deepEqual(idx.tokenize(''), []);
  assert.deepEqual(idx.tokenize(null), []);
});

test('shardOf is stable and in range', () => {
  assert.equal(idx.shardOf('rarp', 64), idx.shardOf('rarp', 64));
  for (const t of ['a1', 'rarp', 'diskless', '903', 'tls']) {
    const k = idx.shardOf(t, 64);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 64);
  }
  assert.equal(idx.shardOf('', 64), 0x811c9dc5 % 64); // FNV-1a offset basis
  assert.equal(idx.shardOf('a', 1 << 30), 0xe40c292c % (1 << 30)); // known FNV-1a('a')
});

withCore('client tokenize/shardOf match the build-time implementation', () => {
  for (const s of ['Reverse Address Résolution', 'TLS 1.3 handshake', 'what is the ip of ns?', '903']) {
    assert.deepEqual(core.tokenize(s), idx.tokenize(s));
  }
  for (const t of ['rarp', 'diskless', 'tls', '903', 'resolution']) assert.equal(core.shardOf(t, 64), idx.shardOf(t, 64));
});

test('file count and paths', () => {
  const paths = built.files.map((f) => f.path);
  assert.equal(paths.length, 3 + 64);
  assert.equal(built.stats.files, 67);
  assert.ok(paths.every((p) => p.startsWith('data/search/') && p.endsWith('.json')));
  assert.ok(paths.includes('data/search/t-00.json') && paths.includes('data/search/t-63.json'));
  assert.deepEqual(meta, { version: 1, shards: 64, docCount: docs.length });
  assert.equal(docs.length, site.rfcs.size + site.journeys.length);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(buildFewer(8).files.length === 11);
});
function buildFewer(n: number) {
  return idx.buildSearchIndex(site, { shards: n });
}

test('doc table rows are [url, number|null, title, shortTitle, tier]', () => {
  const row = must(docs.find((d) => d[1] === 903));
  assert.equal(row[0], '/903/');
  assert.equal(typeof row[2], 'string');
  const j = must(docs.find((d) => d[0] === '/journeys/diskless-boot/'));
  assert.equal(j[1], null);
  assert.equal(j[4], 'journey');
});

withCore('RFC 903 is found by name, title words, question text and number', () => {
  for (const q of [
    'rarp',
    'reverse address',
    'diskless',
    'how does a diskless computer get an ip address',
    '903',
    'rfc 903',
    'reverse addr',
  ]) {
    const hits = query(q);
    assert.ok(
      hits.some((h) => h.href === '/903/'),
      `"${q}" should find /903/, got ${JSON.stringify(hits.map((h) => h.href))}`,
    );
  }
  assert.equal(must(query('903')[0]).href, '/903/');
  assert.equal(must(query('rarp')[0]).href, '/903/');
  assert.ok(query('diskless').some((h) => h.href === '/903/'));
});

withCore('an RFC is found through a word that appears only in its question (questions.json no longer lists them)', () => {
  const s2 = { ...site, rfcs: new Map(site.rfcs) };
  const r = must(s2.rfcs.get(903));
  s2.rfcs.set(903, { ...r, content: { ...r.content, questions: ['why does zyxwvuq happen'] } });
  const b2 = idx.buildSearchIndex(s2);
  const m = new Map<string, unknown>(b2.files.map((f) => [f.path, JSON.parse(f.json)]));
  const d2 = m.get('data/search/docs.json') as core.DocRowIn[];
  const pr = m.get('data/search/prefix.json') as Record<string, string[]>;
  const p = core.plan('zyxwvuq', pr);
  const postings: core.Postings = {};
  for (const k of core.shardsOf(p, meta.shards)) Object.assign(postings, m.get(`data/search/t-${String(k).padStart(2, '0')}.json`));
  const hits = core.rank(p, postings, 10).map((x) => core.docRow(must(d2[x.id])));
  assert.equal(must(hits[0]).href, '/903/');
});

withCore('journeys are found by their questions', () => {
  const hits = query('diskless computer ip address');
  assert.ok(hits.some((h) => h.href === '/journeys/diskless-boot/' && h.label === 'JOURNEY' && h.tag === 'JOURNEY'));
});

withCore('AND ranking, no junk for unmatched terms, empty query', () => {
  assert.deepEqual(query('zzzzqqq'), []);
  assert.deepEqual(query(''), []);
  assert.deepEqual(query('the of'), []);
  const hits = query('rarp zzzzqqq');
  assert.ok(hits.length === 0 || hits.every((h) => h.href));
});

test('postings are capped and sorted by score', () => {
  for (const [p, shard] of byPath) {
    if (!/t-\d+\.json$/.test(p)) continue;
    for (const list of Object.values(shard as core.Postings)) {
      assert.ok(list.length <= idx.MAX_POSTINGS);
      for (let i = 1; i < list.length; i++) assert.ok(must(list[i - 1])[1] >= must(list[i])[1]);
    }
  }
});

withCore('rank: AND first, then best partial; prefix expands the last token only', () => {
  const p = core.plan('alpha beta', {});
  const r = core.rank(
    p,
    {
      alpha: [
        [1, 5],
        [2, 9],
      ],
      beta: [
        [1, 1],
        [3, 8],
      ],
    },
    5,
  );
  assert.deepEqual(
    r.map((x) => x.id),
    [1],
  );
  const r2 = core.rank(
    core.plan('alpha gamma', {}),
    {
      alpha: [
        [1, 5],
        [2, 9],
      ],
    },
    5,
  );
  assert.deepEqual(
    r2.map((x) => x.id),
    [2, 1],
  );
  const pp = core.plan('alpha bet', { bet: ['beta', 'better'] });
  assert.deepEqual(
    pp.slots[0].map((c) => c.term),
    ['alpha'],
  );
  assert.deepEqual(
    pp.slots[1].map((c) => c.term),
    ['bet', 'beta', 'better'],
  );
  assert.deepEqual(
    core.plan('alpha bet ', { bet: ['beta'] }).slots[1].map((c) => c.term),
    ['bet'],
  );
  assert.deepEqual(core.shardsOf(pp, 64).length > 0, true);
});

withCore('docRow formats like the old Pagefind rows', () => {
  assert.deepEqual(core.docRow(['/903/', 903, 'A Reverse Address Resolution Protocol', 'RARP', 'interactive']), {
    label: 'RFC 903',
    title: 'RARP: A Reverse Address Resolution Protocol',
    tag: 'INTERACTIVE',
    tier: 'interactive',
    href: '/903/',
  });
  assert.equal(core.docRow(['/journeys/x/', null, 'T', null, 'journey']).label, 'JOURNEY');
});
