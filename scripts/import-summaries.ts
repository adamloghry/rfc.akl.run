// Validate LLM-drafted RFC summaries (.work/summaries/out/batch-NNN.part-K.json) against the
// batch inputs and merge them into content/rfcs/*.json. See Task 13/14 in the redesign plan.
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../src/lib/areas';
import { loadIndex, type RfcIndex } from '../src/lib/rfc-index';
import { lint } from './lint-content';

const ROOT = process.cwd();
const CATEGORY_KEYS = new Set(CATEGORIES.map((c) => c.key));
const PART_SIZE = 25;
const MODEL = 'claude-sonnet-5-5';
const ITEM_KEYS = ['number', 'shortTitle', 'category', 'summary', 'eli5', 'questions'];
const LIMITS = { summaryWords: 90, summaryParas: 2, eli5Words: 50, shortTitle: 24, maxQuestions: 3 };

/** A draft item as the drafting agents emit it. Fields stay `unknown` until validateItem has accepted them. */
export interface DraftItem {
  number: number;
  shortTitle: string | null;
  category: string;
  summary: string;
  eli5: string;
  questions: string[];
}
interface InputItem {
  number: number;
  guessedCategory?: string;
}
interface Reject {
  batch: string;
  part: string | null;
  number: number | null;
  problems: string[];
}
interface CategoryChange {
  number: number;
  batch: string;
  guessed: string | undefined;
  chosen: string;
  final: unknown;
}
type MergeResult =
  | { file: string; status: 'created' | 'updated' | 'unchanged'; finalCategory: unknown }
  | { file: string; status: 'invalid'; reason: string }
  | { file: string; status: 'skipped' };
type JsonObject = Record<string, unknown>;

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const wordCount = (html: string): number =>
  html
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

/** Parse restricted HTML: sequence of <p>…</p> holding text and em/strong/code, no attributes.
 */
export function checkHtml(html: unknown, maxParas: number): { paras: number; error: string | null } {
  if (typeof html !== 'string') return { paras: 0, error: 'not a string' };
  if (/<(?!\/?(p|em|strong|code)>)/.test(html))
    return { paras: 0, error: 'disallowed tag or attribute (only <p>, <em>, <strong>, <code> without attributes)' };
  const tag = /<(\/?)(p|em|strong|code)>/g;
  const stack: string[] = [];
  let paras = 0;
  let last = 0;
  let m: RegExpExecArray | null = tag.exec(html);
  for (; m; m = tag.exec(html)) {
    const between = html.slice(last, m.index);
    if (!stack.length && between.trim()) return { paras, error: 'text outside <p>' };
    last = tag.lastIndex;
    const close = m[1];
    const name = m[2];
    if (!close) {
      if (name === 'p') {
        if (stack.length) return { paras, error: 'nested <p>' };
        paras++;
      } else if (!stack.length) return { paras, error: `<${name}> outside <p>` };
      stack.push(name);
    } else if (stack.pop() !== name) return { paras, error: `mismatched </${name}>` };
  }
  if (stack.length) return { paras, error: 'unclosed tag' };
  if (html.slice(last).trim()) return { paras, error: 'text outside <p>' };
  if (paras < 1) return { paras, error: 'no <p>' };
  if (paras > maxParas) return { paras, error: `${paras} paragraphs (max ${maxParas})` };
  if (/<(p|em|strong|code)>\s*<\/\1>/.test(html)) return { paras, error: 'empty element' };
  return { paras, error: null };
}

export function rfcMentions(html: string): number[] {
  const found = new Set<number>();
  const re = /\bRFCs?[\s-]*(\d+(?:\s*(?:,|,?\s*and|,?\s*or|&)\s*(?:RFCs?[\s-]*)?\d+)*)/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) for (const d of m[1]?.match(/\d+/g) ?? []) found.add(Number(d));
  return [...found];
}

