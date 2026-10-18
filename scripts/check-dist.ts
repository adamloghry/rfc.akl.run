/**
 * Link / anchor / budget checker for dist/.  CLI: node --import tsx scripts/check-dist.ts [dir]
 * checkDist(dir) -> { errors: string[], warnings: string[], stats }
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const KB = 1024;
const BUDGET = {
  index: 8 * KB,
  summary: 8 * KB,
  'not-issued': 8 * KB,
  explainer: 60 * KB,
  interactive: 60 * KB,
  default: 60 * KB,
  areas: 200 * KB,
  glossary: 200 * KB,
};
const JS_BUDGET = 25 * KB;
const COVERAGE_BUDGET = 25 * KB;
const QUESTIONS_BUDGET = 30 * KB;
const FILE_LIMIT = 20000; // Cloudflare Workers static assets, Free plan, files per version
const FILE_WARN = 18000;
const MAX_STATIC_REDIRECTS = 2000;
const MAX_DYNAMIC_REDIRECTS = 100;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // Cloudflare Workers static assets: 25 MiB per file
const MAX_HEADER_RULES = 100; // _headers: 100 rules
const MAX_HEADER_LINE = 2000; // _headers: 2,000 characters per line
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PLACEHOLDER_RE = /:[A-Za-z_][A-Za-z0-9_]*/g;

const ATTR_RE = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const ID_RE = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const NAME_RE = /<a\b[^>]*\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const TIER_RE = /<meta\s+name="rfc-tier"\s+content="([^"]*)"/i;

function countFiles(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  return n;
}

function walk(dir: string, rel: string, out: string[]): string[] {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (r !== 'search') walk(dir, r, out);
    } else out.push(r);
  }
  return out;
}

/**
 * Strings that must never appear anywhere in built HTML (site policy: no contribution or feed surfaces, and the
 * project's own repository is never named, not even inside RFC content).
 */
export const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: 'repo slug', re: /adamloghry\/rfc\.akl\.run/i },
  // RFC titles such as "How to Contribute Research Results" are legitimate, so only the site's own link is matched
  { label: 'Contribute', re: /Contribute an explainer|>\s*Contribute\s*<|href="[^"]*\/contribute\// },
  { label: 'Request an explainer', re: /Request an explainer/ },
  { label: 'feed.xml', re: /feed\.xml/ },
];

/**
 * RFC content may mention GitHub (explainer prose, implementation links, official titles), but the site's own
 * harness may not: header, nav, footer, scripts and head links. So "github" is forbidden only outside <main>.
 * The page's own <title> and description/Open Graph/Twitter text restate the RFC's official title and abstract
 * (e.g. RFC 8874), and the reader footer repeats "RFC n — title", so those count as RFC content too.
 */
