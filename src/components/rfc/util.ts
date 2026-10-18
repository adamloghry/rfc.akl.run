import { displayTitle as joinTitle } from '../../lib/display-title';
import type { RfcRecord, Site } from '../../lib/model';

export const MAX_REL = 10;

export const displayTitle = (r: RfcRecord): string => joinTitle(r.shortTitle, r.title);
export const shortLabel = (r: RfcRecord): string => r.shortTitle || r.title;
export const plain = (s: unknown): string =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const upper = (s: unknown): string => String(s).toUpperCase();

/** Meta/OG description: leads with the RFC itself (title, status, date, the authors' abstract), not the explainer. */
export function describe(rfc: RfcRecord): string {
  const head = `RFC ${rfc.number}: ${displayTitle(rfc)}. ${rfc.statusLabel}, ${rfc.dateLabel}.`;
  const abs = plain(rfc.abstract);
  const text = abs ? `${head} ${abs}` : `${head} The original RFC text${rfc.content ? ', with an optional AI ELI5 explainer' : ''}.`;
  return text.length > 200 ? `${text.slice(0, 197).replace(/\s+\S*$/, '')}…` : text;
}

/** "claude-sonnet-5-5" -> "Claude Sonnet"; "claude-3-5-haiku-20241022" -> "Claude Haiku"; unknown -> "". */
export function modelFamily(model: unknown): string {
  const m = /\b(opus|sonnet|haiku)\b/i.exec(String(model ?? ''));
  return m?.[1] ? `Claude ${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()}` : '';
}

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]);

/** Fact value: "RFC n" becomes a link to /rfc<n> (only numbers in the index); the rest is escaped text. */
export function factValueHtml(v: unknown, site: Site): string {
  return String(v)
    .split(/(\bRFC\s?\d+\b)/)
    .map((part) => {
      const m = /^RFC\s?(\d+)$/.exec(part);
      if (m && site.rfcs.has(Number(m[1]))) return `<a href="/rfc${Number(m[1])}">${esc(part)}</a>`;
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

/** A section is worth rendering when it has prose (either level) or a diagram; a bare heading would dangle. */
export const sectionHasBody = (s: { content?: unknown; eli5?: unknown }, hasViz: boolean): boolean =>
  hasViz || plain(s.content).length > 0 || plain(s.eli5).length > 0;

/** Whether the right rail would hold anything (so thin explainers do not render an empty column). */
export function hasRightRail(rfc: RfcRecord, site: Site): boolean {
  const c = rfc.content || {};
  return !!(
    plain(c.eli5?.summary) ||
    plain(c.today) ||
    (c.glossary || []).some((id: string) => site.glossary.has(id)) ||
    rfc.journeys.some((slug) => site.journeys.some((j) => j.slug === slug)) ||
    (c.implementations || []).length ||
    rfc.mentionedIn.length ||
    c.provenance?.source === 'llm-draft'
  );
}
