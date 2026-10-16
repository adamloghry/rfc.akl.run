#!/usr/bin/env tsx
// @ts-nocheck -- ported from CommonJS; loosely typed on purpose
/**
 * Link / anchor / budget checker for dist/.  CLI: node scripts/check-dist.js [dir]
 * checkDist(dir) -> { errors: string[], warnings: string[], stats }
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const KB = 1024;
const BUDGET = { index: 8 * KB, summary: 8 * KB, 'not-issued': 8 * KB, explainer: 60 * KB, interactive: 60 * KB, default: 60 * KB, areas: 200 * KB, glossary: 200 * KB };
const JS_BUDGET = 25 * KB;
const COVERAGE_BUDGET = 25 * KB;
const FILE_LIMIT = 20000; // Cloudflare Workers static assets, Free plan, files per version
const FILE_WARN = 18000;
const MAX_STATIC_REDIRECTS = 2000;
const MAX_DYNAMIC_REDIRECTS = 100;

const ATTR_RE = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const ID_RE = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const NAME_RE = /<a\b[^>]*\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const TIER_RE = /<meta\s+name="rfc-tier"\s+content="([^"]*)"/i;

function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  return n;
}

function walk(dir, rel, out) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (r !== 'search') walk(dir, r, out); }
    else out.push(r);
  }
  return out;
}

function decodeEntities(s) { return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }

export function checkDist(dir: string) {
  const files = walk(dir, '', []);
  const fileSet = new Set(files);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const errors = [];
  const warnings = [];
  const totalFiles = countFiles(dir); // every file, including the unscanned search/ dir
  const stats: any = { pages: htmlFiles.length, files: totalFiles, links: 0, broken: 0, badAnchors: 0, overBudget: 0, byTier: {}, maxGz: { path: '', bytes: 0 } };

  const idCache = new Map(); // target html path -> Set of ids (lazy)
  const idsFor = (rel) => {
    let s = idCache.get(rel);
    if (!s) {
      s = new Set();
      const h = fs.readFileSync(path.join(dir, rel), 'utf8');
      for (const m of h.matchAll(ID_RE)) s.add(decodeEntities(m[1] ?? m[2]));
      for (const m of h.matchAll(NAME_RE)) s.add(decodeEntities(m[1] ?? m[2]));
      idCache.set(rel, s);
    }
    return s;
  };
  const routeCache = new Map();
  // pages declaring <meta name="rfc-hash-route"> are JS routers: their fragments are not anchors
  const isHashRoute = (rel) => {
    let v = routeCache.get(rel);
    if (v === undefined) { v = /<meta\s+name="rfc-hash-route"/i.test(fs.readFileSync(path.join(dir, rel), 'utf8')); routeCache.set(rel, v); }
    return v;
  };
  const gzCache = new Map();
  const gzSize = (rel) => {
    let v = gzCache.get(rel);
    if (v === undefined) { v = zlib.gzipSync(fs.readFileSync(path.join(dir, rel)), { level: 6 }).length; gzCache.set(rel, v); }
    return v;
  };

  // resolve a site-absolute path (no query/hash) to a file, or null
  const resolve = (p) => {
    let rel = decodeURIComponent(p.replace(/^\//, ''));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (fileSet.has(rel)) return rel;
    if (!path.extname(rel) && fileSet.has(rel + '/index.html')) return rel + '/index.html';
    return null;
  };

  for (const rel of htmlFiles) {
    const html = fs.readFileSync(path.join(dir, rel), 'utf8');
    const pageUrl = rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
    const broken = new Map(); // message -> count
    const bump = (m) => broken.set(m, (broken.get(m) || 0) + 1);
    const jsRefs = new Set();
    let selfIds = null;

    for (const m of html.matchAll(ATTR_RE)) {
      const raw = decodeEntities(m[1] ?? m[2]).trim();
      if (!raw || raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
      if (!raw.startsWith('/') && !raw.startsWith('#')) continue; // relative links are not used by the site
      stats.links++;
      const hashAt = raw.indexOf('#');
      let target = hashAt < 0 ? raw : raw.slice(0, hashAt);
      const frag = hashAt < 0 ? '' : raw.slice(hashAt + 1);
      const q = target.indexOf('?');
      if (q >= 0) target = target.slice(0, q);
      let file;
      if (target === '') file = rel;
      else {
        file = resolve(target);
        if (!file) { stats.broken++; bump(`broken link ${target}`); continue; }
      }
      if (/\/assets\/[^"]*\.js$/.test(target)) jsRefs.add(file);
      if (frag && frag !== 'top' && file.endsWith('.html') && !isHashRoute(file)) {
        let ids;
        if (file === rel) ids = selfIds || (selfIds = idsFor(rel)); else ids = idsFor(file);
        let f = frag;
        try { f = decodeURIComponent(frag); } catch { /* keep raw */ }
        if (!ids.has(f)) { stats.badAnchors++; bump(`missing anchor ${target || pageUrl}#${frag}`); }
      }
    }
    for (const [msg, n] of broken) errors.push(`${rel}: ${msg}${n > 1 ? ` (x${n})` : ''}`);

    const tm = TIER_RE.exec(html);
    const tier = tm ? tm[1] : null;
    let budget = tier && BUDGET[tier] ? BUDGET[tier] : BUDGET.default;
    if (!tier && rel.startsWith('areas/')) budget = BUDGET.areas;
    if (!tier && rel === 'glossary/index.html') budget = BUDGET.glossary;
    const gz = zlib.gzipSync(html, { level: 6 }).length;
    const key = tier || (rel.startsWith('areas/') ? 'areas' : 'other');
    stats.byTier[key] = (stats.byTier[key] || 0) + 1;
    if (gz > stats.maxGz.bytes) stats.maxGz = { path: rel, bytes: gz };
    if (gz > budget) { stats.overBudget++; errors.push(`${rel}: gzip ${(gz / KB).toFixed(1)} KB exceeds ${tier || key} budget ${(budget / KB)} KB`); }
    if (jsRefs.size) {
      let js = 0;
      for (const f of jsRefs) js += gzSize(f);
      if (js > JS_BUDGET) { stats.overBudget++; errors.push(`${rel}: JS ${(js / KB).toFixed(1)} KB gz exceeds ${JS_BUDGET / KB} KB`); }
    }
  }

  if (totalFiles >= FILE_LIMIT) errors.push(`dist/ has ${totalFiles} files, at or over the Cloudflare Free limit of ${FILE_LIMIT} files per version`);
  else if (totalFiles >= FILE_WARN) warnings.push(`dist/ has ${totalFiles} files, approaching the Cloudflare Free limit of ${FILE_LIMIT}`);

  if (fileSet.has('_redirects')) {
    let st = 0, dyn = 0;
    for (const line of fs.readFileSync(path.join(dir, '_redirects'), 'utf8').split('\n')) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      if (/[:*]/.test(l.split(/\s+/)[0])) dyn++; else st++;
    }
    stats.redirects = { static: st, dynamic: dyn };
    if (st > MAX_STATIC_REDIRECTS) errors.push(`_redirects: ${st} static rules exceeds the limit of ${MAX_STATIC_REDIRECTS}`);
    if (dyn > MAX_DYNAMIC_REDIRECTS) errors.push(`_redirects: ${dyn} dynamic rules exceeds the limit of ${MAX_DYNAMIC_REDIRECTS}`);
  }

  // Every sitemap URL must resolve to a file in dist/.
  if (fileSet.has('sitemap.xml')) {
    const xml = fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8');
    let urls = 0;
    for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
      urls++;
      const u = decodeEntities(m[1]).trim().replace(/^https?:\/\/[^/]+/, '') || '/';
      if (!resolve(u)) errors.push(`sitemap.xml: ${u} does not resolve to a file in dist/`);
    }
    stats.sitemapUrls = urls;
  }

  if (fileSet.has('data/coverage.json')) {
    const g = gzSize('data/coverage.json');
    stats.coverageGz = g;
    if (g > COVERAGE_BUDGET) errors.push(`data/coverage.json: gzip ${(g / KB).toFixed(1)} KB exceeds ${COVERAGE_BUDGET / KB} KB`);
  }
  return { errors, warnings, stats };
}