const MAIN_RE = /<main\b[\s\S]*?<\/main>/gi;
const HEAD_TEXT_RE =
  /<title\b[\s\S]*?<\/title>|<meta\s+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"\s+content="[^"]*"\s*\/?>/gi;
const FOOTER_TITLE_RE = /<span><span class="rd-foot-n">[^<]*<\/span>[^<]*<\/span>/gi;

/** Labels of the forbidden strings found in a page's HTML. */
export function forbiddenStrings(html: string): string[] {
  const found = FORBIDDEN.filter((f) => f.re.test(html)).map((f) => f.label);
  const chrome = html.replace(MAIN_RE, '').replace(HEAD_TEXT_RE, '').replace(FOOTER_TITLE_RE, '');
  if (/github/i.test(chrome)) found.unshift('github');
  return found;
}

/** Strip // and /* *\/ comments and trailing commas from JSONC, leaving string contents alone. */
export function parseJsonc(text: string): any {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? text.length : e + 1;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/** Problems with the syntax of a _redirects file (Cloudflare Workers static assets rules). */
export function redirectsSyntaxErrors(content: string): string[] {
  const errs: string[] = [];
  content.split('\n').forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('#')) return;
    const at = `_redirects:${i + 1}`;
    const t = l.split(/\s+/);
    if (t.length < 2 || t.length > 3) {
      errs.push(`${at}: expected "source target [status]", got "${l}"`);
      return;
    }
    const [src, dst, st] = t;
    if (!src.startsWith('/')) errs.push(`${at}: source "${src}" must start with "/"`);
    if (!dst.startsWith('/') && !/^https?:\/\//.test(dst)) errs.push(`${at}: target "${dst}" must be a path or an http(s) URL`);
    if (st !== undefined && !REDIRECT_STATUSES.has(Number(st)))
      errs.push(`${at}: status "${st}" is not one of ${[...REDIRECT_STATUSES].join(', ')}`);
    if ((src.match(/\*/g) || []).length > 1) errs.push(`${at}: source "${src}" has more than one splat`);
    const defined = new Set(src.match(PLACEHOLDER_RE) || []);
    if (src.includes('*')) defined.add(':splat');
    for (const ph of dst.match(PLACEHOLDER_RE) || []) {
      if (/^https?:\/\//.test(dst) && !defined.has(ph) && dst.indexOf(ph) < dst.indexOf('/', 8)) continue; // ":443" style port
      if (!defined.has(ph)) errs.push(`${at}: target uses ${ph}, which the source "${src}" does not define`);
    }
  });
  return errs;
}

/** Rule count and line-length problems of a _headers file. A rule is an unindented, non-comment line. */
export function headersRuleStats(content: string): { rules: number; longLines: number } {
  let rules = 0,
    longLines = 0;
  for (const line of content.split('\n')) {
    if (line.length > MAX_HEADER_LINE) longLines++;
    if (line.trim() && !line.startsWith('#') && !/^\s/.test(line)) rules++;
  }
  return { rules, longLines };
}

const INLINE_STYLE_RE = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi;
const INLINE_SCRIPT_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const cspHash = (code: string) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;

function walkAll(dir: string, rel: string, out: { path: string; size: number }[]) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walkAll(dir, r, out);
    else out.push({ path: r, size: fs.statSync(path.join(dir, r)).size });
  }
  return out;
}

