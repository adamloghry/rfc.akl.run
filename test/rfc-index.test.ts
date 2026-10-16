// @ts-nocheck -- ported tests; types to be tightened in follow-up
import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import { parseIndex } from '../src/lib/rfc-index';

const HERE = process.cwd() + '/test';
const xml = fs.readFileSync(HERE + '/fixtures/rfc-index.sample.xml', 'utf8');
const idx = parseIndex(xml);

test('parses issued entries', () => {
  const r = idx.entries.get(903);
  assert.strictEqual(r.title, 'A Reverse Address Resolution Protocol');
  assert.deepStrictEqual(r.authors.length, 4);
  assert.strictEqual(r.year, 1984); assert.strictEqual(r.month, 6);
  assert.ok(r.isAlso.includes('STD38'));
  assert.strictEqual(r.doi, '10.17487/RFC0903'); // normalized: index emits RFC903, official DOI is padded
});
test('relations are RFC numbers only', () => {
  const r = idx.entries.get(2119);
  assert.ok(r.updatedBy.includes(8174));
  for (const e of idx.entries.values())
    for (const k of ['obsoletes', 'obsoletedBy', 'updates', 'updatedBy'])
      assert.ok(e[k].every(Number.isInteger), `${e.number}.${k}`);
});
test('not-issued and max', () => {
  assert.ok(idx.notIssued.has(14) && idx.notIssued.has(26));
  assert.ok(!idx.entries.has(14));
  assert.strictEqual(idx.max, 10055);
});
test('abstract paragraphs joined, whitespace collapsed', () => {
  const r = idx.entries.get(5952);
  assert.ok(r.abstract && !/\s{3,}/.test(r.abstract));
});
test('status kept raw', () => { assert.strictEqual(idx.entries.get(5952).status, 'PROPOSED STANDARD'); });
test('fails loudly on drift', () => {
  assert.throws(() => parseIndex('<rfc-index></rfc-index>'), /no rfc-entry/i);
  assert.throws(() => parseIndex(xml.replace(/<doc-id>RFC903<\/doc-id>/, '<doc-id>XYZ</doc-id>')), /doc-id/i);
});
test('editors are the subset of authors titled Editor', () => {
  const r = idx.entries.get(1122);
  assert.deepStrictEqual(r.editors, ['R. Braden']);
  assert.ok(r.authors.includes('R. Braden'));
  assert.deepStrictEqual(idx.entries.get(903).editors, []);
});
test('day, area, wg, stream, keywords, obsoletedBy', () => {
  assert.strictEqual(idx.entries.get(748).day, 1);
  assert.strictEqual(idx.entries.get(903).day, null);
  assert.strictEqual(idx.entries.get(903).stream, 'Legacy');
  assert.deepStrictEqual(idx.entries.get(903).keywords, ['RARP']);
  assert.strictEqual(idx.entries.get(903).pageCount, 4);
  assert.deepStrictEqual(idx.entries.get(10).obsoletedBy, [16]);
  assert.deepStrictEqual(idx.entries.get(10).obsoletes, [3]);
  assert.ok([...idx.entries.values()].some(e => e.area && e.wg));
});
