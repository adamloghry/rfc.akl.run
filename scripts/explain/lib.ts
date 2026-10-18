/**
 * Shared helpers for the explainer-generation tooling (scripts/explain/*).
 * Paths are injectable so tests can run against temp directories.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadIndex, SNAPSHOT_PATH } from '../../src/lib/rfc-index';

export const PROMPT_VERSION = 'explain-v2';
export const SCHEMA_VERSION = 'rfc-datasheet-v1';
export const MODEL = 'claude-sonnet-5-5';
/** RFCs whose .txt is a 404 at the RFC Editor; agents read the PDF instead. */
export const PDF_ONLY = [8, 9, 51, 418, 500, 530, 598];

export type TierName = 'large' | 'full' | 'standard' | 'compact';
export const TIERS: TierName[] = ['large', 'full', 'standard', 'compact'];
/** RFCs per agent work unit. */
export const UNIT_SIZE: Record<TierName, number> = { large: 1, full: 2, standard: 3, compact: 6 };
/** Inclusive section-count bounds per tier (enforced by validate.ts, stated in SPEC.md). */
export const SECTION_BOUNDS: Record<TierName, [number, number]> = {
  large: [5, 10],
  full: [5, 8],
  standard: [4, 6],
  compact: [3, 4],
};
/** Maximum number of viz per tier. */
export const VIZ_MAX: Record<TierName, number> = { large: 8, full: 6, standard: 3, compact: 1 };

export interface Paths {
  root: string;
  contentDir: string;
  glossaryContentDir: string;
  textDir: string;
  outDir: string;
  queueFile: string;
  failedFile: string;
  fetchFailuresFile: string;
  glossaryWorkDir: string;
  cacheFile: string;
  aprilFile: string;
}

export function defaultPaths(root = process.cwd()): Paths {
  return {
    root,
    contentDir: path.join(root, 'content', 'rfcs'),
    glossaryContentDir: path.join(root, 'content', 'glossary'),
    textDir: path.join(root, '.work', 'rfc-text'),
    outDir: path.join(root, '.work', 'explain', 'out'),
    queueFile: path.join(root, '.work', 'explain', 'queue.json'),
    failedFile: path.join(root, '.work', 'explain', 'failed.json'),
    fetchFailuresFile: path.join(root, '.work', 'explain', 'fetch-failures.json'),
    glossaryWorkDir: path.join(root, '.work', 'glossary'),
    cacheFile: path.join(root, '.cache', 'explain-index.json'),
    aprilFile: path.join(root, 'scripts', 'explain', 'april-fools.json'),
  };
}

/** Compact view of the RFC Editor index, cached because parsing the 14 MB XML takes seconds. */
export interface IndexSummary {
  max: number;
  issued: number[];
  notIssued: number[];
  /** n -> [pageCount | null, normalized status key, obsoleted (0/1), year, month] */
  info: Record<string, [number | null, string, 0 | 1, number, number]>;
  titles: Record<string, string>;
}

import * as statusLib from '../../src/lib/status';

export function summarize(index: ReturnType<typeof loadIndex>): IndexSummary {
  const info: IndexSummary['info'] = {};
  const titles: IndexSummary['titles'] = {};
  for (const [n, e] of index.entries) {
    info[n] = [e.pageCount, statusLib.normalize(e.status).key, e.obsoletedBy.length ? 1 : 0, e.year, e.month];
    titles[n] = e.title;
  }
  return {
    max: index.max,
    issued: [...index.entries.keys()].sort((a, b) => a - b),
    notIssued: [...index.notIssued].sort((a, b) => a - b),
    info,
    titles,
  };
}

