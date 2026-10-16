// @ts-nocheck -- ported tests; types to be tightened in follow-up
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { checkDist } from '../scripts/check-dist';

const zlibGz = (str) => zlib.gzipSync(str, { level: 6 }).length;
const HERE = process.cwd() + '/test';

const REQUIRED = { '404.html': '<!doctype html>err', '404/index.html': '<!doctype html>rfc 404', '_redirects': '', '_headers': '' };

/** A dist/ with the required files present (so tests exercise one thing at a time). */
function dist(files, { bare = false } = {}) {
  files = bare ? files : { ...REQUIRED, ...files };
  const d = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-dist-'));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true });
    fs.writeFileSync(path.join(d, p), c);
  }
  return d;
}
const page = (body, tier = 'explainer') => `<!doctype html><meta name="rfc-tier" content="${tier}"><body>${body}</body>`;

test('broken link and missing anchor are errors', () => {
  const d = dist({
    '1/index.html': page('<a href="/2/">ok</a><a href="/nope/">bad</a><a href="/2/#missing">bad anchor</a><a href="/2/#here">good</a><a href="#self">s</a><h1 id="self">x</h1>'),
    '2/index.html': page('<h2 id="here">h</h2>'),
  });
  const r = checkDist(d);
  assert.equal(r.errors.length, 2, JSON.stringify(r.errors));
});

test('clean dist has 0 errors', () => {
  const d = dist({
    '1/index.html': page('<a href="/2/#here">x</a><link href="/assets/a.css" rel="stylesheet">'),
    '2/index.html': page('<h2 id="here">h</h2>'),
    'assets/a.css': 'body{}',
  });
  const r = checkDist(d);
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.pages, 4); // 2 pages + the two 404 pages
});

test('budgets: index-tier page over 8 KB gz is an error', () => {
  const noise = Array.from({ length: 4000 }, (_, i) => `<p>${Math.random().toString(36)}${i}</p>`).join('');
  const d = dist({
    '1/index.html': page(noise, 'index'),
  });
  const r = checkDist(d);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /1\/index\.html/);
});

test('fragments on hash-route pages are not checked', () => {
  const d = dist({
    '1/index.html': page('<a href="/graph/#1">g</a>'),
    'graph/index.html': page('<meta name="rfc-hash-route" content="1">router'),
  });
  assert.deepEqual(checkDist(d).errors, []);
});

test('sitemap URLs that do not resolve to a file are errors', () => {
  const d = dist({
    '1/index.html': page('x'),
    'sitemap.xml': '<urlset><url><loc>https://rfc.akl.run/1/</loc></url><url><loc>https://rfc.akl.run/gone/</loc></url></urlset>',
  });
  const r = checkDist(d);
  assert.deepEqual(r.errors, ['sitemap.xml: /gone/ does not resolve to a file in dist/']);
  assert.equal(r.stats.sitemapUrls, 2);
});

test('file count: error at the 20,000 limit, warning at 18,000', () => {
  const mk = (n) => { const f = {}; for (let i = 0; i < n; i++) f[`d/${i}.txt`] = ''; return dist(f); };
  const warn = checkDist(mk(18000));
  assert.deepEqual(warn.errors, []);
  assert.equal(warn.warnings.length, 1);
  assert.match(warn.warnings[0], /20000/);
  const bad = checkDist(mk(20000));
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /20000 files/);
  assert.deepEqual(checkDist(mk(10)).warnings, []);
});

test('_redirects rule limits: 2000 static, 100 dynamic', () => {
  const rules = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('\n');
  const ok = checkDist(dist({ '_redirects': '# c\n' + rules(2000, (i) => `/a${i} /1/ 301`) + '\n' + rules(100, (i) => `/b${i}/:x /1/ 301`) }));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.stats.redirects, { static: 2000, dynamic: 100 });
  const bad = checkDist(dist({ '_redirects': rules(2001, (i) => `/a${i} /1/ 301`) + '\n' + rules(101, (i) => `/b${i}/* /1/ 301`) }));
  assert.equal(bad.errors.length, 2);
});

test('missing 404.html, 404/index.html, _redirects or _headers is an error', () => {
  const ok = dist({ '1/index.html': page('x') });
  assert.deepEqual(checkDist(ok).errors, []);
  for (const f of Object.keys(REQUIRED)) {
    const d = dist({ '1/index.html': page('x'), ...REQUIRED }, { bare: true });
    fs.rmSync(path.join(d, f));
    const r = checkDist(d);
    assert.ok(r.errors.some((e) => e.startsWith(f + ' is missing')), `${f}: ${JSON.stringify(r.errors)}`);
  }
});

test('a not-found/ directory in dist is an error', () => {
  const d = dist({ '1/index.html': page('x'), 'not-found/index.html': page('x') });
  const r = checkDist(d);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /not-found\//);
});

test('JS budget follows static imports recursively, deduped per page', () => {
  const noise = Array.from({ length: 6000 }, () => Math.random().toString(36).slice(2)).join(',');
  const big = `export const x="${noise}";`;
  const d = dist({
    '1/index.html': page('<script type="module" src="/assets/entry.js"></script>'),
    'assets/entry.js': 'import"./mid.js";console.log(1)',
    'assets/mid.js': 'import { a } from "./big.js";import"./entry2.js";export{a}',
    'assets/entry2.js': 'import{b}from"./big.js";export const c=b',
    'assets/big.js': big,
  });
  const r = checkDist(d);
  assert.equal(r.errors.length, 1, JSON.stringify(r.errors));
  assert.match(r.errors[0], /^1\/index\.html: JS .* exceeds 25 KB/);
  const small = zlibGz(big);
  assert.ok(r.stats.maxJsGz.bytes >= small && r.stats.maxJsGz.bytes < small * 1.5, 'big chunk counted once');
  // the entry alone is tiny: without following imports this page would pass
  const d2 = dist({ '1/index.html': page('<script src="/assets/e.js"></script>'), 'assets/e.js': 'console.log(1)' });
  assert.deepEqual(checkDist(d2).errors, []);
});
