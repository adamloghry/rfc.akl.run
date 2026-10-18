import { describe, expect, test } from 'vitest';
import {
  docRow,
  matchQuestions,
  type Postings,
  parseNumber,
  plan,
  rank,
  shardOf,
  shardsOf,
  termsOf,
  tokenize,
} from '../src/scripts/search-core';

test('questions need every word >= 3 chars to match; numbers parse', () => {
  const qs = [
    { q: 'how does email get delivered', href: '/journeys/email', label: 'JOURNEY', title: 'Email' },
    { q: 'why is the padlock there', href: '/journeys/padlock', label: 'JOURNEY', title: 'Padlock' },
  ];
  expect(matchQuestions('email delivered', qs).length).toBe(1);
  expect(matchQuestions('email padlock', qs).length).toBe(0);
  expect(matchQuestions('is', qs).length).toBe(0);
  expect(matchQuestions('PADLOCK', qs)[0].href).toBe('/journeys/padlock');
  expect(parseNumber('903', 10065)).toBe(903);
  expect(parseNumber('0903', 10065)).toBe(903);
  expect(parseNumber('10066', 10065)).toBe(null);
  expect(parseNumber('tcp', 10065)).toBe(null);
  expect(parseNumber('0', 10065)).toBe(null);
});

describe('parseNumber', () => {
  test.each([
    ['1', 10, 1],
    ['10', 10, 10],
    ['11', 10, null],
    ['00', 10, null],
    ['007', 10, 7],
    [' 7', 10, null],
    ['7 ', 10, null],
    ['1e3', 10065, null],
    ['-3', 10, null],
    ['٣', 10, null],
    ['', 10, null],
  ])('%j against max %i', (q, max, expected) => {
    expect(parseNumber(q, max)).toBe(expected);
  });
});

describe('matchQuestions', () => {
  const qs = [{ q: 'How does DNS work?' }, { q: 'dns over https privacy' }];
  test('no list, empty query and short words yield nothing', () => {
    expect(matchQuestions('dns', null)).toEqual([]);
    expect(matchQuestions('dns', undefined)).toEqual([]);
    expect(matchQuestions('', qs)).toEqual([]);
    expect(matchQuestions('  ', qs)).toEqual([]);
    expect(matchQuestions('an of', qs)).toEqual([]);
  });
  test('short words are ignored but long ones still must all match, in any order, case-insensitively', () => {
    expect(matchQuestions('is DNS', qs).length).toBe(2);
    expect(matchQuestions('privacy https', qs).length).toBe(1);
    expect(matchQuestions('work does', qs).length).toBe(1);
  });
});

describe('plan', () => {
  test('duplicate query words share one slot; stopwords and one-letter words vanish', () => {
    const p = plan('the dns DNS a dns', {});
    expect(p.slots).toEqual([[{ term: 'dns', w: 1 }]]);
    expect(plan('', {}).slots).toEqual([]);
    expect(plan('the of', {}).slots).toEqual([]);
  });
  test('prefix expansion needs an open end, a 3+ letter last word and a table', () => {
    const table = { dns: ['dnssec', 'dnsx'], tcp: ['tcp'] };
    expect(plan('dns', table).slots[0]?.map((c) => c.term)).toEqual(['dns', 'dnssec', 'dnsx']);
    expect(plan('dns', table).slots[0]?.[1]?.w).toBe(0.6);
    expect(plan('dns ', table).slots[0]?.map((c) => c.term)).toEqual(['dns']);
    expect(plan('dn', table).slots[0]?.map((c) => c.term)).toEqual(['dn']);
    expect(plan('dns', null).slots[0]?.map((c) => c.term)).toEqual(['dns']);
    expect(plan('dns', undefined).slots[0]?.map((c) => c.term)).toEqual(['dns']);
    expect(plan('dns', { xyz: ['xyzzy'] }).slots[0]?.map((c) => c.term)).toEqual(['dns']);
    expect(plan('tcp', table).slots[0]?.map((c) => c.term)).toEqual(['tcp']); // the word itself is not repeated
  });
  test('only candidates that actually start with the typed word are used', () => {
    expect(plan('dnsx', { dns: ['dnsxyz', 'dnssec'] }).slots[0]?.map((c) => c.term)).toEqual(['dnsx', 'dnsxyz']);
    expect(plan('dns', { dns: ['dnssec', 'adns'] }).slots[0]?.map((c) => c.term)).toEqual(['dns', 'dnssec']);
  });
  test('the expansion goes on the last word, wherever it first appeared', () => {
    const p = plan('alpha beta alpha', { alp: ['alphabet'] });
    expect(p.slots.map((s) => s.map((c) => c.term))).toEqual([['alpha', 'alphabet'], ['beta']]);
  });
});

