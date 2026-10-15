'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assets = require('../scripts/lib/assets');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rfc-assets-'));
let manifest;
test.before(async () => { manifest = await assets.build(out); });
test.after(() => { assets.useManifest(null); });

test('manifest has hashed site.css and theme.js', () => {
  assert.match(manifest['site.css'], /^\/assets\/site\.[0-9a-f]{8}\.css$/);
  assert.match(manifest['theme.js'], /^\/assets\/theme\.[0-9a-f]{8}\.js$/);
  assert.ok(fs.existsSync(path.join(out, manifest['site.css'].replace(/^\//, ''))));
});

test('fonts are copied with hashed names', () => {
  const dir = path.join(out, 'assets', 'fonts');
  const files = fs.readdirSync(dir);
  assert.ok(files.length >= 8, 'expected 8+ fonts, got ' + files.length);
  for (const f of files) assert.match(f, /\.[0-9a-f]{8}\.woff2$/);
  assert.ok(files.some((f) => /ibm-plex-sans-latin-400/.test(f)));
  assert.ok(files.some((f) => /ibm-plex-serif-latin-400-italic/.test(f)));
});

test('site.css has font-face, tokens and rewritten urls', () => {
  const css = fs.readFileSync(path.join(out, manifest['site.css'].replace(/^\//, '')), 'utf8');
  assert.match(css, /@font-face/);
  assert.match(css, /font-display:\s*swap/);
  assert.match(css, /--bg/);
  assert.match(css, /url\(\/assets\/fonts\/ibm-plex-sans-latin-400-normal\.[0-9a-f]{8}\.woff2\)/);
  assert.ok(css.indexOf('@font-face') < css.indexOf('--bg'));
});

test('url() uses manifest and throws on missing name', () => {
  assets.useManifest(manifest);
  assert.strictEqual(assets.url('site.css'), manifest['site.css']);
  assert.throws(() => assets.url('missing.js'), /missing\.js/);
});

test('url() falls back without a manifest', () => {
  assets.useManifest(null);
  assert.strictEqual(assets.url('reader.js'), '/assets/reader.js');
});
