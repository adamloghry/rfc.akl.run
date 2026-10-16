// @ts-nocheck -- ported from node:test; vitest does not type-check
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { diff, decode, render } from '../scripts/coverage-diff';

const HERE = process.cwd() + '/test';

const cats = ['core', 'routing'];
function cov(bytes, extra) {
  return Object.assign({ max: bytes.length, buildDate: '2026-10-15', categories: cats, cells: Buffer.from(bytes).toString('base64') }, extra);
}
const b = (cat, state) => (cat << 4) | state;
const NONE = 15;

test('decode: state is low 3 bits, category index is high 4 bits', () => {
  const d = decode(cov([b(0, 5), b(NONE, 0), b(1, 2)]));
  assert.deepEqual(d[0], { state: 5, category: 'core' });
  assert.deepEqual(d[1], { state: 0, category: null });
  assert.deepEqual(d[2], { state: 2, category: 'routing' });
});

test('diff: identical coverage yields nothing', () => {
  const c = cov([b(0, 2), b(0, 3)]);
  assert.deepEqual(diff(c, c), { added: [], changed: [] });
});

test('diff: numbers beyond old max are added', () => {
  const r = diff(cov([b(0, 2)]), cov([b(0, 2), b(1, 2), b(NONE, 0)]));
  assert.deepEqual(r.added, [2, 3]);
  assert.deepEqual(r.changed, []);
});

test('diff: state change reports from/to labels', () => {
  const r = diff(cov([b(0, 2), b(0, 3)]), cov([b(0, 2), b(0, 4)]));
  assert.deepEqual(r.changed, [{ n: 2, from: 'summary', to: 'explainer' }]);
});

test('diff: category-only change is reported too', () => {
  const r = diff(cov([b(0, 2)]), cov([b(1, 2)]));
  assert.equal(r.changed.length, 1);
  assert.equal(r.changed[0].n, 1);
  assert.match(r.changed[0].from, /core/);
  assert.match(r.changed[0].to, /routing/);
});

test('diff: null old coverage treats everything as added', () => {
  assert.deepEqual(diff(null, cov([b(0, 2), b(0, 2)])).added, [1, 2]);
});

test('render: markdown mentions counts and is non-empty when no changes', () => {
  assert.match(render({ added: [], changed: [] }), /No coverage changes/);
  const md = render({ added: [5], changed: [{ n: 3, from: 'index', to: 'summary' }] });
  assert.match(md, /RFC 5/);
  assert.match(md, /RFC 3/);
  assert.match(md, /index/);
});
