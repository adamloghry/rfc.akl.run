/**
 * Builders for the non-page files in dist/: coverage.json, titles shards, graph.json,
 * questions.json, feed.xml, sitemap.xml, robots.txt. Astro endpoints call these.
 */
import { createHash } from 'node:crypto';
import { byDate, pubDate } from './graph';
import type { Site } from './model';
import { buildSearchIndex } from './search-index';

export const ORIGIN = 'https://rfc.akl.run';
export const STATE: Record<string, number> = { 'not-issued': 0, reserved: 1, index: 2, summary: 3, explainer: 4, interactive: 5 };
const TIER_NOUN: Record<string, string> = { summary: 'summary', explainer: 'full explainer', interactive: 'interactive explainer' };
const DAY = 86400000;

export function xmlEsc(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** HTML-escape for text/attribute context (also escapes '). */
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function coverageJson(site: Site): string {
  const catKeys = site.categories.map((c) => c.key);
  // The cell byte packs the category in 4 bits and reserves 15 for "none".
  if (catKeys.length > 15) throw new Error(`coverage.json packs the category in 4 bits (15 = none): ${catKeys.length} categories, max 15`);
  const cells = Buffer.alloc(site.max);
  for (let n = 1; n <= site.max; n++) {
    const r = site.rfcs.get(n);
    let state: number,
      cat = 15;
    if (r) {
      state = STATE[r.tier];
      const i = catKeys.indexOf(r.category);
      cat = i < 0 ? 15 : i;
    } else state = site.notIssued.has(n) ? STATE['not-issued'] : STATE.reserved;
    cells[n - 1] = (cat << 4) | state; // low 3 bits state, high 4 bits category (15 = none)
  }
  return JSON.stringify({
    max: site.max,
    buildDate: site.buildDate.toISOString().slice(0, 10),
    categories: catKeys,
    cells: cells.toString('base64'),
  });
}

/** Shard key k = floor((n-1)/1000) → JSON. */
export function titleShards(site: Site): Record<string, string> {
  const titles: Record<number, Record<number, [string | null, string, number, string]>> = {};
  for (const r of site.rfcs.values()) {
    const k = Math.floor((r.number - 1) / 1000);
    const shard = titles[k] ?? {};
    titles[k] = shard;
    shard[r.number] = [r.shortTitle || null, r.title, r.year, r.status];
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(titles)) out[k] = JSON.stringify(v);
  return out;
}

export function questionsJson(site: Site): string {
  const questions: { q: string; href: string; label: string; title: string }[] = [];
  for (const j of site.journeys) {
    for (const q of j.questions || []) questions.push({ q, href: `/journeys/${j.slug}/`, label: 'JOURNEY', title: j.title });
  }
  for (const r of site.rfcs.values()) {
    if (r.tier !== 'explainer' && r.tier !== 'interactive') continue;
    const t = r.shortTitle ? `${r.shortTitle}: ${r.title}` : r.title;
    for (const q of r.content?.questions || []) questions.push({ q, href: r.url, label: `RFC ${r.number}`, title: t });
  }
  return JSON.stringify(questions);
}

export function graphJson(site: Site): string {
  const graph: Record<number, unknown> = {};
  for (const r of site.rfcs.values()) {
    if (!(r.obsoletes.length || r.obsoletedBy.length || r.updates.length || r.updatedBy.length)) continue;
    graph[r.number] = { o: r.obsoletes, ob: r.obsoletedBy, u: r.updates, ub: r.updatedBy, t: r.shortTitle || r.title, y: r.year };
  }
  return JSON.stringify(graph);
}

/** data/search/* files, keyed by file name within data/search/ (e.g. "meta.json", "t-00.json"). */
export function searchFiles(site: Site): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of buildSearchIndex(site).files) out[f.path.replace(/^data\/search\//, '')] = f.json;
  return out;
}

/** All data files keyed by path relative to dist/ (the old dataFiles(site)). */
export function dataFiles(site: Site): Record<string, string> {
  const files: Record<string, string> = {};
  files['data/coverage.json'] = coverageJson(site);
  for (const [k, v] of Object.entries(titleShards(site))) files[`data/titles/${k}.json`] = v;
  files['data/questions.json'] = questionsJson(site);
  files['data/graph.json'] = graphJson(site);
  for (const [f, v] of Object.entries(searchFiles(site))) files[`data/search/${f}`] = v;
  return files;
}

export function feedXml(site: Site): string {
  const entries: { id: string; title: string; href: string; date: Date; summary: string }[] = [];
  const newest = [...site.rfcs.values()].sort((a, b) => byDate(b, a)).slice(0, 30);
  for (const r of newest) {
    entries.push({
      id: `${ORIGIN}${r.url}`,
      title: `RFC ${r.number}: ${r.title}`,
      href: `${ORIGIN}${r.url}`,
      date: pubDate(r),
      summary: r.abstract ? r.abstract.split('\n\n')[0] : r.title,
    });
  }
  for (const r of site.rfcs.values()) {
    const upd = r.content?.updated;
    if (!upd || r.tier === 'index') continue;
    const d = new Date(upd);
    if (Number.isNaN(d.getTime())) continue;
    const age = (site.buildDate.getTime() - d.getTime()) / DAY;
    if (age < 0 || age > 90) continue;
    entries.push({
      id: `${ORIGIN}${r.url}#${r.tier}-${upd}`,
      title: `RFC ${r.number} now has a ${TIER_NOUN[r.tier]}`,
      href: `${ORIGIN}${r.url}`,
      date: d,
      summary: r.title,
    });
  }
  entries.sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));
  const list = entries.slice(0, 60);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>rfc.akl.run: new RFCs and explainers</title>
<link href="${ORIGIN}/feed.xml" rel="self"/>
<link href="${ORIGIN}/"/>
<id>${ORIGIN}/</id>
<updated>${site.buildDate.toISOString()}</updated>
${list
  .map(
    (e) => `<entry>
<title>${esc(e.title)}</title>
<link href="${esc(e.href)}"/>
<id>${esc(e.id)}</id>
<updated>${e.date.toISOString()}</updated>
<summary>${esc(e.summary)}</summary>
</entry>`,
  )
  .join('\n')}
</feed>
`;
}

/** Sitemap URL paths: '/', every issued RFC, area pages, static pages and journeys; numeric-aware order. */
export function sitemapUrls(site: Site): string[] {
  const urls = new Set<string>(['/', '/areas/', '/contribute/', '/coverage/', '/glossary/', '/graph/', '/journeys/']);
  for (const n of site.rfcs.keys()) urls.add(`/${n}/`);
  for (const c of site.categories) urls.add(`/areas/${c.key}/`);
  for (const j of site.journeys) urls.add(`/journeys/${j.slug}/`);
  return [...urls].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b, 'en', { numeric: true })));
}

export function sitemapXml(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${xmlEsc(ORIGIN + u)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}

const REDIRECTS_HEAD = `# Generated by src/integrations/build-files.ts. Cloudflare Workers static assets: max 2,000 static + 100 dynamic rules.
# "/rfc:num" (placeholder inside a segment) is verified by e2e/cloudflare.spec.ts against wrangler's local runtime.
# Legacy "/#rfcNNN" links are forwarded client-side by the Atlas page.
# Static rules come first (Cloudflare evaluates them before dynamic ones anyway).
/404 /404/ 301
`;
const REDIRECTS_TAIL = '/rfc:num /:num/ 301\n';

/** dist/_redirects content. */
export function redirectsFile(site: Site): string {
  const lines: string[] = [];
  for (const r of site.rfcs.values()) {
    const slug = r.slug || r.content?.slug;
    if (slug) lines.push(`/${slug} /${r.number}/ 301`);
  }
  return REDIRECTS_HEAD + lines.join('\n') + (lines.length ? '\n' : '') + REDIRECTS_TAIL;
}

export interface HeadersOptions {
  /** 'sha256-...' source tokens for every executable inline script in the built HTML */
  scriptHashes?: string[];
  /** 'sha256-...' tokens for inline <style> blocks */
  styleHashes?: string[];
  /** Cloudflare Web Analytics token; when set the beacon origins are added to the CSP */
  beaconToken?: string;
}

export const BEACON_SCRIPT_ORIGIN = 'https://static.cloudflareinsights.com';
export const BEACON_CONNECT_ORIGIN = 'https://cloudflareinsights.com';

/** sha256 CSP source token ('sha256-<base64>') of inline code, exactly as the browser sees it. */
export function cspHash(code: string): string {
  return `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;
}

