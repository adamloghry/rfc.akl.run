import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { headersRuleStats } from '../scripts/check-dist';
import { collectInlineHashes, headersContent } from '../src/integrations/build-files';
import { BEACON_CONNECT_ORIGIN, BEACON_SCRIPT_ORIGIN, buildCsp, cspHash, headersFile } from '../src/lib/data-files';

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `) || d === name);

test('CSP: strict defaults, no unsafe-inline for scripts or <style>, no beacon origins', () => {
  const csp = buildCsp({
    scriptHashes: ["'sha256-b='", "'sha256-a='", "'sha256-a='"],
    styleHashes: ["'sha256-s='"],
  });
  assert.equal(directive(csp, 'default-src'), "default-src 'self'");
  assert.equal(directive(csp, 'script-src'), "script-src 'self' 'sha256-a=' 'sha256-b='"); // sorted, de-duplicated
  assert.equal(directive(csp, 'style-src'), "style-src 'self' 'sha256-s='");
  assert.equal(directive(csp, 'style-src-attr'), "style-src-attr 'unsafe-inline'");
  assert.equal(directive(csp, 'img-src'), "img-src 'self' data:");
  assert.equal(directive(csp, 'connect-src'), "connect-src 'self'");
  for (const d of ["base-uri 'self'", "form-action 'self'", "object-src 'none'", "frame-ancestors 'none'", "font-src 'self'"])
    assert.equal(directive(csp, d.split(' ')[0]), d);
  assert.doesNotMatch(csp, /cloudflareinsights/);
  assert.doesNotMatch(directive(csp, 'script-src')!, /unsafe/);
});

test('CSP with a Web Analytics token adds the beacon origins, and only those', () => {
  const csp = buildCsp({ scriptHashes: ["'sha256-a='"], beaconToken: 'tok' });
  assert.equal(directive(csp, 'script-src'), `script-src 'self' 'sha256-a=' ${BEACON_SCRIPT_ORIGIN}`);
  assert.equal(directive(csp, 'connect-src'), `connect-src 'self' ${BEACON_CONNECT_ORIGIN}`);
  assert.equal(BEACON_SCRIPT_ORIGIN, 'https://static.cloudflareinsights.com');
  assert.equal(BEACON_CONNECT_ORIGIN, 'https://cloudflareinsights.com');
  assert.equal(directive(csp, 'img-src'), "img-src 'self' data:");
  assert.equal(buildCsp({ beaconToken: '' }), buildCsp({}));
});

test('_headers: security headers on /*, cache rules detach the default, within the 100-rule limit', () => {
  const h = headersFile({ scriptHashes: ["'sha256-a='"] });
  const star = h.slice(h.indexOf('\n/*\n'), h.indexOf('\n/assets/*'));
  for (const line of [
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'X-Frame-Options: DENY',
    'Strict-Transport-Security: max-age=31536000',
    'Cache-Control: public, max-age=300',
  ])
    assert.ok(star.includes(`\n  ${line}\n`), line);
  assert.match(star, /\n {2}Permissions-Policy: .*camera=\(\).*geolocation=\(\).*microphone=\(\)/);
  assert.match(star, /\n {2}Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-a='/);
  assert.match(h, /\/assets\/\*\n {2}! Cache-Control\n {2}Cache-Control: public, max-age=31536000, immutable/);
  assert.match(h, /\/data\/search\/\*\n {2}! Cache-Control\n {2}Cache-Control: public, max-age=60/);
  assert.deepEqual(headersRuleStats(h), { rules: 3, longLines: 0 });
  assert.equal(headersContent({ scriptHashes: ["'sha256-a='"] }), h);
});

test('collectInlineHashes hashes executable inline scripts and styles only, from the built HTML', () => {
  const d = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-csp-'));
  fs.mkdirSync(path.join(d, 'a'));
  const code = "(function(){var x='é';})();";
  const html = `<!doctype html><script>${code}</script><script type="application/json">{"a":1}</script><script type="module" src="/assets/x.js"></script><script> </script><noscript><style>#c{display:block}</style></noscript>`;
  fs.writeFileSync(path.join(d, 'index.html'), html);
  fs.writeFileSync(path.join(d, 'a', 'index.html'), html); // identical page: deduplicated
  fs.writeFileSync(path.join(d, 'a', 'note.txt'), '<script>ignored()</script>');
  const r = collectInlineHashes(d);
  assert.deepEqual(r.scriptHashes, [cspHash(code)]);
  assert.deepEqual(r.styleHashes, [cspHash('#c{display:block}')]);
  assert.match(cspHash('x'), /^'sha256-[A-Za-z0-9+/]{43}='$/);
});
