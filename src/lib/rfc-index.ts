export interface IndexEntry {
  number: number; title: string; authors: string[];
  /** subset of authors whose <author> has <title>Editor</title> */
  editors: string[];
  year: number; month: number; day: number | null;
  status: string; pubStatus: string;
  stream: string | null; area: string | null; wg: string | null;
  abstract: string | null;
  keywords: string[]; pageCount: number | null; doi: string | null; errataUrl: string | null;
  isAlso: string[];
  obsoletes: number[]; obsoletedBy: number[]; updates: number[]; updatedBy: number[];
}
export interface RfcIndex { entries: Map<number, IndexEntry>; notIssued: Set<number>; max: number }

import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const INDEX_URL = 'https://www.rfc-editor.org/rfc-index.xml';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // keep everything as strings; we convert explicitly
  trimValues: true,
  isArray: (name) => ['rfc-entry', 'rfc-not-issued-entry', 'author', 'kw', 'doc-id', 'p', 'file-format'].includes(name),
});

const text = (v: any): string => (v == null ? '' : typeof v === 'object' ? textOf(v) : String(v));
// Tolerate mixed content inside abstract paragraphs by flattening any nested text.
function textOf(o: any): string {
  if (Array.isArray(o)) return o.map(textOf).join(' ');
  if (o && typeof o === 'object') return Object.values(o).map(textOf).join(' ');
  return o == null ? '' : String(o);
}
const clean = (v: any): string => text(v).replace(/\s+/g, ' ').trim();

function rfcNumber(id: unknown, ctx: string): number {
  const m = /^RFC0*(\d+)$/.exec(String(id).trim());
  if (!m) throw new Error(`rfc-index: unexpected doc-id ${JSON.stringify(id)} in ${ctx}`);
  return Number(m[1]);
}

/** doc-id list → RFC numbers only (non-RFC ids such as STD/BCP/FYI are dropped). */
function rfcRefs(node: any): number[] {
  const ids = (node && node['doc-id']) || [];
  return ids.map((x: unknown) => /^RFC0*(\d+)$/.exec(String(x).trim())).filter(Boolean).map((m: RegExpExecArray | null) => Number(m![1]));
}

function opt(v: any): string | null { const s = v == null ? '' : clean(v); return s === '' ? null : s; }

export function parseIndex(xml: string): RfcIndex {
  const root = (parser.parse(xml) as any)['rfc-index'];
  const raw = (root && root['rfc-entry']) || [];
  if (raw.length < 1) throw new Error('rfc-index: no rfc-entry elements found (format drift?)');

  const entries = new Map<number, IndexEntry>();
  const notIssued = new Set<number>();
  let max = 0;

  for (const e of raw as any[]) {
    const ids = e['doc-id'] || [];
    if (ids.length !== 1) throw new Error(`rfc-index: rfc-entry with ${ids.length} doc-id elements`);
    const number = rfcNumber(ids[0], 'rfc-entry');
    const ctx = `RFC${number}`;
    const title = opt(e.title);
    if (!title) throw new Error(`rfc-index: ${ctx} lacks title`);
    const status = opt(e['current-status']);
    if (!status) throw new Error(`rfc-index: ${ctx} lacks current-status`);
    const d = e.date;
    if (!d || d.year == null || d.month == null) throw new Error(`rfc-index: ${ctx} lacks date`);
    const month = MONTHS.indexOf(String(d.month).trim()) + 1;
    if (month < 1) throw new Error(`rfc-index: ${ctx} has unknown month ${JSON.stringify(d.month)}`);
    const year = Number(d.year);
    if (!Number.isInteger(year)) throw new Error(`rfc-index: ${ctx} has bad year`);

    const authors: string[] = [];
    const editors: string[] = [];
    for (const a of e.author || []) {
      const name = opt(a.name);
      if (!name) continue;
      authors.push(name);
      if (a.title != null && clean(a.title) === 'Editor') editors.push(name);
    }

    const paras = ((e.abstract && e.abstract.p) || []).map(clean).filter(Boolean);
    const pages = e['page-count'] == null ? NaN : Number(e['page-count']);

    entries.set(number, {
      number, title, authors, editors, year, month,
      day: d.day == null ? null : Number(d.day),
      status,
      pubStatus: opt(e['publication-status']) || status,
      stream: opt(e.stream),
      area: opt(e.area),
      wg: opt(e.wg_acronym),
      abstract: paras.length ? paras.join('\n\n') : null,
      keywords: ((e.keywords && e.keywords.kw) || []).map(clean).filter(Boolean),
      pageCount: Number.isInteger(pages) ? pages : null,
      // The index's <doi> is unpadded (10.17487/RFC903) but the registered DOI is
      // zero-padded to 4 digits (10.17487/RFC0903), so derive it from the number.
      // The one place RFC numbers stay zero-padded: the registered DOI form (10.17487/RFC0903).
      doi: '10.17487/RFC' + String(number).padStart(4, '0'),
      errataUrl: opt(e['errata-url']),
      isAlso: ((e['is-also'] && e['is-also']['doc-id']) || []).map((x: unknown) => String(x).trim()),
      obsoletes: rfcRefs(e.obsoletes),
      obsoletedBy: rfcRefs(e['obsoleted-by']),
      updates: rfcRefs(e.updates),
      updatedBy: rfcRefs(e['updated-by']),
    });
    if (number > max) max = number;
  }

  for (const e of root['rfc-not-issued-entry'] || []) {
    const ids = e['doc-id'] || [];
    if (ids.length !== 1) throw new Error(`rfc-index: rfc-not-issued-entry with ${ids.length} doc-id elements`);
    const n = rfcNumber(ids[0], 'rfc-not-issued-entry');
    notIssued.add(n);
    if (n > max) max = n;
  }

  return { entries, notIssued, max };
}

export async function loadIndex(opts: { cacheDir?: string; maxAgeHours?: number; offline?: boolean; file?: string | null } = {}): Promise<RfcIndex> {
  const { cacheDir = '.cache', maxAgeHours = 20, offline = false, file = null } = opts;
  const cachePath = file || path.join(cacheDir, 'rfc-index.xml');
  let stat: fs.Stats | null = null;
  try { stat = fs.statSync(cachePath); } catch { /* no cache */ }

  if (file || offline) {
    if (!stat) throw new Error(`rfc-index: ${offline ? 'offline mode requires' : 'file not found:'} ${cachePath}`);
    return parseIndex(fs.readFileSync(cachePath, 'utf8'));
  }
  if (stat && Date.now() - stat.mtimeMs < maxAgeHours * 3600 * 1000) {
    return parseIndex(fs.readFileSync(cachePath, 'utf8'));
  }

  const res = await fetch(INDEX_URL, { signal: AbortSignal.timeout(30000) });
  if (res.status !== 200) throw new Error(`rfc-index: fetch ${INDEX_URL} failed with HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = parseIndex(xml); // validate before caching
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const tmp = `${cachePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, xml);
  fs.renameSync(tmp, cachePath);
  return parsed;
}
