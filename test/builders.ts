// Synthetic RFC index entries and sites for the lib edge-case tests (the fixtures files cover the happy path).
import path from 'node:path';
import { buildSite, type Journey, type RfcContent, type RfcRecord, type Site } from '../src/lib/model';
import type { IndexEntry, RfcIndex } from '../src/lib/rfc-index';
import { must } from './helpers';

export function entry(number: number, over: Partial<IndexEntry> = {}): IndexEntry {
  return {
    number,
    title: `Title of RFC ${number}`,
    authors: ['A. Author'],
    editors: [],
    year: 1990,
    month: 1,
    day: null,
    status: 'INFORMATIONAL',
    pubStatus: 'INFORMATIONAL',
    stream: 'IETF',
    area: null,
    wg: null,
    abstract: null,
    keywords: [],
    pageCount: null,
    doi: `10.17487/RFC${String(number).padStart(4, '0')}`,
    errataUrl: null,
    isAlso: [],
    obsoletes: [],
    obsoletedBy: [],
    updates: [],
    updatedBy: [],
    ...over,
  };
}

export function indexOf(entries: IndexEntry[], extra: { notIssued?: number[]; max?: number } = {}): RfcIndex {
  return {
    entries: new Map(entries.map((e) => [e.number, e])),
    notIssued: new Set(extra.notIssued ?? []),
    max: extra.max ?? Math.max(0, ...entries.map((e) => e.number), ...(extra.notIssued ?? [])),
  };
}

/** A directory that does not exist, so buildSite finds no legacy list, signals or content on disk. */
export const EMPTY_CONTENT = path.join(process.cwd(), 'test', 'fixtures', 'no-such-content-dir');

export interface SiteOptions {
  contents?: RfcContent[];
  journeys?: Journey[];
  notIssued?: number[];
  max?: number;
  buildDate?: Date;
  contentDir?: string;
}

export function siteOf(entries: IndexEntry[], o: SiteOptions = {}): Site {
  return buildSite({
    index: indexOf(entries, o),
    contentDir: o.contentDir ?? EMPTY_CONTENT,
    buildDate: o.buildDate ?? new Date('2026-10-15T00:00:00Z'),
    rfcs: o.contents ?? [],
    journeys: o.journeys ?? [],
    glossary: [],
  });
}

export function rec(site: Site, n: number): RfcRecord {
  return must(site.rfcs.get(n), `RFC ${n}`);
}