/** Returns the problems found (empty = valid). */
export function validateItem(
  raw: unknown,
  { index, batchNumbers }: { index?: Pick<RfcIndex, 'entries'>; batchNumbers?: Set<number> } = {},
): string[] {
  const p: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['item is not an object'];
  // Shape is verified key by key below, so the fields are read as unknown-typed.
  const it = raw as { [K in keyof DraftItem]: unknown };
  for (const k of Object.keys(it)) if (!ITEM_KEYS.includes(k)) p.push(`unexpected key '${k}'`);
  for (const k of ITEM_KEYS) if (!(k in it)) p.push(`missing key '${k}'`);
  if (p.length) return p;
  if (typeof it.number !== 'number' || !Number.isInteger(it.number)) return ['number is not an integer'];
  if (batchNumbers && !batchNumbers.has(it.number)) p.push('number is not in this batch');
  if (index && !index.entries.has(it.number)) p.push('number is not an issued RFC');

  if (it.shortTitle !== null) {
    if (typeof it.shortTitle !== 'string' || !it.shortTitle.trim()) p.push('shortTitle must be a non-empty string or null');
    else if (it.shortTitle.length > LIMITS.shortTitle) p.push(`shortTitle longer than ${LIMITS.shortTitle} chars`);
    else if (/[<>]/.test(it.shortTitle) || it.shortTitle !== it.shortTitle.trim()) p.push('shortTitle must be plain trimmed text');
  }
  if (typeof it.category !== 'string' || !CATEGORY_KEYS.has(it.category)) p.push(`invalid category '${it.category}'`);

  const s = checkHtml(it.summary, LIMITS.summaryParas);
  if (s.error) p.push(`summary: ${s.error}`);
  else if (wordCount(it.summary as string) > LIMITS.summaryWords)
    p.push(`summary: ${wordCount(it.summary as string)} words (max ${LIMITS.summaryWords})`);
  const e = checkHtml(it.eli5, 1);
  if (e.error) p.push(`eli5: ${e.error}`);
  else if (wordCount(it.eli5 as string) > LIMITS.eli5Words) p.push(`eli5: ${wordCount(it.eli5 as string)} words (max ${LIMITS.eli5Words})`);

  if (!Array.isArray(it.questions) || it.questions.length < 1 || it.questions.length > LIMITS.maxQuestions)
    p.push('questions must be an array of 1-3 strings');
  else {
    for (const q of it.questions) {
      if (typeof q !== 'string' || !q.trim()) p.push('question must be a non-empty string');
      else if (q.includes('?')) p.push(`question contains '?': ${q}`);
      else if (q !== q.toLowerCase()) p.push(`question not lowercase: ${q}`);
      else if (q !== q.trim() || /[<>]/.test(q)) p.push(`question must be plain trimmed text: ${q}`);
    }
  }
  if (index) {
    for (const field of ['summary', 'eli5'] as const) {
      const text = it[field];
      if (typeof text !== 'string') continue;
      for (const n of rfcMentions(text)) if (!index.entries.has(n)) p.push(`${field}: RFC ${n} is not an issued RFC`);
    }
  }
  return p;
}

// Callers say what shape the file should have; it is validated (or tolerated) where it is used.
function readJson<T = unknown>(file: string, fallback?: T): T {
  if (!fs.existsSync(file)) return fallback as T;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}
const stringify = (o: unknown): string => `${JSON.stringify(o, null, 2)}\n`;
function writeIfChanged(file: string, text: string): boolean {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  return true;
}
/** Atomic exclusive create: write a temp file, then hard-link it into place (fails with EEXIST if
 *  the target appeared meanwhile, and readers never see a partial file). */
function createExclusive(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, text, { flag: 'wx' });
  try {
    fs.linkSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Load and validate all parts of one batch. */
function loadBatch(workDir: string, name: string, input: InputItem[], index: Pick<RfcIndex, 'entries'>) {
  const batchNumbers = new Set(input.map((x) => x.number));
  const outDir = path.join(workDir, 'out');
  const maxK = Math.ceil(input.length / PART_SIZE);
  const re = new RegExp(`^batch-${name}\\.part-(\\d+)\\.json$`);
  const partFiles = fs.existsSync(outDir)
    ? fs
        .readdirSync(outDir)
        .filter((f) => f.startsWith(`batch-${name}.part-`))
        .sort()
    : [];
  const batchProblems: Reject[] = [];
  const valid: DraftItem[] = [];
  const rejects: Reject[] = [];
  const seen = new Set<number>();
  let parts = 0;
  for (const f of partFiles) {
    const m = re.exec(f);
    const k = m?.[1];
    if (!m || k === undefined || Number(k) < 1 || Number(k) > maxK || String(Number(k)) !== k) {
      batchProblems.push({ batch: name, part: f, number: null, problems: [`unexpected part file (expected part-1..part-${maxK})`] });
      continue;
    }
    parts++;
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'));
    } catch (e) {
      batchProblems.push({ batch: name, part: f, number: null, problems: [`invalid JSON: ${(e as Error).message}`] });
      continue;
    }
    if (!Array.isArray(data)) {
      batchProblems.push({ batch: name, part: f, number: null, problems: ['part is not a JSON array'] });
      continue;
    }
    if (data.length > PART_SIZE)
      batchProblems.push({ batch: name, part: f, number: null, problems: [`${data.length} items (max ${PART_SIZE} per part)`] });
    for (const it of data as Array<DraftItem | null>) {
      const problems = validateItem(it, { index, batchNumbers });
      const n = it && Number.isInteger(it.number) ? it.number : null;
      if (n !== null) {
        if (seen.has(n)) problems.push('duplicate number in batch output');
        seen.add(n);
      }
      if (problems.length) rejects.push({ batch: name, part: f, number: n, problems });
      else valid.push(it as DraftItem);
    }
  }
  return { batchNumbers, valid, rejects, batchProblems, parts, seen };
}

