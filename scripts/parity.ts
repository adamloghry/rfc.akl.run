/**
 * Parity report: compares the golden output of the legacy generator (.work/golden/<path>) with the
 * Astro build (dist/<path>) after normalizing whitespace, hashed asset URLs, attribute order and
 * Astro-specific attributes/wrappers. Prints a compact unified diff of the page structure
 * (tags + classes + ids + key attributes + text) and a similarity score per page.
 *
 *   node --import tsx scripts/parity.ts [paths...] [--golden dir] [--dist dir] [--context n] [--limit n] [--full]
 *
 * Paths are site paths (/, /903/, /404.html). Always exits 0: this is a report tool.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PATHS = [
  '/',
  '/903/',
  '/826/',
  '/791/',
  '/5952/',
  '/10055/',
  '/14/',
  '/areas/core/',
  '/journeys/request/',
  '/glossary/',
  '/coverage/',
  '/contribute/',
  '/graph/',
  '/404.html',
];
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Wrapper elements Astro adds around hydrated components; they are dropped (children are kept). */
const TRANSPARENT = new Set(['astro-island', 'astro-slot', 'astro-static-slot']);
/** Attributes that make it into the structural line (class is handled separately, sorted). */
const KEEP_ATTRS = new Set([
  'id',
  'href',
  'src',
  'rel',
  'name',
  'content',
  'property',
  'type',
  'role',
  'title',
  'for',
  'action',
  'method',
  'value',
  'placeholder',
  'hidden',
  'crossorigin',
  'media',
  'lang',
  'colspan',
  'rowspan',
  'style',
  'tabindex',
]);

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
    if (g[0] === '#') {
      const cp = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENT[g.toLowerCase()] ?? m;
  });
}

/** `/assets/foo.1a2b3c4d.woff2`, `/assets/fonts/foo.3b646991.woff2` → `/assets/foo.woff2`; css/js bundles collapse to `/assets/*.css|js`. */
export function normUrl(u: string): string {
  const m = /^(\/assets\/)(?:fonts\/)?([^?#]*?)(?:\.[A-Za-z0-9_-]{6,12})?(\.[a-z0-9]+)([?#].*)?$/.exec(u);
  if (!m) return u;
  const ext = m[3];
  if (ext === '.css' || ext === '.js' || ext === '.mjs') return `/assets/*${ext === '.mjs' ? '.js' : ext}`;
  return m[1] + m[2] + ext + (m[4] ?? '');
}

interface Attr {
  name: string;
  value: string | null;
}

function parseAttrs(s: string): Attr[] {
  const out: Attr[] = [];
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const m of s.matchAll(re)) out.push({ name: (m[1] ?? '').toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? null });
  return out;
}

/** Flattens a document to indented structural lines. */
export function structure(html: string): string[] {
  const lines: string[] = [];
  const stack: string[] = [];
  let depth = 0;
  let text = '';
  const flush = () => {
    const t = decode(text).replace(/\s+/g, ' ').trim();
    text = '';
    if (t) lines.push('  '.repeat(depth) + JSON.stringify(t));
  };
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/gi;
  let last = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    text += html.slice(last, m.index);
    last = re.lastIndex;
    if (!m[2]) continue; // comment or doctype
    const close = m[1] === '/';
    const name = m[2].toLowerCase();
    if (TRANSPARENT.has(name)) continue;
    if (close) {
      flush();
      // pop to the matching open tag (tolerate optional end tags)
      const at = stack.lastIndexOf(name);
      if (at >= 0) {
        stack.length = at;
        depth = at;
      }
      continue;
    }
    flush();
    const attrs = parseAttrs(m[3]).filter((a) => !a.name.startsWith('data-astro') && a.name !== 'astro-island');
    const parts: string[] = [];
    let id = '';
    let cls = '';
    for (const a of attrs) {
      if (a.name === 'class')
        cls = (a.value ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .sort()
          .map((c) => `.${c}`)
          .join('');
      else if (a.name === 'id') id = `#${a.value ?? ''}`;
      else if (KEEP_ATTRS.has(a.name) || a.name.startsWith('aria-') || a.name.startsWith('data-')) {
        let v = a.value === null ? '' : decode(a.value).replace(/\s+/g, ' ').trim();
        if ((a.name === 'href' || a.name === 'src') && v) v = normUrl(v);
        if (a.name === 'href' && name === 'link' && /^data:image/.test(v)) v = 'data:image/…';
        parts.push(a.value === null ? a.name : `${a.name}=${JSON.stringify(v)}`);
      }
    }
    parts.sort();
    lines.push(`${'  '.repeat(depth)}<${name}${id}${cls}${parts.length ? ` ${parts.join(' ')}` : ''}>`);
    if (name === 'script' || name === 'style') {
      const end = html.toLowerCase().indexOf(`</${name}`, last);
      const body = html
        .slice(last, end < 0 ? html.length : end)
        .replace(/\s+/g, ' ')
        .trim();
      if (body) lines.push(`${'  '.repeat(depth + 1)}[${name} ${body.length} chars] ${JSON.stringify(body.slice(0, 70))}`);
      re.lastIndex = last = end < 0 ? html.length : end;
      continue;
    }
    if (!VOID.has(name) && m[4] !== '/') {
      stack.push(name);
      depth = stack.length;
    }
  }
  text += html.slice(last);
  flush();
  return lines;
}

type Op = { t: ' ' | '-' | '+'; s: string };

/** Line diff: trims the common prefix/suffix, then LCS when small enough, else a multiset difference. */
export function diffLines(a: string[], b: string[]): { ops: Op[]; common: number } {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const am = a.slice(p, a.length - s);
  const bm = b.slice(p, b.length - s);
  const ops: Op[] = a.slice(0, p).map((x) => ({ t: ' ', s: x }));
  let common = p + s;
  if (am.length * bm.length <= 40_000_000) {
    const n = am.length,
      m = bm.length;
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = am[i] === bm[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (am[i] === bm[j]) {
        ops.push({ t: ' ', s: am[i] });
        common++;
        i++;
        j++;
      } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) ops.push({ t: '-', s: am[i++] });
      else ops.push({ t: '+', s: bm[j++] });
    }
    while (i < n) ops.push({ t: '-', s: am[i++] });
    while (j < m) ops.push({ t: '+', s: bm[j++] });
  } else {
    const counts = new Map<string, number>();
    for (const x of bm) counts.set(x, (counts.get(x) ?? 0) + 1);
    for (const x of am) {
      const c = counts.get(x) ?? 0;
      if (c > 0) {
        counts.set(x, c - 1);
        common++;
      } else ops.push({ t: '-', s: x });
    }
    for (const [x, c] of counts) for (let k = 0; k < c; k++) ops.push({ t: '+', s: x });
  }
  for (const x of a.slice(a.length - s)) ops.push({ t: ' ', s: x });
  return { ops, common };
}

