import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { test } from 'vitest';
import { checkDist, forbiddenStrings, headersRuleStats, parseJsonc, redirectsSyntaxErrors } from '../scripts/check-dist';

const zlibGz = (str: string) => zlib.gzipSync(str, { level: 6 }).length;

const REQUIRED = { '404.html': '<!doctype html>err', 'rfc404.html': '<!doctype html>rfc 404', _redirects: '', _headers: '' };

/** A dist/ with the required files present (so tests exercise one thing at a time). */
function dist(files: Record<string, string>, { bare = false } = {}) {
  files = bare ? files : { ...REQUIRED, ...files };
  const d = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-dist-'));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true });
    fs.writeFileSync(path.join(d, p), c);
  }
  return d;
}
const page = (body: string, tier = 'explainer') => `<!doctype html><meta name="rfc-tier" content="${tier}"><body>${body}</body>`;

test('broken link and missing anchor are errors', () => {
  const d = dist({
    'rfc1.html': page(
      '<a href="/rfc2">ok</a><a href="/nope">bad</a><a href="/rfc2#missing">bad anchor</a><a href="/rfc2#here">good</a><a href="#self">s</a><h1 id="self">x</h1>',
    ),
    'rfc2.html': page('<h2 id="here">h</h2>'),
  });
  const r = checkDist(d);
  assert.equal(r.errors.length, 2, JSON.stringify(r.errors));
});

test('clean dist has 0 errors', () => {
  const d = dist({
    'rfc1.html': page('<a href="/rfc2#here">x</a><link href="/assets/a.css" rel="stylesheet">'),
    'rfc2.html': page('<h2 id="here">h</h2>'),
    'assets/a.css': 'body{}',
  });
  const r = checkDist(d);
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.pages, 4); // 2 pages + the two 404 pages
});

test('forbidden strings: github outside <main>, repo slug anywhere, Contribute, Request an explainer, feed.xml', () => {
  assert.deepEqual(forbiddenStrings('<p>plain text about RFCs</p>'), []);
  // GitHub is fine inside <main> (RFC content), including links and any case
  assert.deepEqual(forbiddenStrings('<header>x</header><main><p>Use GitHub today</p><a href="https://GitHub.com/x/y">code</a></main>'), []);
  // but not in the header, footer, nav, head or scripts
  assert.deepEqual(forbiddenStrings('<header><a href="https://github.com/x">GitHub</a></header><main>ok</main>'), ['github']);
  assert.deepEqual(forbiddenStrings('<main>ok</main><footer><a href="https://GitHub.com/x">src</a></footer>'), ['github']);
  assert.deepEqual(forbiddenStrings('<head><link href="https://github.com/x"></head><main>ok</main>'), ['github']);
  assert.deepEqual(forbiddenStrings('<a href="https://GitHub.com/x">x</a>'), ['github']);
  // the reader footer repeats the RFC's own title, which is RFC content (e.g. RFC 8875)
  const foot =
    '<main>ok</main><footer><div class="rd-foot"><span><span class="rd-foot-n">RFC 8875</span> — Working Group GitHub Administration</span></div></footer>';
  assert.deepEqual(forbiddenStrings(foot), []);
  assert.deepEqual(forbiddenStrings(`${foot}<footer><a href="https://github.com/x">src</a></footer>`), ['github']);
  // the RFC's own title/description metadata restates its official title, so it is allowed too
  assert.deepEqual(
    forbiddenStrings(
      '<title>RFC 8874 — Working Group GitHub Usage Guidance</title><meta name="description" content="use GitHub"><meta property="og:title" content="GitHub">',
    ),
    [],
  );
  // the repo slug is forbidden everywhere, even inside <main>
  assert.deepEqual(forbiddenStrings('<main><a href="https://example.com/Adamloghry/rfc.akl.run">x</a></main>'), ['repo slug']);
  assert.deepEqual(forbiddenStrings('<footer>adamloghry/rfc.akl.run</footer>'), ['repo slug']);
  assert.deepEqual(forbiddenStrings('<main><a href="https://github.com/adamloghry/rfc.akl.run">x</a></main>'), ['repo slug']);
  // solicitation rules apply everywhere, inside <main> too
  assert.deepEqual(forbiddenStrings('<a href="/contribute/">Contribute an explainer</a>'), ['Contribute']);
  assert.deepEqual(forbiddenStrings('<main><a href="/x/">Contribute</a></main>'), ['Contribute']);
  assert.deepEqual(forbiddenStrings('<h1>RFC 6417 — How to Contribute Research Results</h1>'), []);
  assert.deepEqual(forbiddenStrings('Request an explainer'), ['Request an explainer']);
  assert.deepEqual(forbiddenStrings('<link href="/feed.xml">'), ['feed.xml']);
  const d = dist({
    'rfc1.html': page('<nav><a href="https://github.com/a/b">src</a></nav><main>ok</main>'),
    'rfc2.html': page('<main><a href="https://github.com/a/b">impl</a></main>'),
  });
  assert.deepEqual(checkDist(d).errors, ['rfc1.html: contains forbidden string "github"']);
});