/** Loads the cached summary when it is newer than the index XML; otherwise parses the XML and refreshes the cache. */
export function loadSummary(paths: Paths = defaultPaths()): IndexSummary {
  const xml = process.env.RFC_INDEX_FILE || path.join(paths.root, SNAPSHOT_PATH);
  try {
    if (fs.statSync(paths.cacheFile).mtimeMs >= fs.statSync(xml).mtimeMs) {
      return JSON.parse(fs.readFileSync(paths.cacheFile, 'utf8')) as IndexSummary;
    }
  } catch {
    // no usable cache; rebuild below
  }
  const summary = summarize(loadIndex({ snapshot: xml }));
  fs.mkdirSync(path.dirname(paths.cacheFile), { recursive: true });
  writeAtomic(paths.cacheFile, JSON.stringify(summary));
  return summary;
}

export function writeAtomic(file: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export const writeJson = (file: string, data: unknown, compact = false): void =>
  writeAtomic(file, compact ? JSON.stringify(data) : `${JSON.stringify(data, null, 2)}\n`);

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function readJsonOr<T>(file: string, fallback: T): T {
  try {
    return readJson<T>(file);
  } catch {
    return fallback;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: content files are loose JSON validated by the site schema
export type Content = Record<string, any>;

export function readContent(paths: Paths, n: number): Content | null {
  const f = path.join(paths.contentDir, `${n}.json`);
  return fs.existsSync(f) ? readJson<Content>(f) : null;
}

export const hasSections = (c: Content | null): boolean => Array.isArray(c?.sections) && c.sections.length > 0;

/**
 * True when an RFC needs no (re)generation: it has an explainer from before this pipeline (no `promptVersion`) or one
 * generated under the current PROMPT_VERSION. Output of an older prompt version is stale: plan queues it and merge replaces it.
 */
export const isExplained = (c: Content | null): boolean =>
  hasSections(c) && (!c?.provenance?.promptVersion || c.provenance.promptVersion === PROMPT_VERSION);

export function aprilFools(paths: Paths): Set<number> {
  const list = readJsonOr<{ rfcs: { number: number }[] }>(paths.aprilFile, { rfcs: [] });
  return new Set(list.rfcs.map((r) => r.number));
}

export function tierOf(n: number, summary: IndexSummary, april: Set<number>): TierName {
  const [pages, status, obsoleted] = summary.info[n] ?? [null, 'unknown', 0, 0, 0];
  if (pages !== null && pages > 150) return 'large';
  if ((pages !== null && pages <= 5) || n < 800 || april.has(n)) return 'compact';
  const standardsTrack = ['proposed-standard', 'draft-standard', 'internet-standard', 'bcp'].includes(status);
  if (standardsTrack && !obsoleted && pages !== null) return 'full';
  return 'standard';
}

export const outFile = (paths: Paths, n: number): string => path.join(paths.outDir, `${n}.json`);

/** The source file agents read: the PDF for PDF-only RFCs and for RFCs whose .txt is only a pointer to a PDF, else the .txt. */
/**
 * Where an agent should read RFC n from: the plain-text conversion of a PDF edition (`pdf-<n>.txt`, made with
 * pdftotext or OCR for scans) when present, else the PDF itself, else the RFC Editor's .txt.
 */
export function textPathFor(paths: Paths, n: number): string {
  const converted = path.join(paths.textDir, `pdf-${n}.txt`);
  if (fs.existsSync(converted)) return converted;
  const pdf = path.join(paths.textDir, `${n}.pdf`);
  return PDF_ONLY.includes(n) || fs.existsSync(pdf) ? pdf : path.join(paths.textDir, `${n}.txt`);
}

export function parseNumbers(args: string[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    const m = /^(?:\.work\/explain\/out\/)?(\d+)(?:\.json)?$/.exec(a);
    if (!m) throw new Error(`not an RFC number: ${a} (use plain numbers, no zero padding)`);
    if (m[1].length > 1 && m[1].startsWith('0')) throw new Error(`zero-padded RFC number: ${a}`);
    out.push(Number(m[1]));
  }
  return out;
}

export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function isMain(file: string): boolean {
  const base = path.basename(file).replace(/\.ts$/, '');
  return new RegExp(`(^|[\\\\/])${base}\\.ts$`).test(process.argv[1] || '');
}