function mergeItem(contentDir: string, it: DraftItem, date: string): MergeResult {
  const file = path.join(contentDir, 'rfcs', `${it.number}.json`);
  const fresh: JsonObject = {
    shortTitle: it.shortTitle,
    category: it.category,
    summary: it.summary,
    eli5: { summary: it.eli5 },
    questions: it.questions,
    provenance: { source: 'llm-draft', model: MODEL, drafted: date, reviewedBy: null },
    updated: date,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!fs.existsSync(file)) {
      const out: JsonObject = { number: it.number, shortTitle: fresh.shortTitle, category: fresh.category, categoryReviewed: false };
      for (const k of ['summary', 'eli5', 'questions', 'provenance', 'updated']) out[k] = fresh[k];
      try {
        createExclusive(file, stringify(out));
        return { file, status: 'created', finalCategory: out.category };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue; // someone else created it: re-read and merge
        throw e;
      }
    }
    let cur: unknown;
    try {
      cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return { file, status: 'invalid', reason: `existing content file unreadable (${(e as Error).message})` };
    }
    if (!cur || typeof cur !== 'object' || Array.isArray(cur))
      return { file, status: 'invalid', reason: 'existing content file is not a JSON object' };
    // Any file with a 'sections' key has been (or is being) promoted to an explainer; never touch it.
    if ('sections' in cur) return { file, status: 'skipped' };
    const out: JsonObject = { ...(cur as JsonObject) };
    const fillsSummary = !('summary' in out);
    for (const k of ['shortTitle', 'category', 'summary', 'eli5', 'questions']) {
      if (!(k in out)) out[k] = fresh[k];
      else if (k === 'eli5' && out.eli5 && typeof out.eli5 === 'object' && !Array.isArray(out.eli5) && !('summary' in out.eli5))
        out.eli5 = { ...(out.eli5 as JsonObject), summary: it.eli5 };
    }
    // Only claim llm-draft provenance when this import actually supplied the summary.
    if (fillsSummary) for (const k of ['provenance', 'updated']) if (!(k in out)) out[k] = fresh[k];
    const changed = writeIfChanged(file, stringify(out));
    return { file, status: changed ? 'updated' : 'unchanged', finalCategory: out.category };
  }
  return { file, status: 'invalid', reason: 'could not create or merge (file kept appearing/changing)' };
}

export interface ImportOptions {
  workDir?: string | null;
  contentDir?: string | null;
  index: Pick<RfcIndex, 'entries' | 'notIssued' | 'max'>;
  date?: string | null;
  check?: string | null;
  lint?: boolean;
}
export interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  rejects: Reject[];
  skipped: number[];
  pending: string[];
  touched: string[];
  lintErrors: string[];
  lintWarnings: string[];
}
export interface CheckResult {
  ok: boolean;
  count: number;
  problems: string[];
}