describe('termsOf and shardsOf', () => {
  test('terms are unique across slots; shards are unique and in range', () => {
    const p = {
      slots: [
        [
          { term: 'a1', w: 1 },
          { term: 'b2', w: 0.6 },
        ],
        [{ term: 'a1', w: 1 }],
      ],
    };
    expect(termsOf(p)).toEqual(['a1', 'b2']);
    const shards = shardsOf(p, 64);
    expect(new Set(shards).size).toBe(shards.length);
    expect(shards.every((k) => k >= 0 && k < 64)).toBe(true);
    expect(shardsOf({ slots: [] }, 64)).toEqual([]);
  });
});

describe('rank', () => {
  const postings = {
    red: [
      [1, 10],
      [2, 4],
      [3, 7],
    ],
    blue: [
      [2, 9],
      [3, 1],
    ],
    reddish: [[4, 20]],
  } satisfies Postings;

  test('nothing to rank gives nothing', () => {
    expect(rank({ slots: [] }, postings)).toEqual([]);
    expect(rank(plan('green', {}), postings)).toEqual([]);
  });
  test('documents matching every word beat those matching fewer, regardless of score', () => {
    const r = rank(plan('red blue', {}), postings);
    expect(r.map((x) => x.id)).toEqual([2, 3]);
    expect(r.every((x) => x.hits === 2)).toBe(true);
  });
  test('ties on score fall back to the lower id; limit truncates', () => {
    const tie = {
      x1: [
        [5, 3],
        [2, 3],
        [9, 3],
      ],
    } satisfies Postings;
    expect(rank(plan('x1', {}), tie).map((x) => x.id)).toEqual([2, 5, 9]);
    expect(rank(plan('x1', {}), tie, 2).map((x) => x.id)).toEqual([2, 5]);
    expect(rank(plan('x1', {}), tie, 0).length).toBe(3); // a falsy limit means "all"
  });
  test('an expansion contributes its best weighted score once per document', () => {
    const p = plan('red', { red: ['reddish'] });
    const r = rank(p, postings);
    expect(r.map((x) => [x.id, x.score])).toEqual([
      [4, 12],
      [1, 10],
      [3, 7],
      [2, 4],
    ]);
  });
  test('the exact word is not double counted when an expansion also matches the same doc', () => {
    const p = {
      slots: [
        [
          { term: 'red', w: 1 },
          { term: 'reddish', w: 0.6 },
        ],
      ],
    };
    const both = { red: [[1, 5]], reddish: [[1, 20]] } satisfies Postings;
    expect(rank(p, both)[0]).toEqual({ id: 1, score: 12, hits: 1 });
  });
});

describe('docRow', () => {
  test('pages and journeys without numbers, tiers without short titles', () => {
    expect(docRow(['/about/', null, 'About', null, 'page'])).toEqual({
      label: 'PAGE',
      title: 'About',
      tag: 'PAGE',
      tier: 'page',
      href: '/about/',
    });
    expect(docRow(['/journeys/x', null, 'Trip', null, 'journey'])).toEqual({
      label: 'JOURNEY',
      title: 'Trip',
      tag: 'JOURNEY',
      tier: '',
      href: '/journeys/x',
    });
    expect(docRow(['/rfc5', 5, 'Five', null, 'index'])).toEqual({
      label: 'RFC 5',
      title: 'Five',
      tag: 'INDEX',
      tier: 'index',
      href: '/rfc5',
    });
    expect(docRow(['/rfc6', 6, 'Six', 'VI', ''])).toMatchObject({ title: 'VI: Six', tag: '', tier: '' });
  });
});

describe('tokenize and shardOf (client copy)', () => {
  test('folds accents and compatibility forms, drops stopwords and short tokens', () => {
    expect(tokenize('Zürich ﬁle RFC 9110 a')).toEqual(['zurich', 'file', '9110']);
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
  test('shardOf is deterministic and bounded', () => {
    expect(shardOf('rarp', 64)).toBe(46);
    expect(shardOf('', 64)).toBe(0x811c9dc5 % 64);
  });
});
