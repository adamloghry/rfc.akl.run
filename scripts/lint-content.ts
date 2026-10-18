/**
 * Content linter. CLI: node --import tsx scripts/lint-content.ts [--update-lock] [--only <file>...]
 * Structural checks use the same Zod schemas as the content collections (src/lib/schemas.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateViz } from '../src/components/viz/validate';
import { loadIndex } from '../src/lib/rfc-index';
import { walkStrings } from '../src/lib/sanitize-check';
import { type GlossaryDoc, glossarySchema, type JourneyDoc, journeySchema, type RfcDoc, rfcSchema } from '../src/lib/schemas';

const ROOT = process.cwd();
const RESERVED_SLUGS = new Set([
  'atlas',
  'journeys',
  'areas',
  'glossary',
  'coverage',
  'contribute',
  'graph',
  'about',
  'search',
  'data',
  'assets',
  'feed',
  'sitemap',
  'robots',
  '404',
  'index',
]);
const KINDS = ['rfcs', 'journeys', 'glossary'] as const;
type Kind = (typeof KINDS)[number];
const SCHEMAS = { rfcs: rfcSchema, journeys: journeySchema, glossary: glossarySchema } as const;

type Normalized = { issued: Set<number>; notIssued: Set<number>; max: number };
export type IndexLike = { entries?: Map<number, unknown>; issued?: number[]; notIssued?: Iterable<number>; max: number };
export interface LintResult {
  errors: string[];
  warnings: string[];
}

/**
 * Viz render check. Errors are reported as `<file>: /viz/<i>: <message>`. The Container API needs Vite, so the
 * checker is the pure per-type validator shared with Viz.astro (src/components/viz/validate.ts).
 */
export const vizChecks: Array<(spec: unknown, stub: { number: number; content: RfcDoc; url: string }) => string | null> = [
  (spec) => validateViz(spec),
];

/** Parses a JSON file; the shape is checked by the caller (schemas) or trusted (our own lock/summary files). */
function readJson<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Accepts a parsed index ({entries, notIssued: Set, max}) or the cached summary ({issued: [], notIssued: [], max}). */
function normalizeIndex(index: IndexLike): Normalized {
  const issued = index.entries ? new Set(index.entries.keys()) : new Set(index.issued);
  return { issued, notIssued: new Set(index.notIssued || []), max: index.max };
}

