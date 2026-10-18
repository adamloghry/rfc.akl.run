/**
 * Glossary pagination: /glossary/ is an A-Z index, /glossary/<letter>/ pages hold the terms
 * ("0-9" for terms that do not start with a letter). A letter with more than GLOSSARY_PAGE_MAX terms
 * continues on /glossary/<letter>-2/, -3/ ... so a page stays far below the 200 KB gz budget
 * (scripts/check-dist.ts) however large the glossary grows.
 */
import type { Site, Term } from './model';

export const GLOSSARY_PAGE_MAX = 400;
/** "Used in" chips shown per term; the rest is summarised as "and N more". */
export const USED_IN_MAX = 24;
export const NON_LETTER = '0-9';

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  plainLanguage?: string;
  used: number[];
  more: number;
}
export interface GlossaryPage {
  /** URL segment: "m", "m-2", "0-9" */
  slug: string;
  /** "M" or "0-9" */
  label: string;
  /** letter key: "m" or "0-9" */
  key: string;
  part: number;
  parts: number;
  entries: GlossaryEntry[];
}
export interface LetterInfo {
  key: string;
  label: string;
  /** slug of the letter's first page */
  slug: string;
  count: number;
}
export interface GlossaryModel {
  total: number;
  pages: GlossaryPage[];
  /** A-Z then 0-9, every letter present even when it has no terms (count 0, no page) */
  letters: LetterInfo[];
  /** term id -> "/glossary/<slug>/#<id>" */
  hrefs: Map<string, string>;
  /** ids whose page is not the one their first character suggests (for the legacy #id forwarder) */
  exceptions: Record<string, string>;
}

const ALPHA = [...'abcdefghijklmnopqrstuvwxyz'];

/** "m" for terms starting with a letter (diacritics folded), else "0-9". */
export function letterKey(term: string): string {
  const c = term.trim().normalize('NFKD').replace(/[̀-ͯ]/g, '').charAt(0).toLowerCase();
  return /^[a-z]$/.test(c) ? c : NON_LETTER;
}

/** The letter page a bare term id is assumed to live on when it is not listed in `exceptions`. */
export const defaultSlug = (id: string): string => (/^[a-z]/.test(id) ? id.charAt(0) : NON_LETTER);

export function glossaryHref(slug: string, id: string): string {
  return `/glossary/${slug}#${id}`;
}

type TermIn = Pick<Term, 'id' | 'term' | 'definition' | 'plainLanguage' | 'rfcs' | 'usedBy'>;

export function buildGlossaryModel(terms: Iterable<TermIn>, pageMax = GLOSSARY_PAGE_MAX): GlossaryModel {
  const byKey = new Map<string, GlossaryEntry[]>();
  let total = 0;
  const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }) || (a.id < b.id ? -1 : 1));
  for (const t of sorted) {
    const used = [...new Set([...(t.rfcs || []), ...(t.usedBy || [])])].sort((a, b) => a - b);
    const key = letterKey(t.term);
    const list = byKey.get(key) ?? [];
    byKey.set(key, list);
    list.push({
      id: t.id,
      term: t.term,
      definition: t.definition || '',
      plainLanguage: t.plainLanguage,
      used: used.slice(0, USED_IN_MAX),
      more: Math.max(0, used.length - USED_IN_MAX),
    });
    total++;
  }
  const pages: GlossaryPage[] = [];
  const letters: LetterInfo[] = [];
  const hrefs = new Map<string, string>();
  const exceptions: Record<string, string> = {};
  for (const key of [...ALPHA, NON_LETTER]) {
    const list = byKey.get(key) ?? [];
    const parts = Math.max(1, Math.ceil(list.length / pageMax));
    const label = key === NON_LETTER ? NON_LETTER : key.toUpperCase();
    letters.push({ key, label, slug: key, count: list.length });
    if (!list.length) continue;
    for (let p = 0; p < parts; p++) {
      const slug = p === 0 ? key : `${key}-${p + 1}`;
      const entries = list.slice(p * pageMax, (p + 1) * pageMax);
      pages.push({ slug, label, key, part: p + 1, parts, entries });
      for (const e of entries) {
        hrefs.set(e.id, glossaryHref(slug, e.id));
        if (slug !== defaultSlug(e.id)) exceptions[e.id] = slug;
      }
    }
  }
  return { total, pages, letters, hrefs, exceptions };
}

const cache = new WeakMap<Site, GlossaryModel>();
/** The glossary model of a site, built once per Site object. */
export function glossaryModel(site: Site): GlossaryModel {
  let m = cache.get(site);
  if (!m) {
    m = buildGlossaryModel(site.glossary.values());
    cache.set(site, m);
  }
  return m;
}

/**
 * Inline script for /glossary/: forwards legacy links (/glossary/#some-id, /glossary/#letter-M) to the
 * letter pages. Ids on their default page are resolved from the id itself; the exceptions are embedded.
 */
export function glossaryForwarder(exceptions: Record<string, string>): string {
  const ex = JSON.stringify(exceptions).replace(/</g, '\\u003c');
  return (
    'try{var h=decodeURIComponent(location.hash.slice(1)),l=h.match(/^letter-(.)$/i),a=/^[a-z]/;' +
    `var x=${ex};` +
    "if(l)location.replace('/glossary/'+(a.test(l[1].toLowerCase())?l[1].toLowerCase():'0-9'));" +
    "else if(h)location.replace('/glossary/'+(x[h]||(a.test(h)?h.charAt(0):'0-9'))+'#'+encodeURIComponent(h))}catch(e){}"
  );
}