test('budgets: index-tier page over 8 KB gz is an error', () => {
  const noise = Array.from({ length: 4000 }, (_, i) => `<p>${Math.random().toString(36)}${i}</p>`).join('');
  const d = dist({
    'rfc1.html': page(noise, 'index'),
  });
  const r = checkDist(d);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /rfc1\.html/);
});

test('fragments on hash-route pages are not checked', () => {
  const d = dist({
    'rfc1.html': page('<a href="/graph#1">g</a>'),
    'graph.html': page('<meta name="rfc-hash-route" content="1">router'),
  });
  assert.deepEqual(checkDist(d).errors, []);
});

test('sitemap URLs that do not resolve to a file are errors', () => {
  const d = dist({
    'rfc1.html': page('x'),
    'sitemap.xml': '<urlset><url><loc>https://rfc.akl.run/rfc1</loc></url><url><loc>https://rfc.akl.run/gone</loc></url></urlset>',
  });
  const r = checkDist(d);
  assert.deepEqual(r.errors, ['sitemap.xml: /gone does not resolve to a file in dist/']);
  assert.equal(r.stats.sitemapUrls, 2);
});

test('file count: error at the 20,000 limit, warning at 18,000', () => {
  const mk = (n: number) => {
    const f: Record<string, string> = {};
    for (let i = 0; i < n; i++) f[`d/${i}.txt`] = '';
    return dist(f);
  };
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
  const rules = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join('\n');
  const ok = checkDist(dist({ _redirects: `# c\n${rules(2000, (i) => `/a${i} /1/ 301`)}\n${rules(100, (i) => `/b${i}/:x /1/ 301`)}` }));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.stats.redirects, { static: 2000, dynamic: 100 });
  const bad = checkDist(dist({ _redirects: `${rules(2001, (i) => `/a${i} /1/ 301`)}\n${rules(101, (i) => `/b${i}/* /1/ 301`)}` }));
  assert.equal(bad.errors.length, 2);
});

test('missing 404.html, rfc404.html, _redirects or _headers is an error', () => {
  const ok = dist({ 'rfc1.html': page('x') });
  assert.deepEqual(checkDist(ok).errors, []);
  for (const f of Object.keys(REQUIRED)) {
    const d = dist({ 'rfc1.html': page('x'), ...REQUIRED }, { bare: true });
    fs.rmSync(path.join(d, f));
    const r = checkDist(d);
    assert.ok(
      r.errors.some((e) => e.startsWith(`${f} is missing`)),
      `${f}: ${JSON.stringify(r.errors)}`,
    );
  }
});

test('a not-found/ directory in dist is an error', () => {
  const d = dist({ 'rfc1.html': page('x'), 'not-found/index.html': page('x') });
  const r = checkDist(d);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /not-found\//);
});

test('JS budget follows static imports recursively, deduped per page', () => {
  const noise = Array.from({ length: 6000 }, () => Math.random().toString(36).slice(2)).join(',');
  const big = `export const x="${noise}";`;
  const d = dist({
    'rfc1.html': page('<script type="module" src="/assets/entry.js"></script>'),
    'assets/entry.js': 'import"./mid.js";console.log(1)',
    'assets/mid.js': 'import { a } from "./big.js";import"./entry2.js";export{a}',
    'assets/entry2.js': 'import{b}from"./big.js";export const c=b',
    'assets/big.js': big,
  });
  const r = checkDist(d);
  assert.equal(r.errors.length, 1, JSON.stringify(r.errors));
  assert.match(r.errors[0], /^rfc1\.html: JS .* exceeds 25 KB/);
  const small = zlibGz(big);
  assert.ok(r.stats.maxJsGz.bytes >= small && r.stats.maxJsGz.bytes < small * 1.5, 'big chunk counted once');
  // the entry alone is tiny: without following imports this page would pass
  const d2 = dist({ 'rfc1.html': page('<script src="/assets/e.js"></script>'), 'assets/e.js': 'console.log(1)' });
  assert.deepEqual(checkDist(d2).errors, []);
});

test('_headers: 100 rules pass, 101 fail; overlong lines fail', () => {
  const rules = (n: number) => Array.from({ length: n }, (_, i) => `/p${i}/*\n  X-A: 1\n`).join('\n');
  assert.deepEqual(checkDist(dist({ _headers: rules(100) })).errors, []);
  const bad = checkDist(dist({ _headers: rules(101) }));
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /101 rules exceeds the limit of 100/);
  const long = checkDist(dist({ _headers: `/*\n  X-A: ${'x'.repeat(2000)}\n` }));
  assert.match(long.errors.join('\n'), /longer than 2000/);
  assert.deepEqual(headersRuleStats('# c\n/*\n  A: 1\n\n/b/*\n  B: 2\n'), { rules: 2, longLines: 0 });
});

test('_redirects syntax: valid placeholders pass; malformed rules are errors', () => {
  const ok = '# c\n/tcp /rfc793 301\n/rfc:num /rfc:num 301\n/old/* /new/:splat 302\n/x https://example.com/y 308\n';
  assert.deepEqual(redirectsSyntaxErrors(ok), []);
  assert.deepEqual(checkDist(dist({ _redirects: ok })).errors, []);
  assert.match(redirectsSyntaxErrors('/a')[0], /expected "source target/);
  assert.match(redirectsSyntaxErrors('a /b/ 301')[0], /must start with "\/"/);
  assert.match(redirectsSyntaxErrors('/a b 301')[0], /target "b" must be a path/);
  assert.match(redirectsSyntaxErrors('/a /b/ 200')[0], /status "200"/);
  assert.match(redirectsSyntaxErrors('/a/*/b/* /c/ 301')[0], /more than one splat/);
  assert.match(redirectsSyntaxErrors('/a/:x /b/:y 301')[0], /uses :y/);
  assert.match(redirectsSyntaxErrors('/a /b/:splat 301')[0], /uses :splat/);
  assert.match(checkDist(dist({ _redirects: '/a /b/:y 301\n' })).errors.join(), /uses :y/);
});

test('files over 25 MiB are errors', () => {
  const d = dist({ 'rfc1.html': page('x') });
  fs.writeFileSync(path.join(d, 'big.bin'), Buffer.alloc(25 * 1024 * 1024 + 1));
  fs.writeFileSync(path.join(d, 'ok.bin'), Buffer.alloc(25 * 1024 * 1024));
  const r = checkDist(d);
  assert.equal(r.errors.length, 1, JSON.stringify(r.errors));
  assert.match(r.errors[0], /^big\.bin: 25\.0 MiB exceeds the Cloudflare limit of 25 MiB per file/);
});

test('wrangler.jsonc assets.directory must equal the checked dist dir', () => {
  const d = dist({ 'rfc1.html': page('x') });
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-wr-'));
  const cfg = path.join(root, 'wrangler.jsonc');
  const write = (directory: string) =>
    fs.writeFileSync(
      cfg,
      `{\n  // comment with "quotes" and a // slash\n  "name": "x", /* block */\n  "assets": { "directory": ${JSON.stringify(directory)}, "url": "http://a//b", },\n}\n`,
    );
  write(path.relative(root, d));
  assert.deepEqual(checkDist(d, { wranglerConfig: cfg }).errors, []);
  write('./dist');
  const bad = checkDist(d, { wranglerConfig: cfg });
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /assets\.directory "\.\/dist" resolves to .*not the checked directory/);
  fs.writeFileSync(cfg, '{"name":"x"}');
  assert.match(checkDist(d, { wranglerConfig: cfg }).errors[0], /assets\.directory is not set/);
  assert.match(checkDist(d, { wranglerConfig: path.join(root, 'missing.jsonc') }).errors[0], /cannot read or parse/);
  assert.deepEqual(parseJsonc('{"a":"x//y" /* c */, // d\n "b":[1,],}'), { a: 'x//y', b: [1] });
});

test('the repo wrangler.jsonc points at dist/', () => {
  const cfg = parseJsonc(fs.readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8'));
  assert.equal(path.resolve(cfg.assets.directory), path.resolve(process.cwd(), 'dist'));
  assert.equal(cfg.name, 'rfc-akl-run');
  assert.equal(cfg.workers_dev, true);
  assert.equal(cfg.preview_urls, true);
  assert.equal(cfg.assets.not_found_handling, '404-page');
});

test('inline scripts must be covered by the _headers CSP', () => {
  const code = 'document.title="x"';
  const hash = `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
  const pg = page(`<script>${code}</script><script type="application/json">{"a":1}</script><script src="/assets/a.js"></script>`);
  const csp = (s: string) => `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' ${s}\n`;
  assert.deepEqual(checkDist(dist({ 'rfc1.html': pg, 'assets/a.js': '', _headers: csp(hash) })).errors, []);
  const bad = checkDist(dist({ 'rfc1.html': pg, 'assets/a.js': '', _headers: csp('') }));
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /inline script 'sha256-.*' is not allowed/);
});