function lintContent(label: string, data: unknown, ctx: { max: number; errors: string[] }, kind: Kind) {
  const { max, errors } = ctx;
  // HTML safety is also enforced by the Zod schemas; this covers the journeys kind and keeps messages uniform.
  if (kind !== 'journeys') {
    // (already reported by the schema pass)
  }
  walkStrings(data, (s, ptr) => {
    const hrefRe = /href\s*=\s*(["'])(.*?)\1/gi;
    for (const m of s.matchAll(hrefRe)) {
      const href = m[2] ?? '';
      if (/^#rfc\d+/i.test(href)) errors.push(`${label}: ${ptr} legacy link ${href} (use /rfc<n>)`);
      if (/^\/\d+(?:[/#?]|$)/.test(href)) errors.push(`${label}: ${ptr} old-style RFC link ${href} (use /rfc<n>, no trailing slash)`);
      else if (/^\/.*\/(?:[#?].*)?$/.test(href) && !/^\/(?:[#?].*)?$/.test(href))
        errors.push(`${label}: ${ptr} internal link ${href} has a trailing slash (the site has none)`);
      const n = /^\/rfc(\d+)(?:[#?].*)?$/.exec(href);
      if (n && (Number(n[1]) < 1 || Number(n[1]) > max)) errors.push(`${label}: ${ptr} internal link ${href} is outside 1..${max}`);
    }
  });
}

export function lint(contentDir: string, index: IndexLike, opts: { updateLock?: boolean; only?: string[] | null } = {}): LintResult {
  const { updateLock = false, only = null } = opts;
  const idx = normalizeIndex(index);
  const errors: string[] = [];
  const warnings: string[] = [];
  const ctx = { max: idx.max, errors };

  // Collect files to lint.
  const files: { kind: Kind; file: string }[] = [];
  if (only) {
    for (const f of only) {
      const abs = path.resolve(f);
      const kind = path.basename(path.dirname(abs)) as Kind;
      if (!KINDS.includes(kind)) {
        errors.push(`${f}: not under rfcs/, journeys/ or glossary/`);
        continue;
      }
      files.push({ kind, file: abs });
    }
  } else {
    for (const kind of KINDS) {
      const dir = path.join(contentDir, kind);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs
        .readdirSync(dir)
        .filter((x) => x.endsWith('.json'))
        .sort())
        files.push({ kind, file: path.join(dir, f) });
    }
  }

  // Glossary ids available for reference checks.
  const glossaryIds = new Set<string>();
  const gdir = path.join(contentDir, 'glossary');
  if (fs.existsSync(gdir)) for (const f of fs.readdirSync(gdir)) if (f.endsWith('.json')) glossaryIds.add(f.slice(0, -5));
  if (only) {
    const wdir = path.join(contentDir, '..', '.work', 'glossary');
    if (fs.existsSync(wdir)) for (const f of fs.readdirSync(wdir)) if (f.endsWith('.json')) glossaryIds.add(f.slice(0, -5));
  }

  const lockFile = path.join(contentDir, 'section-ids.lock.json');
  const lock: Record<string, string[]> = fs.existsSync(lockFile) ? readJson<Record<string, string[]>>(lockFile) : {};
  const newLock = { ...lock };
  const slugs = new Map<string, number>();
  const seenRfcFiles = new Set<number>();

  for (const { kind, file } of files) {
    const label = path.basename(file);
    let data: unknown;
    try {
      data = readJson(file);
    } catch (e) {
      errors.push(`${label}: invalid JSON: ${(e as Error).message}`);
      continue;
    }
    const parsed = SCHEMAS[kind].safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const extra = issue.code === 'unrecognized_keys' ? ` ${issue.keys.map((k) => `'${k}'`).join(', ')}` : '';
        errors.push(`${label}: /${issue.path.join('/')} ${issue.message}${extra}`);
      }
      continue; // later checks assume a valid shape
    }
    lintContent(label, data, ctx, kind);

    // safeParse succeeded above, so the document has the schema's shape.
    if (kind === 'rfcs')
      lintRfc({
        label,
        file,
        data: data as RfcDoc,
        idx,
        glossaryIds,
        lock,
        newLock,
        slugs,
        seenRfcFiles,
        errors,
        warnings,
        only,
        updateLock,
      });
    else if (kind === 'journeys') lintJourney({ label, file, data: data as JourneyDoc, idx, errors });
    else lintGlossary({ label, file, data: data as GlossaryDoc, idx, errors, warnings });
  }

  if (!only) {
    for (const n of Object.keys(lock)) {
      if (!seenRfcFiles.has(Number(n))) errors.push(`permalink break: ${n} (content file removed)`);
    }
  }

  if (updateLock) {
    const sorted: Record<string, string[]> = {};
    for (const k of Object.keys(newLock).sort((a, b) => Number(a) - Number(b))) sorted[k] = newLock[k] ?? [];
    const text = `${JSON.stringify(sorted, null, 2)}\n`;
    if (!fs.existsSync(lockFile) || fs.readFileSync(lockFile, 'utf8') !== text) fs.writeFileSync(lockFile, text);
  }
  return { errors, warnings };
}

interface LintCtx {
  label: string;
  file: string;
  idx: Normalized;
  errors: string[];
  warnings: string[];
}

function lintRfc(
  a: LintCtx & {
    data: RfcDoc;
    glossaryIds: Set<string>;
    lock: Record<string, string[]>;
    newLock: Record<string, string[]>;
    slugs: Map<string, number>;
    seenRfcFiles: Set<number>;
    only: string[] | null;
    updateLock: boolean;
  },
) {
  const { label, file, data, idx, glossaryIds, lock, newLock, slugs, seenRfcFiles, errors, warnings, only, updateLock } = a;
  const n = data.number;
  seenRfcFiles.add(n);
  const expected = `${n}.json`;
  if (/^0\d*\.json$/.test(path.basename(file)))
    errors.push(`${label}: zero-padded filename; use the plain number (expected ${expected}, e.g. content/rfcs/903.json, not 0903.json)`);
  else if (path.basename(file) !== expected) errors.push(`${label}: number ${n} does not match filename (expected ${expected})`);
  if (!idx.issued.has(n)) {
    errors.push(`${label}: RFC ${n} is ${idx.notIssued.has(n) ? 'Not Issued' : 'not in the RFC index'}`);
  }

  if (data.slug) {
    if (/^\d+$/.test(data.slug) || RESERVED_SLUGS.has(data.slug))
      errors.push(`${label}: slug '${data.slug}' collides with a number or top-level page`);
    else if (!only) {
      if (slugs.has(data.slug)) errors.push(`${label}: slug '${data.slug}' duplicates RFC ${slugs.get(data.slug)}`);
      slugs.set(data.slug, n);
    }
  }

  // Machine-drafted explainers reference glossary terms whose definitions are merged in one pass at the
  // end of a generation run (scripts/explain/glossary-finalize.ts); until then the page hides unknown chips,
  // so for llm-draft files an unknown id is a warning rather than an error.
  const draft = data.provenance?.source === 'llm-draft';
  for (const id of data.glossary || []) {
    if (!glossaryIds.has(id)) (draft ? warnings : errors).push(`${label}: unknown glossary id '${id}'`);
  }
  if (data.lineage) {
    for (const r of data.lineage.rfcs) if (!idx.issued.has(r)) warnings.push(`${label}: lineage RFC ${r} is not issued`);
  }
  for (const [i, r] of (data.references || []).entries()) {
    if (r.rfc && !idx.issued.has(r.rfc)) warnings.push(`${label}: /references/${i}/rfc ${r.rfc} is not an issued RFC`);
  }

  // Section ids: unique, viz anchors, permalink lock.
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const [i, s] of (data.sections || []).entries()) {
    if (seen.has(s.id)) errors.push(`${label}: /sections/${i}/id duplicate section id '${s.id}'`);
    seen.add(s.id);
    ids.push(s.id);
  }
  if (ids.length) {
    for (const [i, v] of (data.viz || []).entries()) {
      if (v.anchor && !seen.has(v.anchor)) warnings.push(`${label}: /viz/${i}/anchor '${v.anchor}' matches no section`);
    }
  }
  const locked: string[] = lock[String(n)] || [];
  for (const id of locked) if (!seen.has(id)) errors.push(`permalink break: ${n}#${id}`);
  // Scoped lock: machine-generated explainers that aren't locked yet take their section ids from a fixed
  // vocabulary (scripts/explain/SPEC.md), so regeneration reproduces them; locking ~55k such ids would only
  // bloat the lock file. Ids that are already locked stay enforced above.
  const generated = draft && locked.length === 0;
  const fresh = generated ? [] : ids.filter((id) => !locked.includes(id));
  if (!updateLock) for (const id of fresh) warnings.push(`new section id ${n}#${id} (run with --update-lock to accept)`);
  if (locked.length || fresh.length) newLock[String(n)] = [...locked, ...fresh];

  // A malformed viz must be reported here, not as a TypeError (with no file name) mid-build.
  if (vizChecks.length) {
    const stub = { number: n, content: data, url: `/rfc${n}` };
    for (const [i, v] of (data.viz || []).entries()) {
      for (const check of vizChecks) {
        const msg = check(v, stub);
        if (msg) errors.push(`${label}: /viz/${i}: ${msg}`);
      }
    }
  }

  const hasSummary = typeof data.summary === 'string' && data.summary.trim();
  if ((hasSummary || ids.length) && !data.plainLanguage?.summary) {
    warnings.push(`${label}: missing plainLanguage.summary`);
  }
}

function lintJourney({ label, file, data, idx, errors }: Omit<LintCtx, 'warnings'> & { data: JourneyDoc }) {
  if (path.basename(file) !== `${data.slug}.json`) errors.push(`${label}: slug '${data.slug}' does not match filename`);
  data.steps.forEach((step, i) => {
    step.rfcs.forEach((r, j) => {
      if (!idx.issued.has(r.number)) errors.push(`${label}: /steps/${i}/rfcs/${j} RFC ${r.number} is not an issued RFC`);
    });
  });
}

function lintGlossary({ label, file, data, idx, errors, warnings }: LintCtx & { data: GlossaryDoc }) {
  if (path.basename(file) !== `${data.id}.json`) errors.push(`${label}: id '${data.id}' does not match filename`);
  for (const r of data.rfcs || []) if (!idx.issued.has(r)) warnings.push(`${label}: RFC ${r} is not an issued RFC`);
}

// ---- CLI ----

/** Loads the cached index summary if it is at least as new as the XML, else null. */
function readFreshSummary(cacheDir: string): IndexLike | null {
  const sum = path.join(cacheDir, 'index-summary.json');
  if (!fs.existsSync(sum)) return null;
  const xml = path.join(cacheDir, 'rfc-index.xml');
  if (fs.existsSync(xml) && fs.statSync(xml).mtimeMs > fs.statSync(sum).mtimeMs) return null;
  try {
    return readJson<IndexLike>(sum);
  } catch {
    return null;
  }
}

function writeSummary(cacheDir: string, index: { max: number; entries: Map<number, unknown>; notIssued: Set<number> }) {
  const summary = {
    max: index.max,
    issued: [...index.entries.keys()].sort((a, b) => a - b),
    notIssued: [...index.notIssued].sort((a, b) => a - b),
  };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'index-summary.json'), JSON.stringify(summary));
  return summary;
}

async function main(argv: string[]): Promise<number> {
  const args: { updateLock: boolean; only: string[] | null } = { updateLock: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update-lock') args.updateLock = true;
    else if (a === '--only') args.only = [];
    else if (args.only && !a.startsWith('--')) args.only.push(a);
    else {
      console.error(`unknown argument: ${a}`);
      return 2;
    }
  }
  if (args.only && !args.only.length) {
    console.error('--only needs at least one file');
    return 2;
  }

  const cacheDir = path.join(ROOT, '.cache');
  let index = args.only ? readFreshSummary(cacheDir) : null;
  if (!index) {
    const loaded = loadIndex();
    index = writeSummary(cacheDir, loaded);
  }

  const { errors, warnings } = lint(path.join(ROOT, 'content'), index, { updateLock: args.updateLock, only: args.only });
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(`lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
  return errors.length ? 1 : 0;
}

if (/(^|[\\/])lint-content\.ts$/.test(process.argv[1] || '')) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e);
      process.exit(2);
    },
  );
}
