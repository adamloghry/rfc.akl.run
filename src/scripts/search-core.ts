// Pure search functions shared by the header/hero search (search.ts) and tests.
// Keep tokenize/shardOf in sync with src/lib/search-index.ts (test/search-index.test.ts checks parity).

import { displayTitle } from '../lib/display-title';

export type Posting = [number, number];
export type Postings = Record<string, Posting[]>;
export type Cand = { term: string; w: number };
export type Plan = { slots: Cand[][] };
export type Ranked = { id: number; score: number; hits: number };
export type DocRowIn = [string, number | null, string, string | null, string];
export type Row = { label: string; title: string; tag: string; tier: string; href: string };
export type Question = { q: string; href?: string; label?: string; title?: string };

export function parseNumber(q: string, max: number): number | null {
  if (!/^\d+$/.test(q)) return null;
  const n = parseInt(q, 10);
  return n >= 1 && n <= max ? n : null;
}

export function matchQuestions<T extends Question>(q: string, list: T[] | null | undefined): T[] {
  const words = String(q)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (!words.length || !list) return [];
  return list.filter((item) => {
    const s = String(item.q).toLowerCase();
    return words.every((w) => s.indexOf(w) !== -1);
  });
}

const STOP = new Set(
  'a an and are as at be by do does for from how in is it of on or rfc that the this to was what when where which who why with'.split(' '),
);

export function tokenize(text: unknown): string[] {
  let s = String(text == null ? '' : text);
  if (s.normalize) s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const out: string[] = [];
  for (const p of s.toLowerCase().split(/[^a-z0-9]+/)) if (p.length >= 2 && !STOP.has(p)) out.push(p);
  return out;
}

export function shardOf(term: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < term.length; i++) {
    h ^= term.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0) % n;
}

/** Query -> one slot per distinct token; the last one also expands through the 3-char prefix table (weight 0.6). */
export function plan(q: string, prefixMap?: Record<string, string[]> | null): Plan {
  const toks: string[] = [];
  const seen = new Set<string>();
  const all = tokenize(q);
  for (const t of all)
    if (!seen.has(t)) {
      seen.add(t);
      toks.push(t);
    }
  const slots: Cand[][] = toks.map((t) => [{ term: t, w: 1 }]);
  const endsOpen = !/\s$/.test(String(q));
  const last = all.length ? all[all.length - 1] : null;
  if (endsOpen && last && last.length >= 3 && prefixMap) {
    const slot = slots[toks.indexOf(last)];
    for (const t of prefixMap[last.slice(0, 3)] || []) if (t !== last && t.indexOf(last) === 0) slot.push({ term: t, w: 0.6 });
  }
  return { slots };
}

export function termsOf(p: Plan): string[] {
  const out: string[] = [];
  for (const slot of p.slots) for (const c of slot) if (out.indexOf(c.term) < 0) out.push(c.term);
  return out;
}

export function shardsOf(p: Plan, n: number): number[] {
  const out: number[] = [];
  for (const t of termsOf(p)) {
    const k = shardOf(t, n);
    if (out.indexOf(k) < 0) out.push(k);
  }
  return out;
}

/** Docs matching every slot come first; if none do, only the docs matching the most slots are returned. */
export function rank(p: Plan, postings: Postings, limit?: number): Ranked[] {
  if (!p.slots.length) return [];
  const acc: Record<string, Ranked> = {};
  for (const slot of p.slots) {
    const best: Record<string, number> = {};
    for (const c of slot) {
      for (const e of postings[c.term] || []) {
        const v = e[1] * c.w;
        if (!(best[e[0]] >= v)) best[e[0]] = v;
      }
    }
    for (const id of Object.keys(best)) {
      const a = acc[id] ?? { id: +id, score: 0, hits: 0 };
      acc[id] = a;
      a.score += best[id];
      a.hits++;
    }
  }
  let list = Object.keys(acc).map((id) => acc[id]);
  let top = 0;
  for (const a of list) if (a.hits > top) top = a.hits;
  list = list.filter((a) => a.hits === top);
  list.sort((a, b) => b.score - a.score || a.id - b.id);
  return limit ? list.slice(0, limit) : list;
}

/** Result tag for a page tier: every RFC page is the RFC text; the explainers are the ISO Plain Language bonus. */
export function tierTag(tier: string): string {
  if (tier === 'journey') return 'JOURNEY';
  if (tier === 'explainer' || tier === 'interactive') return 'ISO Plain Language';
  if (tier === 'index') return 'RFC';
  return tier.toUpperCase();
}

/** doc row [url, number|null, title, shortTitle|null, tier] -> result row */
export function docRow(d: DocRowIn): Row {
  const tier = d[4] || '';
  return {
    label: d[1] ? `RFC ${d[1]}` : tier === 'journey' ? 'JOURNEY' : 'PAGE',
    title: displayTitle(d[3], d[2]),
    tag: tierTag(tier),
    tier: tier === 'journey' ? '' : tier,
    href: d[0],
  };
}
