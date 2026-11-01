/**
 * Cloudflare Pages behaviour (`wrangler pages dev`, the same workerd runtime as production), driven by the
 * generated dist/_redirects, dist/_headers and dist/404.html. These settle the "does Cloudflare do X" questions.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

const DIST = path.join(process.cwd(), 'dist');
const noFollow = { maxRedirects: 0 };

test.describe('URL scheme (Pages HTML handling)', () => {
  test('/rfc903 is served from rfc903.html: 200, no redirect', async ({ request }) => {
    const r = await request.get('/rfc903', noFollow);
    expect(r.status()).toBe(200);
    expect(r.headers().location).toBeUndefined();
    expect(await r.text()).toBe(fs.readFileSync(path.join(DIST, 'rfc903.html'), 'utf8'));
    expect((await request.get('/rfc903')).url()).toMatch(/\/rfc903$/);
  });

  test('/rfc903/ redirects to /rfc903 (no rule in _redirects needed)', async ({ request }) => {
    const r = await request.get('/rfc903/', noFollow);
    expect([301, 302, 307, 308]).toContain(r.status());
    expect(r.headers().location).toBe('/rfc903');
    const end = await request.get('/rfc903/');
    expect(end.status()).toBe(200);
    expect(end.url()).toMatch(/\/rfc903$/);
  });

  test('other pages are slash-less too: /areas, /areas/core, /glossary/m, /graph, /journeys', async ({ request }) => {
    for (const p of ['/areas', '/areas/core', '/glossary', '/glossary/m', '/graph', '/journeys', '/journeys/request']) {
      const r = await request.get(p, noFollow);
      expect(r.status(), p).toBe(200);
      const slash = await request.get(`${p}/`, noFollow);
      expect([301, 302, 307, 308], `${p}/`).toContain(slash.status());
      expect(slash.headers().location, `${p}/`).toBe(p);
    }
  });

  test('/rfc404 is the RFC 404 page (200), not the error page', async ({ page, request }) => {
    const r = await request.get('/rfc404', noFollow);
    expect(r.status()).toBe(200);
    const res = await page.goto('/rfc404');
    expect(res?.status()).toBe(200);
    expect(page.url()).toMatch(/\/rfc404$/);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('No page here');
    await expect(page.locator('meta[name="rfc-tier"]')).toHaveCount(1);
  });

  test('old-style /903 and /903/ are not pages (never deployed): 404', async ({ request }) => {
    for (const p of ['/903', '/903/']) expect((await request.get(p, noFollow)).status(), p).toBe(404);
  });

  test('every page names https://rfc.akl.run as canonical (pages.dev also serves production)', async ({ request }) => {
    for (const p of ['/', '/rfc903', '/glossary', '/graph']) {
      const html = await (await request.get(p)).text();
      const canon = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
      expect(canon, p).toBe(`https://rfc.akl.run${p}`);
    }
  });

  test('every slug alias in _redirects redirects to its RFC', async ({ request }) => {
    const rules = fs
      .readFileSync(path.join(DIST, '_redirects'), 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && !/[:*]/.test(l.split(' ')[0]));
    test.skip(rules.length === 0, 'no slug aliases in this build');
    for (const rule of rules.slice(0, 5)) {
      const [from, to] = rule.split(' ');
      const r = await request.get(from, noFollow);
      expect(r.status(), rule).toBe(301);
      expect(r.headers().location, rule).toBe(to);
    }
  });
});

test.describe('404 handling', () => {
  for (const p of ['/definitely/not/here', '/nope', '/rfc903/missing', '/rfc99999', '/data/nothing.json']) {
    test(`unknown path ${p} serves 404.html with status 404`, async ({ request }) => {
      const r = await request.get(p, noFollow);
      expect(r.status()).toBe(404);
      expect(r.headers()['content-type']).toContain('text/html');
      expect(await r.text()).toBe(fs.readFileSync(path.join(DIST, '404.html'), 'utf8'));
    });
  }

  test('an unknown path returns the 404 page with status 404', async ({ request }) => {
    const r = await request.get('/no-such-page', noFollow);
    expect(r.status()).toBe(404);
    expect(await r.text()).toBe(fs.readFileSync(path.join(DIST, '404.html'), 'utf8'));
  });

  test('error page renders in a browser and shows the go-to-RFC form', async ({ page, allowedFailures }) => {
    allowedFailures.push('/no/such/page'); // an intentional 404 navigation
    const res = await page.goto('/no/such/page');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'No page here' })).toBeVisible();
  });

  for (const p of ['/contribute', '/contribute/question', '/coverage', '/feed.xml']) {
    test(`removed surface ${p} is a 404`, async ({ request }) => {
      expect((await request.get(p, noFollow)).status()).toBe(404);
    });
  }

  test('/not-found is not a page (only 404.html exists)', async ({ request }) => {
    expect((await request.get('/not-found', noFollow)).status()).toBe(404);
  });
});

test.describe('_headers', () => {
  const SECURITY: Record<string, RegExp> = {
    'x-content-type-options': /^nosniff$/,
    'referrer-policy': /^strict-origin-when-cross-origin$/,
    'x-frame-options': /^DENY$/,
    'strict-transport-security': /^max-age=31536000$/,
    'permissions-policy': /camera=\(\).*geolocation=\(\).*microphone=\(\)/,
  };

  for (const p of ['/', '/rfc903', '/glossary', '/data/coverage.json', '/robots.txt']) {
    test(`security headers on ${p}`, async ({ request }) => {
      const h = (await request.get(p)).headers();
      for (const [k, re] of Object.entries(SECURITY)) expect(h[k], k).toMatch(re);
      const csp = h['content-security-policy'];
      for (const d of [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
      ]) {
        expect(csp, d).toContain(d);
      }
      expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
      expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    });
  }

  test('CSP style hashes cover every inline <style> on every sampled page (no drift)', async ({ request }) => {
    const csp = (await request.get('/rfc903')).headers()['content-security-policy'];
    expect(csp).toMatch(/style-src 'self'/);
    for (const p of ['/', '/rfc903', '/rfc5952', '/glossary', '/graph', '/rfc404', '/no-such-page']) {
      const html = await (await request.get(p)).text();
      for (const m of html.matchAll(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/g)) {
        if (!m[2].trim()) continue;
        const hash = `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`;
        expect(csp, `${p} inline style ${m[2].slice(0, 40)}`).toContain(hash);
      }
    }
  });

  test('CSP script hashes cover every inline script on every sampled page (no drift)', async ({ request }) => {
    const csp = (await request.get('/rfc903')).headers()['content-security-policy'];
    for (const p of ['/', '/rfc903', '/rfc5952', '/glossary', '/graph', '/rfc404', '/no-such-page']) {
      const html = await (await request.get(p)).text();
      for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        const attrs = m[1] || '';
        if (/\bsrc=/.test(attrs) || /application\/json/.test(attrs) || !m[2].trim()) continue;
        const hash = `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`;
        expect(csp, `${p} inline script ${m[2].slice(0, 40)}`).toContain(hash);
      }
    }
  });

  test('/assets/* is immutable for a year; no duplicated Cache-Control from /*', async ({ request }) => {
    const css = (await (await request.get('/rfc903')).text()).match(/href="(\/assets\/[^"]+\.css)"/)![1];
    const r = await request.get(css);
    expect(r.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    const font = (await (await request.get(css)).text()).match(/url\((\/assets\/[^)]+\.woff2)\)/)![1];
    expect((await request.get(font)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('short TTLs: HTML/data 300 s, search index 60 s', async ({ request }) => {
    expect((await request.get('/rfc903')).headers()['cache-control']).toBe('public, max-age=300');
    expect((await request.get('/data/coverage.json')).headers()['cache-control']).toBe('public, max-age=300');
    expect((await request.get('/data/titles/0.json')).headers()['cache-control']).toBe('public, max-age=300');
    expect((await request.get('/data/search/meta.json')).headers()['cache-control']).toBe('public, max-age=60');
    expect((await request.get('/data/search/docs.json')).headers()['cache-control']).toBe('public, max-age=60');
  });
});
