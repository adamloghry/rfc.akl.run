'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkDist } = require('../scripts/check-dist');

function dist(files) {
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
  assert.equal(r.stats.pages, 2);
});

test('budgets: index-tier page over 8 KB gz is an error; rfc redirect stubs skipped', () => {
  const noise = Array.from({ length: 4000 }, (_, i) => `<p>${Math.random().toString(36)}${i}</p>`).join('');
  const d = dist({
    '1/index.html': page(noise, 'index'),
    'rfc1/index.html': page(noise, 'index'),
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