test('inline <style> elements must be covered by the _headers CSP style-src', () => {
  const css = 'body{color:red}';
  const hash = `'sha256-${createHash('sha256').update(css).digest('base64')}'`;
  const pg = page(`<style>${css}</style>`);
  const csp = (s: string) => `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' ${s}\n`;
  assert.deepEqual(checkDist(dist({ 'rfc1.html': pg, _headers: csp(hash) })).errors, []);
  const bad = checkDist(dist({ 'rfc1.html': pg, _headers: csp('') }));
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /inline style 'sha256-.*' is not allowed/);
});

test('budgets: data/questions.json over 30 KB gz is an error; glossary letter pages get the 200 KB budget', () => {
  const noise = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => `${Math.random().toString(36)}${i}`));
  const small = checkDist(dist({ 'data/questions.json': noise(100) }));
  assert.deepEqual(small.errors, []);
  const big = checkDist(dist({ 'data/questions.json': noise(8000) }));
  assert.ok(
    big.errors.some((e) => /^data\/questions\.json: gzip .* exceeds 30 KB/.test(e)),
    JSON.stringify(big.errors),
  );
  // a 60 KB+ letter page is fine (glossary budget), but the same size on an unlisted page is not
  const body = Array.from({ length: 12000 }, (_, i) => `<p>${Math.random().toString(36)}${i}</p>`).join('');
  assert.ok(zlibGz(body) > 60 * 1024 && zlibGz(body) < 200 * 1024);
  assert.deepEqual(checkDist(dist({ 'glossary/m.html': `<!doctype html><body>${body}` })).errors, []);
  assert.equal(checkDist(dist({ 'other.html': `<!doctype html><body>${body}` })).errors.length, 1);
});