/** Unified-style hunks: changed lines plus `context` unchanged lines around them. */
export function renderDiff(ops: Op[], context: number, limit: number): string[] {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((o, i) => {
    if (o.t === ' ') return;
    for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
  });
  const out: string[] = [];
  let skipped = false;
  let shown = 0;
  let truncated = 0;
  ops.forEach((o, i) => {
    if (!keep[i]) {
      skipped = true;
      return;
    }
    if (shown >= limit) {
      truncated++;
      return;
    }
    if (skipped && out.length) out.push('  ⋯');
    skipped = false;
    out.push(`${o.t} ${o.s}`);
    shown++;
  });
  if (truncated) out.push(`  … ${truncated} more diff lines (use --limit or --full)`);
  return out;
}

export function sitePathToFile(p: string): string {
  const clean = p.replace(/^\/+/, '');
  return clean === '' || clean.endsWith('/') ? `${clean}index.html` : clean;
}

export interface PageReport {
  path: string;
  status: 'ok' | 'missing-golden' | 'missing-dist';
  similarity: number;
  golden: number;
  dist: number;
  diff: string[];
}

export function comparePage(
  goldenDir: string,
  distDir: string,
  sitePath: string,
  opts: { context?: number; limit?: number } = {},
): PageReport {
  const rel = sitePathToFile(sitePath);
  const g = path.join(goldenDir, rel);
  const d = path.join(distDir, rel);
  if (!fs.existsSync(g)) return { path: sitePath, status: 'missing-golden', similarity: 0, golden: 0, dist: 0, diff: [] };
  if (!fs.existsSync(d))
    return {
      path: sitePath,
      status: 'missing-dist',
      similarity: 0,
      golden: structure(fs.readFileSync(g, 'utf8')).length,
      dist: 0,
      diff: [],
    };
  const a = structure(fs.readFileSync(g, 'utf8'));
  const b = structure(fs.readFileSync(d, 'utf8'));
  const { ops, common } = diffLines(a, b);
  const similarity = a.length + b.length ? (2 * common) / (a.length + b.length) : 1;
  return {
    path: sitePath,
    status: 'ok',
    similarity,
    golden: a.length,
    dist: b.length,
    diff: renderDiff(ops, opts.context ?? 1, opts.limit ?? 60),
  };
}

function main(argv: string[]): void {
  const root = process.cwd();
  let goldenDir = path.join(root, '.work', 'golden');
  let distDir = path.join(root, 'dist');
  let context = 1;
  let limit = 60;
  const paths: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--golden') goldenDir = path.resolve(argv[++i]);
    else if (a === '--dist') distDir = path.resolve(argv[++i]);
    else if (a === '--context') context = Number(argv[++i]);
    else if (a === '--limit') limit = Number(argv[++i]);
    else if (a === '--full') limit = Infinity;
    else paths.push(/^\d+$/.test(a) ? `/rfc${a}` : a.startsWith('/') ? a : `/${a}`);
  }
  const reports = (paths.length ? paths : DEFAULT_PATHS).map((p) => comparePage(goldenDir, distDir, p, { context, limit }));
  for (const r of reports) {
    if (r.status !== 'ok') {
      console.log(`=== ${r.path}  ${r.status.toUpperCase()}`);
      continue;
    }
    console.log(`=== ${r.path}  similarity ${(r.similarity * 100).toFixed(1)}%  (golden ${r.golden} lines, dist ${r.dist} lines)`);
    if (r.diff.length) console.log(r.diff.join('\n'));
  }
  const ok = reports.filter((r) => r.status === 'ok');
  console.log('\nSummary');
  for (const r of reports)
    console.log(`  ${r.status === 'ok' ? `${(r.similarity * 100).toFixed(1).padStart(5)}%` : r.status.padStart(6)}  ${r.path}`);
  if (ok.length)
    console.log(
      `  mean similarity ${((ok.reduce((s, r) => s + r.similarity, 0) / ok.length) * 100).toFixed(1)}% over ${ok.length} page(s)`,
    );
}

if (/(^|[\\/])parity\.ts$/.test(process.argv[1] || '')) main(process.argv.slice(2));