export function main() {
  const dir = path.resolve(process.argv[2] || path.join(process.cwd(), 'dist'));
  if (!fs.existsSync(dir)) { console.error(`no such directory: ${dir}`); process.exit(2); }
  const t0 = Date.now();
  const { errors, warnings, stats } = checkDist(dir);
  console.log(`check-dist: ${stats.pages} pages, ${stats.files} files, ${stats.links} internal links in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  broken links ${stats.broken}, missing anchors ${stats.badAnchors}, budget violations ${stats.overBudget}`);
  console.log('  pages by tier: ' + Object.entries(stats.byTier).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log(`  largest page gz: ${stats.maxGz.path} ${(stats.maxGz.bytes / KB).toFixed(1)} KB` + (stats.coverageGz ? `; coverage.json gz ${(stats.coverageGz / KB).toFixed(1)} KB` : ''));
  for (const w of warnings) console.log('WARN ' + w);
  for (const e of errors.slice(0, 200)) console.log('ERROR ' + e);
  if (errors.length > 200) console.log(`... and ${errors.length - 200} more errors`);
  console.log(errors.length ? `${errors.length} error(s)` : 'OK');
  process.exit(errors.length ? 1 : 0);
}

if (/(^|[\\/])check-dist\.ts$/.test(process.argv[1] || '')) main();
