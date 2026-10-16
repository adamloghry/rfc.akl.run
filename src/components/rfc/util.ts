import type { RfcRecord, Site } from '../../lib/model';

export const MAX_REL = 10;

export const displayTitle = (r: RfcRecord): string => {
  if (r.shortTitle && r.shortTitle !== r.title && !r.title.startsWith(r.shortTitle)) return `${r.shortTitle}: ${r.title}`;
  return r.title;
};
export const shortLabel = (r: RfcRecord): string => r.shortTitle || r.title;
export const plain = (s: unknown): string =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const upper = (s: unknown): string => String(s).toUpperCase();

export function describe(rfc: RfcRecord): string {
  const c = rfc.content || {};
  const text = plain(c.summary) || plain(rfc.abstract) || displayTitle(rfc);
  return text.length > 200 ? `${text.slice(0, 197).replace(/\s+\S*$/, '')}…` : text;
}

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]);

/** Fact value: "RFC n" becomes a link to /n/ (only numbers in the index); the rest is escaped text. */
export function factValueHtml(v: unknown, site: Site): string {
  return String(v)
    .split(/(\bRFC\s?\d+\b)/)
    .map((part) => {
      const m = /^RFC\s?(\d+)$/.exec(part);
      if (m && site.rfcs.has(Number(m[1]))) return `<a href="/${Number(m[1])}/">${esc(part)}</a>`;
      return esc(part);
    })
    .join('');
}

const normFactLabel = (l: unknown): string =>
  String(l == null ? '' : l)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/s$/, '');
const ALWAYS_DUP = new Set(
  ['published', 'date', 'author', 'authors', 'organization', 'org', 'stream', 'status', 'doi', 'errata'].map(normFactLabel),
);
/** Relation facts are hidden only when the matching computed row is rendered with entries. */
const relGroup = (rfc: RfcRecord): Record<string, number> => ({
  [normFactLabel('builds on')]: [...rfc.obsoletes, ...rfc.updates].length,
  [normFactLabel('obsoletes')]: [...rfc.obsoletes, ...rfc.updates].length,
  [normFactLabel('updates')]: [...rfc.obsoletes, ...rfc.updates].length,
  [normFactLabel('obsoleted by')]: rfc.obsoletedBy.length,
  [normFactLabel('superseded by')]: rfc.obsoletedBy.length,
  [normFactLabel('updated by')]: rfc.updatedBy.length,
});
export const isDupFact = (f: { label?: unknown } | null, rfc?: RfcRecord): boolean => {
  const k = normFactLabel(f?.label);
  return ALWAYS_DUP.has(k) || (rfc ? relGroup(rfc)[k] > 0 : false);
};

export const uniq = <T>(a: T[]): T[] => [...new Set(a)];
