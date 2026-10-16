import fs from 'node:fs';
import path from 'node:path';
import * as areas from './areas';
import * as graph from './graph';
import * as priority from './priority';
import type { IndexEntry, RfcIndex } from './rfc-index';
import { checkContent } from './sanitize-check';
import * as status from './status';

export type Tier = 'index' | 'summary' | 'explainer' | 'interactive';

/** Content JSON (C7). Loosely typed on purpose: the Zod schema in content.config.ts is the authority. */
// biome-ignore lint/suspicious/noExplicitAny: validated by Zod at the boundary; consumers read optional keys freely
export type RfcContent = Record<string, any>;

export interface RfcRecord {
  number: number;
  slug: string | null;
  editors: string[];
  indexAuthors: string[];
  indexTitle: string;
  title: string;
  shortTitle: string | null;
  authors: string[];
  organization: string | null;
  year: number;
  month: number;
  day: number | null;
  dateLabel: string;
  status: string;
  statusLabel: string;
  statusTone: 'green' | 'amber' | 'neutral';
  stream: string | null;
  area: string | null;
  wg: string | null;
  abstract: string | null;
  keywords: string[];
  pageCount: number | null;
  doi: string | null;
  errataUrl: string | null;
  isAlso: string[];
  obsoletes: number[];
  obsoletedBy: number[];
  updates: number[];
  updatedBy: number[];
  category: string;
  categoryReviewed: boolean;
  tier: Tier;
  content: RfcContent | null;
  isNew: boolean;
  mentionedIn: number[];
  journeys: string[];
  priority: number;
  url: string;
}

export interface JourneyStep {
  title: string;
  subtitle?: string;
  description?: string;
  rfcs: { number: number; label?: string }[];
}
export interface Journey {
  slug: string;
  title: string;
  description?: string;
  questions?: string[];
  featured?: boolean;
  steps: JourneyStep[];
  // biome-ignore lint/suspicious/noExplicitAny: content files are looseObjects; extra keys pass through to the pages
  [k: string]: any;
}
export interface Term {
  id: string;
  term: string;
  definition: string;
  eli5?: string;
  rfcs: number[];
  usedBy: number[];
  // biome-ignore lint/suspicious/noExplicitAny: content files are looseObjects; extra keys pass through to the pages
  [k: string]: any;
}

export interface Site {
  buildDate: Date;
  max: number;
  rfcs: Map<number, RfcRecord>;
  notIssued: Set<number>;
  reserved: Set<number>;
  journeys: Journey[];
  glossary: Map<string, Term>;
  categories: { key: string; name: string }[];
  counts: { total: number; index: number; summary: number; explainer: number; interactive: number };
  only?: Set<number>;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Reads JSON the caller vouches for (content files are validated separately by lint and the Zod schemas). */
function readJson<T>(file: string, fallback?: T): T {
  if (!fs.existsSync(file)) return fallback as T;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

export function readDir<T = RfcContent>(dir: string): { file: string; data: T }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: path.join(dir, f), data: readJson<T>(path.join(dir, f)) }));
}

/** Build-time guard (same validator as lint): throws on the first unsafe HTML field. */
function assertSafeHtml(kind: 'rfc' | 'glossary', dirName: string, file: string, data: unknown) {
  const [bad] = checkContent(data, kind);
  if (bad) throw new Error(`content/${dirName}/${path.basename(file)}: unsafe HTML at ${bad.ptr}: ${bad.problem}`);
}

export function tierOf(content: RfcContent | null): Tier {
  if (!content) return 'index';
  if ((content.viz || []).some((v: { type?: string }) => v.type === 'sequence-sim')) return 'interactive';
  if (Array.isArray(content.sections) && content.sections.length) return 'explainer';
  if (typeof content.summary === 'string' && content.summary.trim()) return 'summary';
  return 'index';
}

/** A glossary entry as stored in content/glossary (usedBy is derived, rfcs optional). */
export interface GlossaryInput {
  id: string;
  term: string;
  definition: string;
  eli5?: string;
  rfcs?: number[];
  [k: string]: unknown;
}

export interface BuildSiteOptions {
  index: RfcIndex;
  /** root of content/ (signals, legacy-reviewed.json, and fallback JSON dirs); default <cwd>/content */
  contentDir?: string;
  buildDate?: Date;
  /** pre-loaded (validated) collection data; when omitted, read from contentDir */
  rfcs?: RfcContent[];
  journeys?: Journey[];
  glossary?: GlossaryInput[];
}

