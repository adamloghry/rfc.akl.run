import type { RfcRecord, Site } from './model';
export const DAY = 86400000;

/** Publication date as UTC midnight; when the index has no day, the LAST day of the month. */
export function pubDate(r: { year: number; month: number; day: number | null }): Date {
  const day = r.day || new Date(Date.UTC(r.year, r.month, 0)).getUTCDate();
  return new Date(Date.UTC(r.year, r.month - 1, day));
}

type Dated = { number: number; year: number; month: number; day: number | null };

export function byDate(a: Dated, b: Dated): number {
  return pubDate(a).getTime() - pubDate(b).getTime() || a.number - b.number;
}

const RFC_RE = /\bRFC\s?(\d{1,5})\b/g;
const HREF_RE = /href="\/(\d+)\/"/g;

function scan(text: unknown, out: Set<number>) {
  if (typeof text !== 'string') return;
  for (const re of [RFC_RE, HREF_RE]) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) out.add(Number(m[1]));
  }
}

/** RFC numbers mentioned by a content object (sections, summary, today, references). */
export interface MentionSource {
  summary?: unknown;
  today?: unknown;
  sections?: Array<{ content?: unknown }>;
  references?: Array<{ text?: unknown; rfc?: unknown }>;
}

export function contentMentions(content: MentionSource | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!content) return out;
  scan(content.summary, out);
  scan(content.today, out);
  for (const s of content.sections || []) scan(s.content, out);
  for (const r of content.references || []) {
    scan(r.text, out);
    if (typeof r.rfc === 'number' && Number.isInteger(r.rfc)) out.add(r.rfc);
  }
  return out;
}

/** Fills rfc.mentionedIn (sorted asc, no self) on every record of the site. */
export function mentions(site: Site): Site {
  const into = new Map<number, Set<number>>();
  for (const rfc of site.rfcs.values()) {
    for (const n of contentMentions(rfc.content)) {
      if (n === rfc.number || !site.rfcs.has(n)) continue;
      const set = into.get(n) ?? new Set<number>();
      into.set(n, set);
      set.add(rfc.number);
    }
  }
  for (const rfc of site.rfcs.values()) {
    rfc.mentionedIn = [...(into.get(rfc.number) || [])].sort((a, b) => a - b);
  }
  return site;
}

function item(r: RfcRecord, self: RfcRecord) {
  return { number: r.number, year: r.year, label: r.shortTitle || r.title, current: r === self, url: r.url };
}

const MAX_ITEMS = 5;

export function lineage(
  rfc: RfcRecord,
  site: Site,
): { title: string; items: { number: number; year: number; label: string; current: boolean; url: string }[] } {
  const curated = rfc.content?.lineage;
  if (curated && Array.isArray(curated.rfcs) && curated.rfcs.length) {
    const items = curated.rfcs
      .map((n: number) => site.rfcs.get(n))
      .filter(Boolean)
      .map((r: RfcRecord) => item(r, rfc));
    return { title: curated.title || 'Lineage', items };
  }
  const seen = new Set([rfc.number]);
  const related: RfcRecord[] = [rfc];
  for (const n of [...rfc.obsoletes, ...rfc.updates, ...rfc.obsoletedBy]) {
    const r = site.rfcs.get(n);
    if (r && !seen.has(n)) {
      seen.add(n);
      related.push(r);
    }
  }
  related.sort(byDate);
  let list = related;
  if (list.length > MAX_ITEMS) {
    const at = list.indexOf(rfc);
    const start = Math.min(Math.max(at - 2, 0), list.length - MAX_ITEMS);
    list = list.slice(start, start + MAX_ITEMS);
  }
  return { title: 'Lineage', items: list.map((r) => item(r, rfc)) };
}
