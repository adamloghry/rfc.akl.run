import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import * as lib from '../src/lib/search-index';
import * as client from '../src/scripts/search-core';
import { entry, siteOf } from './builders';

describe('tokenize', () => {
  const cases: Array<[string, string[]]> = [
    ['', []],
    ['   ', []],
    ['HTTP/1.1 and TLS', ['http', 'tls']], // "1" is a one-character token, "and" a stopword
    ['Zürich ﬁle: naïve résumé_test', ['zurich', 'file', 'naive', 'resume', 'test']],
    ['C++ is a language', ['language']],
    ['RFC 9110', ['9110']], // "rfc" is a stopword
    ['日本語 only', ['only']],
    ['x y zz', ['zz']],
    ['MiXeD-CaSe_words.here', ['mixed', 'case', 'words', 'here']],
    ['IPv6 address text representation', ['ipv6', 'address', 'text', 'representation']],
  ];
  test.each(cases)('%j', (input, expected) => {
    assert.deepEqual(lib.tokenize(input), expected);
    assert.deepEqual(client.tokenize(input), expected, 'client tokenizer agrees');
  });

  test('null, undefined and non-strings are coerced', () => {
    assert.deepEqual(lib.tokenize(null), []);
    assert.deepEqual(lib.tokenize(undefined), []);
    assert.deepEqual(lib.tokenize(12345), ['12345']);
    assert.deepEqual(client.tokenize(null), []);
  });
});

describe('shardOf stability (deployed clients and shards must keep agreeing)', () => {
  // Pinned values: changing the hash invalidates every cached shard and every old client bundle.
  const golden: Array<[string, number, number]> = [
    ['rarp', 46, 14],
    ['arp', 62, 14],
    ['dns', 60, 12],
    ['tcp', 16, 0],
    ['http', 37, 5],
    ['tls', 42, 10],
    ['reverse', 5, 5],
    ['address', 19, 3],
    ['903', 45, 13],
    ['zurich', 46, 14],
  ];
  test.each(golden)('%s -> %i of 64, %i of 16', (term, of64, of16) => {
    assert.equal(lib.shardOf(term), of64);
    assert.equal(lib.shardOf(term, 64), of64);
    assert.equal(lib.shardOf(term, 16), of16);
    assert.equal(client.shardOf(term, 64), of64);
    assert.equal(client.shardOf(term, 16), of16);
  });

  test('a single shard always maps to 0; every result is in range', () => {
    const terms = ['a', 'zz', 'rarp', 'x'.repeat(200), 'ünï', '0123456789'];
    for (const t of terms) {
      assert.equal(lib.shardOf(t, 1), 0);
      for (const n of [2, 7, 64, 100]) {
        const k = lib.shardOf(t, n);
        assert.ok(Number.isInteger(k) && k >= 0 && k < n, `${t}/${n}`);
        assert.equal(client.shardOf(t, n), k);
      }
    }
  });

  test('terms spread across shards (no degenerate clustering)', () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 400; i++) buckets.add(lib.shardOf(`term${i}`));
    assert.ok(buckets.size > 55, `only ${buckets.size} of 64 shards used`);
  });

  test('shard file names are zero-padded to two digits', () => {
    assert.equal(lib.shardName(0), 'data/search/t-00.json');
    assert.equal(lib.shardName(7), 'data/search/t-07.json');
    assert.equal(lib.shardName(63), 'data/search/t-63.json');
  });
});

describe('stripHtml', () => {
  test('removes tags and decodes the handful of entities the content uses', () => {
    assert.equal(lib.stripHtml('<p>a &amp; b&nbsp;c &lt;d&gt; &quot;e&quot; &#39;f&#039; &apos;g</p>').trim(), `a & b c <d> "e" 'f' 'g`);
    assert.equal(lib.stripHtml(null), '');
    assert.equal(lib.stripHtml(undefined), '');
    assert.equal(lib.stripHtml(5), '5');
  });
});