export function buildSite(opts: BuildSiteOptions): Site {
  const { index } = opts;
  const contentDir = opts.contentDir || path.join(process.cwd(), 'content');
  const buildDate = opts.buildDate || new Date();
  const legacy = new Set<number>(readJson(path.join(contentDir, 'legacy-reviewed.json'), []));
  const traffic = readJson<Record<string, number>>(path.join(contentDir, 'signals', 'traffic.json'), {});

  let rfcData = opts.rfcs;
  if (!rfcData) {
    rfcData = readDir(path.join(contentDir, 'rfcs')).map(({ file, data }) => {
      assertSafeHtml('rfc', 'rfcs', file, data);
      if (!index.entries.has(data.number)) throw new Error(`${file}: RFC ${data.number} is not in the RFC index`);
      return data;
    });
  }
  const contents = new Map<number, RfcContent>();
  for (const data of rfcData) {
    if (!index.entries.has(data.number)) throw new Error(`content/rfcs: RFC ${data.number} is not in the RFC index`);
    contents.set(data.number, data);
  }

  const rfcs = new Map<number, RfcRecord>();
  for (const [number, e] of index.entries as Map<number, IndexEntry>) {
    const c = contents.get(number) || null;
    const st = status.normalize(e.status);
    const day = e.day || new Date(Date.UTC(e.year, e.month, 0)).getUTCDate();
    const ageDays = Math.floor((buildDate.getTime() - Date.UTC(e.year, e.month - 1, day)) / 86400000);
    rfcs.set(number, {
      number,
      slug: c?.slug || null,
      title: c?.title || e.title,
      shortTitle: c?.shortTitle || null,
      authors: c?.authors?.length ? c.authors : e.authors,
      editors: e.editors || [],
      indexAuthors: e.authors,
      indexTitle: e.title,
      organization: c?.organization || null,
      year: e.year,
      month: e.month,
      day: e.day || null,
      dateLabel: `${MONTHS[e.month - 1]} ${e.year}`,
      status: st.key,
      statusLabel: st.label,
      statusTone: st.tone,
      stream: e.stream,
      area: e.area,
      wg: e.wg,
      abstract: e.abstract,
      keywords: e.keywords,
      pageCount: e.pageCount,
      doi: e.doi,
      errataUrl: e.errataUrl,
      isAlso: e.isAlso,
      obsoletes: e.obsoletes,
      obsoletedBy: e.obsoletedBy,
      updates: e.updates,
      updatedBy: e.updatedBy,
      category: c?.category || areas.guessCategory(e),
      categoryReviewed: !!((c && c.categoryReviewed === true) || legacy.has(number)),
      tier: tierOf(c),
      content: c,
      isNew: ageDays <= 30,
      mentionedIn: [],
      journeys: [],
      priority: 0,
      url: `/${number}/`,
    });
  }

  const journeys: Journey[] = opts.journeys
    ? [...opts.journeys].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    : readDir<Journey>(path.join(contentDir, 'journeys')).map((x) => x.data);
  for (const j of journeys) {
    for (const step of j.steps || []) {
      for (const ref of step.rfcs || []) {
        const r = rfcs.get(ref.number);
        if (r && !r.journeys.includes(j.slug)) r.journeys.push(j.slug);
      }
    }
  }

  const glossary = new Map<string, Term>();
  const terms = opts.glossary
    ? [...opts.glossary].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    : readDir<GlossaryInput>(path.join(contentDir, 'glossary')).map(({ file, data }) => {
        assertSafeHtml('glossary', 'glossary', file, data);
        return data;
      });
  for (const data of terms) glossary.set(data.id, { ...data, rfcs: data.rfcs || [], usedBy: [] as number[] });
  for (const r of rfcs.values()) {
    for (const id of r.content?.glossary || []) {
      const t = glossary.get(id);
      if (t && !t.usedBy.includes(r.number)) t.usedBy.push(r.number);
    }
  }
  for (const t of glossary.values()) t.usedBy.sort((a, b) => a - b);

  const reserved = new Set<number>();
  for (let n = 1; n <= index.max; n++) if (!rfcs.has(n) && !index.notIssued.has(n)) reserved.add(n);

  const counts = { total: rfcs.size, index: 0, summary: 0, explainer: 0, interactive: 0 };
  for (const r of rfcs.values()) counts[r.tier]++;

  const site: Site = {
    buildDate,
    max: index.max,
    rfcs,
    notIssued: new Set(index.notIssued),
    reserved,
    journeys,
    glossary,
    categories: areas.CATEGORIES.map((c) => ({ ...c })),
    counts,
  };

  graph.mentions(site);
  for (const r of rfcs.values()) r.priority = priority.score(r, site, Number(traffic[r.number]) || 0);
  return site;
}