export async function importSummaries(opts: ImportOptions & { check: string }): Promise<CheckResult>;
export async function importSummaries(opts: ImportOptions): Promise<ImportResult>;
export async function importSummaries(opts: ImportOptions): Promise<ImportResult | CheckResult> {
  const workDir = opts.workDir || path.join(ROOT, '.work', 'summaries');
  const contentDir = opts.contentDir || path.join(ROOT, 'content');
  const { index } = opts;
  const date = opts.date || today();
  const inDir = path.join(workDir, 'in');

  if (opts.check) {
    const name = String(opts.check).padStart(3, '0');
    const inFile = path.join(inDir, `batch-${name}.json`);
    if (!fs.existsSync(inFile)) return { ok: false, count: 0, problems: [`no input file ${inFile}`] };
    const input = readJson<InputItem[]>(inFile);
    const b = loadBatch(workDir, name, input, index);
    const problems: string[] = [];
    if (!b.parts && !b.batchProblems.length) problems.push(`no part files found for batch ${name}`);
    for (const r of [...b.batchProblems, ...b.rejects])
      problems.push(`${r.part || ''}${r.number !== null ? ` RFC ${r.number}` : ''}: ${r.problems.join('; ')}`.trim());
    const missing = [...b.batchNumbers].filter((n) => !b.seen.has(n)).sort((a, c) => a - c);
    if (missing.length)
      problems.push(`missing ${missing.length} RFC(s): ${missing.slice(0, 30).join(', ')}${missing.length > 30 ? ', …' : ''}`);
    return { ok: problems.length === 0, count: b.valid.length, problems };
  }

  const names = fs.existsSync(inDir)
    ? fs
        .readdirSync(inDir)
        .map((f) => /^batch-(\d+)\.json$/.exec(f)?.[1])
        .filter((x): x is string => x !== undefined)
        .sort()
    : [];
  const rejects: Reject[] = [];
  const skipped: number[] = [];
  const pending: string[] = [];
  const touched: string[] = [];
  const stats = { created: 0, updated: 0, unchanged: 0 };
  const changesFile = path.join(workDir, 'category-changes.json');
  const changes = new Map<number, CategoryChange>(readJson<CategoryChange[]>(changesFile, []).map((c) => [c.number, c]));
  const hasSummary = (n: number): boolean => {
    const f = path.join(contentDir, 'rfcs', `${n}.json`);
    if (!fs.existsSync(f)) return false;
    let c: { summary?: unknown } | null;
    try {
      c = readJson<{ summary?: unknown } | null>(f);
    } catch {
      return false;
    }
    return !!c && typeof c.summary === 'string' && c.summary.trim() !== '';
  };

  for (const name of names) {
    const input = readJson<InputItem[]>(path.join(inDir, `batch-${name}.json`));
    const guessed = new Map(input.map((x) => [x.number, x.guessedCategory] as const));
    const b = loadBatch(workDir, name, input, index);
    if (!b.parts && !b.batchProblems.length) {
      pending.push(name);
      continue;
    }
    rejects.push(...b.batchProblems, ...b.rejects);
    for (const n of [...b.batchNumbers].sort((a, c) => a - c)) {
      if (!b.seen.has(n) && !hasSummary(n)) rejects.push({ batch: name, part: null, number: n, problems: ['missing from batch output'] });
    }
    for (const it of b.valid) {
      const r = mergeItem(contentDir, it, date);
      if (r.status === 'invalid') {
        rejects.push({ batch: name, part: null, number: it.number, problems: [r.reason] });
        continue;
      }
      if (r.status === 'skipped') {
        skipped.push(it.number);
        continue;
      }
      stats[r.status]++;
      if (r.status === 'created' || r.status === 'updated') touched.push(r.file);
      if (it.category !== guessed.get(it.number)) {
        changes.set(it.number, {
          number: it.number,
          batch: name,
          guessed: guessed.get(it.number),
          chosen: it.category,
          final: r.finalCategory,
        });
      }
    }
  }

  fs.mkdirSync(workDir, { recursive: true });
  writeIfChanged(path.join(workDir, 'rejects.json'), stringify(rejects));
  writeIfChanged(changesFile, stringify([...changes.values()].sort((a, c) => a.number - c.number)));

  const result: ImportResult = { ...stats, rejects, skipped, pending, touched, lintErrors: [], lintWarnings: [] };
  if (opts.lint && touched.length) {
    const r = lint(contentDir, index, { only: touched });
    result.lintErrors = r.errors;
    result.lintWarnings = r.warnings;
  }
  return result;
}

async function main(argv: string[]): Promise<number> {
  const opts: Required<Omit<ImportOptions, 'index'>> = { check: null, lint: false, date: null, workDir: null, contentDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = argv[++i] ?? null;
    else if (a === '--date') opts.date = argv[++i] ?? null;
    else if (a === '--lint') opts.lint = true;
    else if (a === '--work') opts.workDir = path.resolve(argv[++i] || '');
    else if (a === '--content') opts.contentDir = path.resolve(argv[++i] || '');
    else {
      console.error(`unknown argument: ${a}`);
      return 2;
    }
  }
  if (opts.check !== null && !/^\d+$/.test(opts.check || '')) {
    console.error('--check needs a batch number');
    return 2;
  }
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    console.error('--date must be YYYY-MM-DD');
    return 2;
  }
  const index = loadIndex();
  if (opts.check) {
    const r = await importSummaries({ ...opts, check: opts.check, index });
    if (r.ok) {
      console.log(`ok ${r.count}`);
      return 0;
    }
    for (const p of r.problems) console.log(p);
    console.log(`${r.problems.length} problem(s)`);
    return 1;
  }
  const r = await importSummaries({ ...opts, index });
  console.log(
    `created ${r.created}, updated ${r.updated}, unchanged ${r.unchanged}, skipped(sections) ${r.skipped.length}, rejects ${r.rejects.length}, pending batches ${r.pending.length}`,
  );
  if (r.rejects.length) console.log('rejects written to .work/summaries/rejects.json');
  if (opts.lint) {
    for (const w of r.lintWarnings) console.log(`warning: ${w}`);
    for (const e of r.lintErrors) console.log(`error: ${e}`);
    console.log(`lint: ${r.lintErrors.length} error(s), ${r.lintWarnings.length} warning(s)`);
    if (r.lintErrors.length) return 1;
  }
  return 0;
}

if (/(^|[\\/])import-summaries\.ts$/.test(process.argv[1] || '')) {
  main(process.argv.slice(2)).then(
    (c) => process.exit(c),
    (e) => {
      console.error(e);
      process.exit(2);
    },
  );
}