/**
 * The site-wide Content-Security-Policy. Pages are static, so one policy covers every page: inline
 * scripts/styles are allowed by hash only (computed from the built HTML by the integration).
 * Style attributes (style="--n:5") cannot be hashed without 'unsafe-hashes', so style-src-attr allows them;
 * that does not permit <style> elements or scripts.
 */
export function buildCsp(o: HeadersOptions = {}): string {
  const beacon = !!o.beaconToken;
  const uniq = (a: string[] = []) => [...new Set(a)].sort();
  const script = ["'self'", ...uniq(o.scriptHashes), ...(beacon ? [BEACON_SCRIPT_ORIGIN] : [])];
  const style = ["'self'", ...uniq(o.styleHashes)];
  const connect = ["'self'", ...(beacon ? [BEACON_CONNECT_ORIGIN] : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    `style-src ${style.join(' ')}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * dist/_headers content. Cloudflare joins same-named headers from every matching rule with ", ",
 * so the cache rules use "! Cache-Control" to detach the default set by /*.
 * Rule count is far below the 100-rule limit (checked by scripts/check-dist.ts).
 */
export function headersFile(o: HeadersOptions = {}): string {
  return `# Generated by src/integrations/build-files.ts
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000
  Content-Security-Policy: ${buildCsp(o)}
  Cache-Control: public, max-age=300

/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/data/search/*
  ! Cache-Control
  Cache-Control: public, max-age=60
`;
}

/** Headers with no inline-code hashes (tests, and the default before a build has run). */
export const HEADERS_FILE = headersFile();