test('URL scheme: a trailing slash or an old-style /<n>/ link is an error, "/" is fine', () => {
  const d = dist({
    'rfc1.html': page(
      '<a href="/">home</a><a href="/rfc2">ok</a><a href="/areas/">trail</a><a href="/2/">old</a><a href="/2/#x">old2</a><a href="/2">old3</a>',
    ),
    'rfc2.html': page('x'),
    'areas.html': page('x'),
    'index.html': page('x'),
  });
  const msgs = checkDist(d).errors.join('\n');
  assert.match(msgs, /internal link with a trailing slash \/areas\//);
  assert.match(msgs, /internal link with a trailing slash \/2\/ \(x2\)/);
  assert.match(msgs, /old-style RFC link \/2\/ \(use \/rfc<n>\) \(x2\)/);
  assert.match(msgs, /old-style RFC link \/2 /);
  assert.ok(!/href="\/"|link \/ /.test(msgs));
});

test('resolves /rfc903 -> rfc903.html, /areas/core -> areas/core.html and / -> index.html', () => {
  const d = dist({
    'index.html': page(
      '<a href="/rfc903#top-x">a</a><a href="/areas/core">b</a><a href="/">c</a><a href="/rfc903#intro">d</a><a href="/areas">e</a>',
    ),
    'rfc903.html': page('<h2 id="intro">x</h2><h2 id="top-x">y</h2>'),
    'areas/core.html': page('x'),
    'areas.html': page('x'),
    'sitemap.xml':
      '<urlset><url><loc>https://rfc.akl.run/</loc></url><url><loc>https://rfc.akl.run/rfc903</loc></url><url><loc>https://rfc.akl.run/areas/core</loc></url></urlset>',
  });
  assert.deepEqual(checkDist(d).errors, []);
});
