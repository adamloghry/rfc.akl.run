/**
 * Builders for the non-page files in dist/: coverage.json, titles shards, graph.json,
 * questions.json, sitemap.xml, robots.txt. Astro endpoints call these.
 */
import { createHash } from 'node:crypto';
import { glossaryModel } from './glossary';
import type { Site } from './model';
import { buildSearchIndex } from './search-index';

export const ORIGIN = 'https://rfc.akl.run';
/**
 * coverage.json cell state (low 3 bits of a cell byte): 0 not issued, 1 reserved, then the status class
 * that drives the Atlas ramp, faintest to strongest: 2 historic or obsoleted, 3 unknown,
 * 4 informational or experimental, 5 standard or BCP.
 */
export const STATE: Record<string, number> = { 'not-issued': 0, reserved: 1, historic: 2, unknown: 3, informational: 4, standard: 5 };

const STANDARD_TRACK = new Set(['internet-standard', 'draft-standard', 'proposed-standard', 'bcp']);

/** Status class of an issued RFC (a key of STATE). Obsoleted or Historic wins over the status it was published with. */
export function statusClass(r: { status: string; obsoletedBy: readonly number[] }): 'historic' | 'unknown' | 'informational' | 'standard' {
  if (r.obsoletedBy.length || r.status === 'historic') return 'historic';
  if (STANDARD_TRACK.has(r.status)) return 'standard';
  if (r.status === 'informational' || r.status === 'experimental') return 'informational';
  return 'unknown';
}

export function xmlEsc(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      state = STATE[statusClass(r)];
      const i = catKeys.indexOf(r.category);
      cat = i < 0 ? 15 : i;
    } else state = site.notIssued.has(n) ? STATE['not-issued'] : STATE.reserved;
    cells[n - 1] = (cat << 4) | state; // low 3 bits state (status class), high 4 bits category (15 = none)
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
  const titles: Record<number, Record<number, [string | null, string, number, string, string]>> = {};
  for (const r of site.rfcs.values()) {
    const k = Math.floor((r.number - 1) / 1000);
    const shard = titles[k] ?? {};
    titles[k] = shard;
    shard[r.number] = [r.shortTitle || null, r.title, r.year, r.status, r.tier];
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(titles)) out[k] = JSON.stringify(v);
  return out;
}

/**
 * Curated questions only (journeys). Per-RFC questions are not listed here: the sharded search index
 * already carries them (search-index.ts weights them as W.question), so listing them again would grow
 * this eagerly-loaded file with every explainer.
 */
export function questionsJson(site: Site): string {
  const questions: { q: string; href: string; label: string; title: string }[] = [];
  for (const j of site.journeys) {
    for (const q of j.questions || []) questions.push({ q, href: `/journeys/${j.slug}`, label: 'JOURNEY', title: j.title });
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

/** Sitemap URL paths: '/', every issued RFC, area pages, static pages and journeys; numeric-aware order. */
export function sitemapUrls(site: Site): string[] {
  const urls = new Set<string>(['/', '/areas', '/glossary', '/graph', '/journeys']);
  for (const g of glossaryModel(site).pages) urls.add(`/glossary/${g.slug}`);
  for (const n of site.rfcs.keys()) urls.add(`/rfc${n}`);
  for (const c of site.categories) urls.add(`/areas/${c.key}`);
  for (const j of site.journeys) urls.add(`/journeys/${j.slug}`);
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

const REDIRECTS_HEAD = `# Generated by src/integrations/build-files.ts. Cloudflare Pages: max 2,000 static + 100 dynamic rules.
# RFC pages live at /rfc<n> (dist/rfc<n>.html, served by Cloudflare Pages HTML handling); /rfc<n>/ redirects to /rfc<n> without a rule here.
# Legacy "/#rfcNNN" links are forwarded client-side by the Atlas page.
# Only explainer slug aliases (/<slug> -> /rfc<n>) need rules.
`;

/** dist/_redirects content. */
export function redirectsFile(site: Site): string {
  const lines: string[] = [];
  for (const r of site.rfcs.values()) {
    const slug = r.slug || r.content?.slug;
    if (slug) lines.push(`/${slug} /rfc${r.number} 301`);
  }
  return REDIRECTS_HEAD + lines.join('\n') + (lines.length ? '\n' : '');
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