export interface CheckOptions {
  /** path to wrangler.jsonc: its assets.directory must be the directory being checked */
  wranglerConfig?: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function checkDist(dir: string, opts: CheckOptions = {}) {
  const files = walk(dir, '', []);
  const fileSet = new Set(files);
  const htmlFiles = files.filter((f: string) => f.endsWith('.html'));
  const errors = [];
  const warnings = [];
  const totalFiles = countFiles(dir); // every file, including the unscanned search/ dir
  const stats: any = {
    pages: htmlFiles.length,
    files: totalFiles,
    links: 0,
    broken: 0,
    badAnchors: 0,
    overBudget: 0,
    byTier: {},
    maxGz: { path: '', bytes: 0 },
    maxJsGz: { path: '', bytes: 0 },
  };

  const idCache = new Map(); // target html path -> Set of ids (lazy)
  const idsFor = (rel: string) => {
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
  const isHashRoute = (rel: string) => {
    let v = routeCache.get(rel);
    if (v === undefined) {
      v = /<meta\s+name="rfc-hash-route"/i.test(fs.readFileSync(path.join(dir, rel), 'utf8'));
      routeCache.set(rel, v);
    }
    return v;
  };
  const gzCache = new Map();
  const gzSize = (rel: string) => {
    let v = gzCache.get(rel);
    if (v === undefined) {
      v = zlib.gzipSync(fs.readFileSync(path.join(dir, rel)), { level: 6 }).length;
      gzCache.set(rel, v);
    }
    return v;
  };

  // static imports inside a JS file: import"./x.js", import "./x.js", from"./x.js", import{a}from"./x.js"
  const importCache = new Map<string, string[]>();
  const importsOf = (rel: string) => {
    let v = importCache.get(rel);
    if (!v) {
      v = [];
      const src = fs.readFileSync(path.join(dir, rel), 'utf8');
      for (const m of src.matchAll(/(?:\bimport|\bfrom)\s*["']([^"']+\.js)["']/g)) {
        const spec = m[1];
        const target = spec.startsWith('/') ? spec.slice(1) : path.posix.join(path.posix.dirname(rel), spec);
        if (fileSet.has(target)) v.push(target);
      }
      importCache.set(rel, v);
    }
    return v;
  };
  // entry scripts plus every statically imported chunk, recursively, deduped per page
  const jsClosure = (entries: Iterable<string>) => {
    const seen = new Set<string>();
    const stack = [...entries];
    while (stack.length) {
      const f = stack.pop() as string;
      if (seen.has(f)) continue;
      seen.add(f);
      if (f.endsWith('.js')) stack.push(...importsOf(f));
    }
    return seen;
  };

  // resolve a site-absolute path (no query/hash) to a file, or null
  const resolve = (p: string) => {
    let rel = decodeURIComponent(p.replace(/^\//, ''));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (fileSet.has(rel)) return rel;
    if (!path.extname(rel) && fileSet.has(`${rel}/index.html`)) return `${rel}/index.html`;
    return null;
  };

  // If _headers carries a Content-Security-Policy, every inline script and <style> must be allowed by hash.
  let cspScript: string | null = null;
  let cspStyle: string | null = null;
  if (fileSet.has('_headers')) {
    const m = /^\s*Content-Security-Policy:\s*(.*)$/im.exec(fs.readFileSync(path.join(dir, '_headers'), 'utf8'));
    if (m) {
      const directive = (name: string) => new RegExp(`(?:^|;)\\s*${name}\\s+([^;]*)`).exec(m[1])?.[1];
      const fallback = directive('default-src') ?? '';
      cspScript = directive('script-src') ?? fallback;
      cspStyle = directive('style-src') ?? fallback;
    }
  }
  const cspSeen = new Set<string>();
  const cspStyleSeen = new Set<string>();

  for (const rel of htmlFiles) {
    const html = fs.readFileSync(path.join(dir, rel), 'utf8');
    if (cspScript !== null) {
      for (const m of html.matchAll(INLINE_SCRIPT_RE)) {
        const attrs = m[1] || '';
        if (/\bsrc\s*=/i.test(attrs) || /\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap)/i.test(attrs) || !m[2].trim()) continue;
        const h = cspHash(m[2]);
        if (!cspSeen.has(h)) {
          cspSeen.add(h);
          if (!cspScript.includes(h) && !cspScript.includes("'unsafe-inline'"))
            errors.push(`${rel}: inline script ${h} is not allowed by the _headers Content-Security-Policy (script-src)`);
        }
      }
    }
    if (cspStyle !== null) {
      for (const m of html.matchAll(INLINE_STYLE_RE)) {
        if (!m[2].trim()) continue;
        const h = cspHash(m[2]);
        if (!cspStyleSeen.has(h)) {
          cspStyleSeen.add(h);
          if (!cspStyle.includes(h) && !cspStyle.includes("'unsafe-inline'"))
            errors.push(`${rel}: inline style ${h} is not allowed by the _headers Content-Security-Policy (style-src)`);
        }
      }
    }
    for (const label of forbiddenStrings(html)) errors.push(`${rel}: contains forbidden string "${label}"`);
    const pageUrl = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
    const broken = new Map(); // message -> count
    const bump = (m: string) => broken.set(m, (broken.get(m) || 0) + 1);
    const jsRefs = new Set<string>();
    let selfIds: Set<string> | null = null;

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
      let file: string | null | undefined = rel;
      if (target !== '') {
        file = resolve(target);
        if (!file) {
          stats.broken++;
          bump(`broken link ${target}`);
          continue;
        }
      }
      if (/\/assets\/[^"]*\.js$/.test(target)) jsRefs.add(file);
      if (frag && frag !== 'top' && file.endsWith('.html') && !isHashRoute(file)) {
        let ids: Set<string>;
        if (file === rel) {
          ids = selfIds ?? idsFor(rel);
          selfIds = ids;
        } else ids = idsFor(file);
        let f = frag;
        try {
          f = decodeURIComponent(frag);
        } catch {
          /* keep raw */
        }
        if (!ids.has(f)) {
          stats.badAnchors++;
          bump(`missing anchor ${target || pageUrl}#${frag}`);
        }
      }
    }
    for (const [msg, n] of broken) errors.push(`${rel}: ${msg}${n > 1 ? ` (x${n})` : ''}`);

    const tm = TIER_RE.exec(html);
    const tier = tm ? tm[1] : null;
    let budget = tier && tier in BUDGET ? BUDGET[tier as keyof typeof BUDGET] : BUDGET.default;
    if (!tier && rel.startsWith('areas/')) budget = BUDGET.areas;
    if (!tier && /^glossary\/[^/]+\/index\.html$/.test(rel)) budget = BUDGET.glossary;
    const gz = zlib.gzipSync(html, { level: 6 }).length;
    const key = tier || (rel.startsWith('areas/') ? 'areas' : 'other');
    stats.byTier[key] = (stats.byTier[key] || 0) + 1;
    if (gz > stats.maxGz.bytes) stats.maxGz = { path: rel, bytes: gz };
    if (gz > budget) {
      stats.overBudget++;
      errors.push(`${rel}: gzip ${(gz / KB).toFixed(1)} KB exceeds ${tier || key} budget ${budget / KB} KB`);
    }
    if (jsRefs.size) {
      let js = 0;
      for (const f of jsClosure(jsRefs)) js += gzSize(f);
      if (js > stats.maxJsGz.bytes) stats.maxJsGz = { path: rel, bytes: js };
      if (js > JS_BUDGET) {
        stats.overBudget++;
        errors.push(`${rel}: JS ${(js / KB).toFixed(1)} KB gz exceeds ${JS_BUDGET / KB} KB`);
      }
    }
  }

  if (totalFiles >= FILE_LIMIT)
    errors.push(`dist/ has ${totalFiles} files, at or over the Cloudflare Free limit of ${FILE_LIMIT} files per version`);
  else if (totalFiles >= FILE_WARN) warnings.push(`dist/ has ${totalFiles} files, approaching the Cloudflare Free limit of ${FILE_LIMIT}`);

  for (const req of ['404.html', '404/index.html', '_redirects', '_headers']) {
    if (!fileSet.has(req)) errors.push(`${req} is missing from dist/`);
  }
  if (fs.existsSync(path.join(dir, 'not-found'))) errors.push('not-found/ must not exist in dist/ (the error page belongs at 404.html)');

  // Cloudflare Workers static assets: 25 MiB per file
  for (const f of walkAll(dir, '', [])) {
    if (f.size > MAX_FILE_BYTES)
      errors.push(`${f.path}: ${(f.size / 1048576).toFixed(1)} MiB exceeds the Cloudflare limit of 25 MiB per file`);
  }

  if (fileSet.has('_headers')) {
    const hs = headersRuleStats(fs.readFileSync(path.join(dir, '_headers'), 'utf8'));
    stats.headerRules = hs.rules;
    if (hs.rules > MAX_HEADER_RULES) errors.push(`_headers: ${hs.rules} rules exceeds the limit of ${MAX_HEADER_RULES}`);
    if (hs.longLines) errors.push(`_headers: ${hs.longLines} line(s) longer than ${MAX_HEADER_LINE} characters`);
  }

  if (opts.wranglerConfig) {
    try {
      const cfg = parseJsonc(fs.readFileSync(opts.wranglerConfig, 'utf8'));
      const assetsDir = cfg?.assets?.directory;
      if (typeof assetsDir !== 'string') errors.push(`${path.basename(opts.wranglerConfig)}: assets.directory is not set`);
      else if (path.resolve(path.dirname(opts.wranglerConfig), assetsDir) !== path.resolve(dir)) {
        errors.push(
          `${path.basename(opts.wranglerConfig)}: assets.directory "${assetsDir}" resolves to ${path.resolve(path.dirname(opts.wranglerConfig), assetsDir)}, not the checked directory ${path.resolve(dir)}`,
        );
      }
    } catch (e) {
      errors.push(`${opts.wranglerConfig}: cannot read or parse (${(e as Error).message})`);
    }
  }

  if (fileSet.has('_redirects')) {
    for (const e of redirectsSyntaxErrors(fs.readFileSync(path.join(dir, '_redirects'), 'utf8'))) errors.push(e);
    let st = 0,
      dyn = 0;
    for (const line of fs.readFileSync(path.join(dir, '_redirects'), 'utf8').split('\n')) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      if (/[:*]/.test(l.split(/\s+/)[0])) dyn++;
      else st++;
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
      const u =
        decodeEntities(m[1])
          .trim()
          .replace(/^https?:\/\/[^/]+/, '') || '/';
      if (!resolve(u)) errors.push(`sitemap.xml: ${u} does not resolve to a file in dist/`);
    }
    stats.sitemapUrls = urls;
  }

  if (fileSet.has('data/coverage.json')) {
    const g = gzSize('data/coverage.json');
    stats.coverageGz = g;
    if (g > COVERAGE_BUDGET) errors.push(`data/coverage.json: gzip ${(g / KB).toFixed(1)} KB exceeds ${COVERAGE_BUDGET / KB} KB`);
  }
  if (fileSet.has('data/questions.json')) {
    const g = gzSize('data/questions.json');
    stats.questionsGz = g;
    if (g > QUESTIONS_BUDGET) errors.push(`data/questions.json: gzip ${(g / KB).toFixed(1)} KB exceeds ${QUESTIONS_BUDGET / KB} KB`);
  }
  return { errors, warnings, stats };
}

export function main() {
  const dir = path.resolve(process.argv[2] || path.join(process.cwd(), 'dist'));
  if (!fs.existsSync(dir)) {
    console.error(`no such directory: ${dir}`);
    process.exit(2);
  }
  const t0 = Date.now();
  const wrangler = path.join(process.cwd(), 'wrangler.jsonc');
  const { errors, warnings, stats } = checkDist(dir, { wranglerConfig: fs.existsSync(wrangler) ? wrangler : null });
  console.log(
    `check-dist: ${stats.pages} pages, ${stats.files} files, ${stats.links} internal links in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  console.log(`  broken links ${stats.broken}, missing anchors ${stats.badAnchors}, budget violations ${stats.overBudget}`);
  console.log(
    '  pages by tier: ' +
      Object.entries(stats.byTier)
        .map(([k, v]) => `${k}=${v}`)
        .join(' '),
  );
  console.log(
    `  largest page gz: ${stats.maxGz.path} ${(stats.maxGz.bytes / KB).toFixed(1)} KB` +
      `; max JS per page gz (with chunks): ${stats.maxJsGz.path || '-'} ${(stats.maxJsGz.bytes / KB).toFixed(1)} KB` +
      (stats.coverageGz ? `; coverage.json gz ${(stats.coverageGz / KB).toFixed(1)} KB` : ''),
  );
  for (const w of warnings) console.log(`WARN ${w}`);
  for (const e of errors.slice(0, 200)) console.log(`ERROR ${e}`);
  if (errors.length > 200) console.log(`... and ${errors.length - 200} more errors`);
  console.log(errors.length ? `${errors.length} error(s)` : 'OK');
  process.exit(errors.length ? 1 : 0);
}

if (/(^|[\\/])check-dist\.ts$/.test(process.argv[1] || '')) main();
