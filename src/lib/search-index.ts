/**
 * Static search index (replaces Pagefind). Writes a handful of JSON files under data/search/:
 *   meta.json    {version, shards, docCount}
 *   docs.json    doc table, row i = [url, number|null, title, shortTitle|null, tier]
 *   t-00.json .. t-NN.json   inverted index shards: {term: [[docId, score], ...]} (top MAX_POSTINGS per term)
 *   prefix.json  {"<3-char prefix>": [top terms starting with it]} for as-you-type matching of the last token
 * The client (src/scripts/search-core.ts) re-implements tokenize() and shardOf(); keep them in sync
 * (test/search-index.test.js checks parity).
 */

import type { Site } from './model';

export const VERSION = 1;
export const DEFAULT_SHARDS = 64;
export const MAX_POSTINGS = 200;
const PREFIX_TERMS = 8; // terms kept per 3-char prefix
const PREFIX_MIN_DF = 3;

const W = { shortTitle: 12, title: 10, number: 20, question: 8, section: 3, summary: 2, abstract: 1, description: 3 };

const STOP = new Set<string>(('a an and are as at be by do does for from how in is it of on or rfc that the this to was what when where which who why with').split(' '));

export function tokenize(text: unknown): string[] {
  const s = String(text == null ? '' : text).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const out: string[] = [];
  for (const t of s.split(/[^a-z0-9]+/)) {
    if (t.length < 2 || STOP.has(t)) continue;
    out.push(t);
  }
  return out;
}

/** FNV-1a 32-bit over the term's UTF-16 code units (terms are ASCII after folding), mod n. */
export function shardOf(term: string, n = DEFAULT_SHARDS): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < term.length; i++) {
    h ^= term.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0) % n;
}

export function shardName(i: number): string { return `data/search/t-${String(i).padStart(2, '0')}.json`; }

export function stripHtml(h: unknown): string {
  return String(h == null ? '' : h).replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");
}

/** Accumulates weighted term frequencies for one doc. */
function fieldTerms(fields: [number, unknown[]][]): Map<string, number> {
  const m = new Map<string, number>(); // term -> score
  for (const [weight, texts] of fields) {
    const tf = new Map<string, number>();
    for (const t of texts) for (const tok of tokenize(t)) tf.set(tok, (tf.get(tok) || 0) + 1);
    for (const [tok, n] of tf) m.set(tok, (m.get(tok) || 0) + Math.round(weight * (1 + Math.log2(n))));
  }
  return m;
}

export function buildSearchIndex(site: Site, opts: { shards?: number } = {}): { files: { path: string; json: string }[]; stats: Record<string, number> } {
  const shards = opts.shards || DEFAULT_SHARDS;
  const docs: unknown[][] = [];
  const postings = new Map<string, [number, number][]>(); // term -> [[id, score]]
  const add = (row: unknown[], fields: [number, unknown[]][]) => {
    const id = docs.length;
    docs.push(row);
    for (const [term, score] of fieldTerms(fields)) {
      let p = postings.get(term);
      if (!p) postings.set(term, (p = []));
      p.push([id, score]);
    }
  };

  const rfcs = [...site.rfcs.values()].sort((a, b) => a.number - b.number);
  for (const r of rfcs) {
    const c = r.content || {};
    const fields: [number, unknown[]][] = [
      [W.shortTitle, [r.shortTitle]],
      [W.title, [r.title]],
      [W.number, [String(r.number)]],
      [W.question, c.questions || []],
      [W.section, (c.sections || []).map((s: any) => s.title)],
      [W.summary, [stripHtml(c.summary)]],
    ];
    if (r.tier === 'index') fields.push([W.abstract, [r.abstract]]);
    add([r.url, r.number, r.title, r.shortTitle || null, r.tier], fields);
  }
  for (const j of site.journeys || []) {
    add([`/journeys/${j.slug}/`, null, j.title, null, 'journey'], [
      [W.title, [j.title]], [W.question, j.questions || []], [W.description, [j.description]],
    ]);
  }

  const shardMaps: Record<string, [number, number][]>[] = Array.from({ length: shards }, () => ({}));
  const df = new Map<string, number>();
  for (const [term, p] of postings) {
    df.set(term, p.length);
    if (p.length > MAX_POSTINGS) { p.sort((a, b) => b[1] - a[1] || a[0] - b[0]); p.length = MAX_POSTINGS; }
    p.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    shardMaps[shardOf(term, shards)][term] = p;
  }

  const byPrefix: Record<string, [string, number][]> = {};
  for (const [term, n] of df) {
    if (term.length < 4 || n < PREFIX_MIN_DF) continue;
    (byPrefix[term.slice(0, 3)] = byPrefix[term.slice(0, 3)] || []).push([term, n]);
  }
  const prefix: Record<string, string[]> = {};
  for (const k of Object.keys(byPrefix).sort()) {
    prefix[k] = byPrefix[k].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, PREFIX_TERMS).map((x) => x[0]);
  }

  const sortKeys = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const files: { path: string; json: string }[] = [
    { path: 'data/search/meta.json', json: JSON.stringify({ version: VERSION, shards, docCount: docs.length }) },
    { path: 'data/search/docs.json', json: JSON.stringify(docs) },
    { path: 'data/search/prefix.json', json: JSON.stringify(prefix) },
  ];
  shardMaps.forEach((m, i) => files.push({ path: shardName(i), json: JSON.stringify(sortKeys(m)) }));
  const stats = { docs: docs.length, terms: postings.size, shards, prefixes: Object.keys(prefix).length, files: files.length };
  return { files, stats };
}
