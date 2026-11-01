// URL scheme of the built site: RFC pages at /rfc<n> (dist/rfc<n>.html) and no trailing slash anywhere.
// Runs against dist/ when it exists (npm run build; CI builds before the tests).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { buildSite } from '../src/lib/model';
import { loadIndex } from '../src/lib/rfc-index';

const dist = path.join(process.cwd(), 'dist');
const built = fs.existsSync(path.join(dist, 'rfc903.html'));

function walk(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, r));
    else out.push(r);
  }
  return out;
}

test.skipIf(!built)('every RFC page (issued, not issued, reserved) exists at dist/rfc<n>.html', () => {
  const site = buildSite({ index: loadIndex(), contentDir: path.join(process.cwd(), 'content'), buildDate: new Date('2026-01-01') });
  const missing: number[] = [];
  for (let n = 1; n <= site.max; n++) if (!fs.existsSync(path.join(dist, `rfc${n}.html`))) missing.push(n);
  assert.deepEqual(missing.slice(0, 10), []);
  assert.ok(site.max > 9000);
  assert.ok(!fs.existsSync(path.join(dist, '903')), 'no <n>/index.html directories');
  assert.ok(!fs.existsSync(path.join(dist, 'rfc0903.html')), 'never zero-padded');
});

test.skipIf(!built)('no internal href ends with "/" except "/", and none is an old-style /<n>/ link', () => {
  const bad: string[] = [];
  const re = /\bhref\s*=\s*"(\/[^"]*)"/g;
  for (const f of walk(dist).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dist, f), 'utf8');
    for (const m of html.matchAll(re)) {
      const target = m[1].split(/[?#]/)[0];
      if (target === '/') continue;
      if (target.endsWith('/') || /^\/\d+$/.test(target)) bad.push(`${f}: ${m[1]}`);
      if (bad.length > 10) break;
    }
    if (bad.length > 10) break;
  }
  assert.deepEqual(bad, []);
});

test.skipIf(!built)('canonical URLs, sitemap and data files use the slash-less scheme', () => {
  const html = fs.readFileSync(path.join(dist, 'rfc903.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/rfc\.akl\.run\/rfc903">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/rfc\.akl\.run\/rfc903">/);
  const xml = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(
    locs.includes('https://rfc.akl.run/rfc903') && locs.includes('https://rfc.akl.run/areas/core') && locs.includes('https://rfc.akl.run/'),
  );
  assert.deepEqual(
    locs.filter((u) => u !== 'https://rfc.akl.run/' && u.endsWith('/')),
    [],
  );
  for (const f of ['data/questions.json', 'data/search/docs.json']) {
    const text = fs.readFileSync(path.join(dist, f), 'utf8');
    assert.ok(!/"\/(?:[\w-]+\/)*[\w-]*\/"/.test(text), `${f} holds a URL with a trailing slash`);
    assert.ok(!/"\/\d+\/?"/.test(text), `${f} holds an old-style /<n>/ URL`);
  }
});
