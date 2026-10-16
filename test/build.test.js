'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { XMLValidator } = require('fast-xml-parser');
const { build } = require('../scripts/build');

const ROOT = path.join(__dirname, '..');
const opts = (outDir, extra = {}) => ({
  indexFile: path.join(ROOT, 'test/fixtures/rfc-index.sample.xml'),
  contentDir: path.join(ROOT, 'test/fixtures/content'),
  outDir, buildDate: new Date('2026-10-15'), quiet: true, ...extra,
});
const tmp = () => fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-build-'));
const read = (d, p) => fs.readFileSync(path.join(d, p), 'utf8');
const has = (d, p) => fs.existsSync(path.join(d, p));

test('full build over fixtures', async () => {
  const out = tmp();
  const res = await build(opts(out, {
    pages: ['rfcs', 'special', 'feeds'].map((n) => path.join(ROOT, 'scripts/pages', n + '.js')),
  }));
  assert.ok(res.counts.pages > 0);
  assert.ok(has(out, '903/index.html'));
  assert.ok(has(out, '1/index.html'));
  assert.match(read(out, '14/index.html'), /never issued/i);
  // a reserved number: 15..10055 not in index and not not-issued, e.g. 2
  assert.match(read(out, '2/index.html'), /not yet published/i);
  assert.ok(!has(out, 'rfc903/index.html'));
  assert.match(read(out, '_redirects'), /^\/rfc:num \/:num\/ 301$/m);
  assert.match(read(out, '_headers'), /\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  assert.ok(!has(out, '0903/index.html'));
  for (const f of ['404.html', 'sitemap.xml', 'robots.txt', 'feed.xml', 'data/coverage.json', 'data/graph.json', 'data/questions.json', 'data/titles/0.json']) assert.ok(has(out, f), f);

  const sm = read(out, 'sitemap.xml');
  assert.ok(sm.includes('https://rfc.akl.run/903/'));
  assert.ok(!sm.includes('/14/'));
  assert.ok(!sm.includes('rfc903'));
  assert.ok(!sm.includes('404'));
  assert.equal(XMLValidator.validate(sm), true);
  assert.match(read(out, 'robots.txt'), /^Sitemap: https:\/\/rfc\.akl\.run\/sitemap\.xml$/m);
  const feed = read(out, 'feed.xml');
  assert.equal(XMLValidator.validate(feed), true);
  assert.match(feed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);

  const cov = JSON.parse(read(out, 'data/coverage.json'));
  assert.equal(cov.max, 10055);
  assert.equal(cov.buildDate, '2026-10-15');
  const cells = Buffer.from(cov.cells, 'base64');
  assert.equal(cells.length, cov.max);
  assert.equal(cells[903 - 1] & 7, 5);
  assert.equal(cells[14 - 1] & 7, 0);
  assert.equal(cells[1 - 1] & 7, 2);
  assert.equal(cells[14 - 1] >> 4, 15);
  assert.equal(cov.categories[cells[903 - 1] >> 4], 'core');
  assert.ok(JSON.parse(read(out, 'data/titles/0.json'))['903']);
  assert.equal(JSON.parse(read(out, 'data/titles/0.json'))['903'][0], 'RARP');
  const q = JSON.parse(read(out, 'data/questions.json'));
  assert.ok(q.some((x) => x.href === '/journeys/diskless-boot/'));
  assert.ok(!has(out, 'index.html'), 'build must not emit index.html itself');
});

test('--only renders just those RFC pages', async () => {
  const out = tmp();
  await build(opts(out, { only: [903], pages: [path.join(ROOT, 'scripts/pages/rfcs.js')] }));
  assert.ok(has(out, '903/index.html'));
  assert.ok(!has(out, '1/index.html'));
});

test('duplicate output paths across modules throw', async () => {
  const out = tmp();
  await assert.rejects(() => build(opts(out, {
    pages: [path.join(ROOT, 'test/fixtures/pages/fake-a.js'), path.join(ROOT, 'test/fixtures/pages/fake-b.js')],
  })), /duplicate output path.*dup\/index\.html/i);
});

test('extra page modules are written and sitemapped by default', async () => {
  const out = tmp();
  await build(opts(out, { pages: [path.join(ROOT, 'test/fixtures/pages/fake-ok.js')] }));
  assert.ok(read(out, 'sitemap.xml').includes('https://rfc.akl.run/extra/'));
});

function contentCopy(edit) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-content-'));
  fs.cpSync(path.join(ROOT, 'test/fixtures/content'), dir, { recursive: true });
  edit(dir);
  return dir;
}
const editJson = (file, fn) => { const j = JSON.parse(fs.readFileSync(file, 'utf8')); fn(j); fs.writeFileSync(file, JSON.stringify(j)); };
const rfcsPage = path.join(ROOT, 'scripts/pages/rfcs.js');

test('build refuses unsafe HTML even when lint was skipped', async () => {
  const contentDir = contentCopy((d) => editJson(path.join(d, 'rfcs/826.json'), (j) => { j.sections[0].content = '<p onclick="x()">a</p>'; }));
  await assert.rejects(build(opts(tmp(), { contentDir, pages: [rfcsPage] })),
    /content\/rfcs\/826\.json: unsafe HTML at \/sections\/0\/content: attribute not allowed: onclick/);
  const gdir = contentCopy((d) => editJson(path.join(d, 'glossary/mac-address.json'), (j) => { j.definition = '<script>x</script>'; }));
  await assert.rejects(build(opts(tmp(), { contentDir: gdir, pages: [rfcsPage] })), /content\/glossary\/mac-address\.json: unsafe HTML at \/definition/);
});

test('a render error names the RFC and its content file', async () => {
  const contentDir = contentCopy((d) => editJson(path.join(d, 'rfcs/826.json'), (j) => { j.viz = [{ type: 'nonesuch', data: {} }]; }));
  await assert.rejects(build(opts(tmp(), { contentDir, pages: [rfcsPage] })),
    /^Error: RFC 826 \(content\/rfcs\/826\.json\): unknown viz type: nonesuch/);
});

test('dataFiles asserts the 4-bit category limit', () => {
  const { dataFiles } = require('../scripts/build');
  const cats = Array.from({ length: 16 }, (_, i) => ({ key: 'c' + i, name: 'C' + i }));
  assert.throws(() => dataFiles({ max: 1, categories: cats, rfcs: new Map(), notIssued: new Set(), journeys: [], buildDate: new Date() }), /4 bits.*16 categories/);
});