describe('building the index', () => {
  const entries = Array.from({ length: 12 }, (_, i) =>
    entry(i + 1, { title: `Routing protocol number ${i + 1}`, abstract: 'A shared abstract about gateways.', year: 1980 + i }),
  );

  test('output is deterministic and independent of Map insertion order', () => {
    const a = siteOf(entries);
    const b = siteOf([...entries].reverse());
    const fa = lib.buildSearchIndex(a);
    const fb = lib.buildSearchIndex(b);
    assert.deepEqual(fa.files, fb.files);
    assert.deepEqual(lib.buildSearchIndex(a).files, fa.files);
  });

  test('every shard file exists even when empty, and term keys are sorted', () => {
    const { files, stats } = lib.buildSearchIndex(siteOf(entries), { shards: 8 });
    assert.equal(files.length, 3 + 8);
    assert.equal(stats.shards, 8);
    for (const f of files.filter((x) => /t-\d\d\.json$/.test(x.path))) {
      const keys = Object.keys(JSON.parse(f.json));
      assert.deepEqual(keys, [...keys].sort(), f.path);
    }
  });

  test('every term lives in the shard shardOf names for it', () => {
    const { files } = lib.buildSearchIndex(siteOf(entries), { shards: 16 });
    for (const f of files) {
      const m = /t-(\d\d)\.json$/.exec(f.path);
      if (!m) continue;
      for (const term of Object.keys(JSON.parse(f.json))) assert.equal(lib.shardOf(term, 16), Number(m[1]), term);
    }
  });

  test('postings per term are capped at MAX_POSTINGS keeping the best scores', () => {
    const many = Array.from({ length: lib.MAX_POSTINGS + 30 }, (_, i) =>
      entry(i + 1, { title: i === 0 ? 'ubiquity ubiquity ubiquity' : 'ubiquity' }),
    );
    const { files, stats } = lib.buildSearchIndex(siteOf(many), { shards: 4 });
    const shard = files.find((f) => f.path === lib.shardName(lib.shardOf('ubiquity', 4)));
    const list = JSON.parse(shard?.json ?? '{}').ubiquity as Array<[number, number]>;
    assert.equal(list.length, lib.MAX_POSTINGS);
    assert.equal(list[0]?.[0], 0, 'the doc that repeats the term ranks first');
    assert.equal(stats.docs, many.length);
    for (let i = 1; i < list.length; i++) assert.ok((list[i - 1]?.[1] ?? 0) >= (list[i]?.[1] ?? 0));
  });

  test('prefix table: terms of 4+ chars appearing in 3+ docs, most frequent first, at most 8 per prefix', () => {
    const docs = [
      ...Array.from({ length: 5 }, (_, i) => entry(i + 1, { title: 'routing' })),
      ...Array.from({ length: 4 }, (_, i) => entry(10 + i, { title: 'routed' })),
      ...Array.from({ length: 2 }, (_, i) => entry(20 + i, { title: 'router' })),
      ...Array.from({ length: 3 }, (_, i) => entry(30 + i, { title: 'rot' })),
      ...Array.from({ length: 3 }, (_, i) => entry(40 + i, { title: 'rotate' })),
    ];
    const { files } = lib.buildSearchIndex(siteOf(docs));
    const prefix = JSON.parse(files.find((f) => f.path.endsWith('prefix.json'))?.json ?? '{}') as Record<string, string[]>;
    assert.deepEqual(prefix.rou, ['routing', 'routed']); // 'router' appears in only 2 docs
    assert.deepEqual(prefix.rot, ['rotate']); // 'rot' is shorter than 4 characters
    assert.equal(prefix.ro, undefined);
  });

  test('prefix tables cap at eight terms, ties broken alphabetically', () => {
    const words = ['alpha', 'alpine', 'alpaca', 'alphas', 'alpine1', 'alpha1', 'alpha2', 'alpha3', 'alpha4', 'alpha5'];
    const docs = words.flatMap((w, wi) => [1, 2, 3].map((k) => entry(wi * 10 + k, { title: w })));
    const { files } = lib.buildSearchIndex(siteOf(docs));
    const prefix = JSON.parse(files.find((f) => f.path.endsWith('prefix.json'))?.json ?? '{}') as Record<string, string[]>;
    assert.equal(prefix.alp?.length, 8);
    assert.deepEqual(prefix.alp, [...(prefix.alp ?? [])].sort());
  });

  test('shortTitle outranks title outranks abstract, and the number field outranks a title word', () => {
    // RFC 11 (doc 0): abstract only; RFC 12 (doc 1): title; RFC 13 (doc 2): short title.
    const s = siteOf([entry(11, { title: 'plain', abstract: 'zebra' }), entry(12, { title: 'zebra' }), entry(13, { title: 'plain' })], {
      contents: [{ number: 13, shortTitle: 'zebra' }],
    });
    const all: Record<string, Array<[number, number]>> = {};
    for (const f of lib.buildSearchIndex(s).files) if (/t-\d\d\.json$/.test(f.path)) Object.assign(all, JSON.parse(f.json));
    const score = (term: string, doc: number) => all[term]?.find((p) => p[0] === doc)?.[1] ?? 0;
    assert.ok(score('zebra', 2) > score('zebra', 1), 'short title beats title');
    assert.ok(score('zebra', 1) > score('zebra', 0), 'title beats the index abstract');
    assert.ok(score('zebra', 0) > 0);
    assert.ok(score('11', 0) > score('plain', 0), 'the RFC number term is heavily weighted');
  });

  test('non-index tiers do not index their (index-tier) abstract', () => {
    const s = siteOf([entry(1, { abstract: 'quokka' }), entry(2, { abstract: 'quokka' })], {
      contents: [{ number: 2, summary: '<p>wombat</p>' }],
    });
    const { files } = lib.buildSearchIndex(s);
    const all: Record<string, Array<[number, number]>> = {};
    for (const f of files) if (/t-\d\d\.json$/.test(f.path)) Object.assign(all, JSON.parse(f.json));
    assert.deepEqual(
      all.quokka?.map((p) => p[0]),
      [0],
    );
    assert.deepEqual(
      all.wombat?.map((p) => p[0]),
      [1],
    );
  });

  test('doc rows: url, number, title, short title, tier — journeys have no number', () => {
    const s = siteOf([entry(1)], {
      contents: [{ number: 1, shortTitle: 'One', summary: '<p>x</p>' }],
      journeys: [{ slug: 'trip', title: 'A trip', description: 'on the wire', questions: ['where does it go'], steps: [] }],
    });
    const docs = JSON.parse(lib.buildSearchIndex(s).files.find((f) => f.path.endsWith('docs.json'))?.json ?? '[]');
    assert.deepEqual(docs, [
      ['/1/', 1, 'Title of RFC 1', 'One', 'summary'],
      ['/journeys/trip/', null, 'A trip', null, 'journey'],
    ]);
  });
});
