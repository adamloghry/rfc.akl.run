/**
 * Validates generated explainer outputs (.work/explain/out/<n>.json). Agents run this themselves and fix errors until it prints `ok <n>`.
 *
 * Layers: strict output shape -> the site's Zod schema on the output merged with the existing content file (HTML sanitizer included)
 * -> validateViz and strict viz shapes -> section ids -> links and references -> glossary -> tier depth.
 * Structural only: nothing here judges whether the content is true.
 *
 * CLI: node --import tsx scripts/explain/validate.ts <n...>
 */
import fs from 'node:fs';
import path from 'node:path';
import { isVizType, validateViz } from '../../src/components/viz/validate';
import { checkRetiredFraming, retiredFramingMessage } from '../../src/lib/plain-language';
import { walkStrings } from '../../src/lib/sanitize-check';
import { glossarySchema, rfcSchema } from '../../src/lib/schemas';
import { applyOutput, OUTPUT_KEYS, REQUIRED_KEYS } from './apply';
import {
  aprilFools,
  type Content,
  defaultPaths,
  type IndexSummary,
  isMain,
  loadSummary,
  outFile,
  type Paths,
  parseNumbers,
  readContent,
  SECTION_BOUNDS,
  type TierName,
  tierOf,
  VIZ_MAX,
} from './lib';
import { each } from './util';
import { GENERATED_VIZ_TYPES, strictVizData } from './vizshape';
import { GLOSSARY_ID, isSectionId, MAX_GLOSSARY_IDS, MAX_NEW_TERMS, MAX_QUESTIONS, SECTION_IDS } from './vocab';

export interface Env {
  paths: Paths;
  summary: IndexSummary;
  issued: Set<number>;
  glossaryIds: Set<string>;
  april: Set<number>;
  /** fixed date for the in-memory merge (tests) */
  today?: string;
}

export function loadEnv(paths: Paths = defaultPaths(), summary: IndexSummary = loadSummary(paths)): Env {
  const glossaryIds = new Set<string>();
  if (fs.existsSync(paths.glossaryContentDir))
    for (const f of fs.readdirSync(paths.glossaryContentDir)) if (f.endsWith('.json')) glossaryIds.add(f.slice(0, -5));
  return { paths, summary, issued: new Set(summary.issued), glossaryIds, april: aprilFools(paths) };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const MARKDOWN = /\*\*[^*]+\*\*|^#{1,6}\s|```|^\s*[-*]\s+\S/m;
const INTERNAL_LINK = /^\/rfc(\d+)(?:#[\w-]+)?$/;

class Errors {
  list: string[] = [];
  add(where: string, msg: string) {
    this.list.push(where ? `${where}: ${msg}` : msg);
  }
}

function plainText(v: unknown, where: string, err: Errors, min: number, max: number) {
  if (!nonEmpty(v)) return err.add(where, 'must be a non-empty string');
  if (v.length < min) err.add(where, `is too short (${v.length} chars, min ${min})`);
  if (v.length > max) err.add(where, `is too long (${v.length} chars, max ${max})`);
  if (/<\/?[a-zA-Z]/.test(v)) err.add(where, 'is plain text: remove HTML tags (it is escaped on the page)');
}

function htmlText(v: unknown, where: string, err: Errors, min: number, max: number, env: Env, sectionIds: Set<string>) {
  if (!nonEmpty(v)) return err.add(where, 'must be a non-empty HTML string');
  if (v.length < min) err.add(where, `is too short (${v.length} chars, min ${min})`);
  if (v.length > max) err.add(where, `is too long (${v.length} chars, max ${max})`);
  if (!/<p[\s>]/.test(v)) err.add(where, 'must be HTML: wrap paragraphs in <p>...</p>');
  if (MARKDOWN.test(v.replace(/<[^>]*>/g, '\n')))
    err.add(where, 'contains Markdown (**bold**, # headings, ``` fences or - bullets): use HTML tags');
  for (const m of v.matchAll(/href\s*=\s*(["'])(.*?)\1/gi)) {
    const href = m[2] ?? '';
    const n = href.match(INTERNAL_LINK);
    if (n) {
      if (n[1].startsWith('0')) err.add(where, `link ${href} is zero-padded: use /rfc${Number(n[1])}`);
      else if (!env.issued.has(Number(n[1]))) err.add(where, `link ${href} is not an issued RFC: remove the link`);
    } else if (href.startsWith('#')) {
      if (!sectionIds.has(href.slice(1))) err.add(where, `link ${href} matches no section id`);
    } else err.add(where, `link ${href} is not allowed: link only to other RFCs as /rfc<number> (no external URLs)`);
  }
  mentions(v, where, err, env);
}

/** "RFC 0903" is zero-padded; "RFC 99999" cannot exist. */
function mentions(v: string, where: string, err: Errors, env: Env) {
  for (const m of v.matchAll(/\bRFCs?[\s ]*(0\d+|\d+)/g)) {
    const raw = m[1];
    if (raw.startsWith('0')) err.add(where, `"${m[0]}" is zero-padded: write RFC ${Number(raw)}`);
    else if (Number(raw) > env.summary.max) err.add(where, `"${m[0]}" is beyond the newest RFC (${env.summary.max}): remove or fix it`);
  }
}

function checkKeys(out: Obj, err: Errors) {
  for (const k of Object.keys(out)) {
    if (!(OUTPUT_KEYS as readonly string[]).includes(k)) {
      const hint = [
        'provenance',
        'status',
        'date',
        'obsoletes',
        'obsoletedBy',
        'lineage',
        'hero',
        'implementations',
        'number',
        'updated',
      ].includes(k)
        ? ' (the merge sets this; remove it)'
        : '';
      err.add('', `unexpected top-level key "${k}"${hint}; allowed keys: ${OUTPUT_KEYS.join(', ')}`);
    }
  }
  for (const k of REQUIRED_KEYS) if (out[k] === undefined) err.add('', `missing required key "${k}"`);
}

function checkSections(out: Obj, tier: TierName, env: Env, err: Errors): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(out.sections)) {
    if (out.sections !== undefined) err.add('sections', 'must be an array');
    return ids;
  }
  const [min, max] = SECTION_BOUNDS[tier];
  if (out.sections.length < min || out.sections.length > max)
    err.add('sections', `a ${tier} RFC needs ${min} to ${max} sections (has ${out.sections.length})`);
  // First pass: ids, so links and viz anchors can point at any section.
  for (const s of out.sections) if (isObj(s) && typeof s.id === 'string') ids.add(s.id);
  const seen = new Set<string>();
  each(out.sections, (s, i) => {
    const p = `sections[${i}]`;
    if (!isObj(s)) return err.add(p, 'must be an object');
    for (const k of Object.keys(s))
      if (!['id', 'number', 'title', 'content', 'plainLanguage'].includes(k))
        err.add(p, `unexpected key "${k}" (allowed: id, number, title, content, plainLanguage)`);
    if (typeof s.id !== 'string' || !isSectionId(s.id))
      err.add(
        `${p}.id`,
        `${JSON.stringify(s.id)} is not in the section-id vocabulary; use one of ${SECTION_IDS.join(', ')}, or section-<k> (k = 1, 2, ...)`,
      );
    else if (seen.has(s.id)) err.add(`${p}.id`, `duplicate section id "${s.id}"`);
    else seen.add(s.id);
    if (!(typeof s.number === 'string' && /^\d+(\.\d+)*$/.test(s.number)))
      err.add(`${p}.number`, 'must be a string such as "1" or "2" (the RFC\'s own section number when there is one, else a running count)');
    plainText(s.title, `${p}.title`, err, 3, 90);
    htmlText(s.content, `${p}.content`, err, 100, 9000, env, ids);
    htmlText(s.plainLanguage, `${p}.plainLanguage`, err, 20, 800, env, ids);
  });
  return ids;
}

function checkViz(out: Obj, tier: TierName, sectionIds: Set<string>, env: Env, err: Errors) {
  if (out.viz === undefined) return;
  if (!Array.isArray(out.viz)) return err.add('viz', 'must be an array (use [] for none)');
  if (out.viz.length > VIZ_MAX[tier]) err.add('viz', `a ${tier} RFC may have at most ${VIZ_MAX[tier]} viz (has ${out.viz.length})`);
  each(out.viz, (v, i) => {
    const p = `viz[${i}]`;
    if (!isObj(v)) return err.add(p, 'must be an object');
    for (const k of Object.keys(v))
      if (!['type', 'anchor', 'position', 'caption', 'data', 'id'].includes(k))
        err.add(p, `unexpected key "${k}" (allowed: type, anchor, position, caption, data; put type-specific fields inside "data")`);
    if (v.type === 'sequence-sim') return err.add(`${p}.type`, '"sequence-sim" is not allowed; use "sequence"');
    if (typeof v.type !== 'string' || !isVizType(v.type) || !GENERATED_VIZ_TYPES.includes(v.type as never))
      return err.add(`${p}.type`, `${JSON.stringify(v.type)} is not allowed; use one of ${GENERATED_VIZ_TYPES.join(', ')}`);
    if (typeof v.anchor !== 'string' || !sectionIds.has(v.anchor))
      err.add(`${p}.anchor`, `${JSON.stringify(v.anchor)} is not one of your section ids (${[...sectionIds].join(', ')})`);
    if (v.position !== undefined && v.position !== 'before' && v.position !== 'after')
      err.add(`${p}.position`, 'must be "before" or "after"');
    plainText(v.caption, `${p}.caption`, err, 3, 100);
    if (!isObj(v.data)) return err.add(`${p}.data`, 'must be an object holding the type-specific fields');
    const shape = strictVizData(v.type, v.data, `${p}.data`, (n) => env.issued.has(n));
    for (const m of shape) err.add('', m);
    if (!shape.length) {
      const msg = validateViz(v);
      if (msg) err.add(p, `would not render: ${msg}`);
    }
    if (v.type !== 'code') {
      walk(v.data, `${p}.data`, (s, w) => {
        if (/<\/?[a-zA-Z]/.test(s)) err.add(w, 'is plain text: remove HTML tags');
        mentions(s, w, err, env);
      });
    }
  });
}

function walk(v: unknown, where: string, fn: (s: string, where: string) => void) {
  if (typeof v === 'string') fn(v, where);
  else if (Array.isArray(v)) each(v, (x, i) => walk(x, `${where}[${i}]`, fn));
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`, fn);
}

function checkSmall(out: Obj, env: Env, sectionIds: Set<string>, err: Errors) {
  if (out.shortTitle !== undefined && out.shortTitle !== null) plainText(out.shortTitle, 'shortTitle', err, 1, 28);
  if (out.subtitle !== undefined) plainText(out.subtitle, 'subtitle', err, 10, 160);
  if (out.tags !== undefined) {
    if (!Array.isArray(out.tags) || out.tags.length < 1 || out.tags.length > 4) err.add('tags', 'must be 1 to 4 short strings');
    else each(out.tags, (t, i) => plainText(t, `tags[${i}]`, err, 2, 28));
  }

  if (out.tldr !== undefined) {
    if (!isObj(out.tldr)) err.add('tldr', 'must be an object {problem, mechanism, outcome, outcomeLabel}');
    else {
      for (const k of Object.keys(out.tldr))
        if (!['problem', 'mechanism', 'outcome', 'outcomeLabel'].includes(k)) err.add('tldr', `unexpected key "${k}"`);
      for (const k of ['problem', 'mechanism', 'outcome']) plainText(out.tldr[k], `tldr.${k}`, err, 20, 500);
      plainText(out.tldr.outcomeLabel, 'tldr.outcomeLabel', err, 3, 32);
    }
  }
  // Required: the output's plainLanguage.summary replaces the content file's (see apply.ts).
  if (!isObj(out.plainLanguage)) err.add('plainLanguage', 'must be an object {summary}');
  else {
    for (const k of Object.keys(out.plainLanguage)) if (k !== 'summary') err.add('plainLanguage', `unexpected key "${k}" (only "summary")`);
    htmlText(out.plainLanguage.summary, 'plainLanguage.summary', err, 20, 800, env, sectionIds);
  }
  if (out.today !== undefined) htmlText(out.today, 'today', err, 40, 2500, env, sectionIds);

  if (out.facts !== undefined) {
    if (!Array.isArray(out.facts) || out.facts.length > 6)
      err.add('facts', 'must be an array of at most 6 {label, value} (use [] for none)');
    else
      each(out.facts, (f, i) => {
        if (!isObj(f)) return err.add(`facts[${i}]`, 'must be an object {label, value}');
        for (const k of Object.keys(f)) if (k !== 'label' && k !== 'value') err.add(`facts[${i}]`, `unexpected key "${k}"`);
        plainText(f.label, `facts[${i}].label`, err, 1, 40);
        plainText(f.value, `facts[${i}].value`, err, 1, 120);
        if (typeof f.value === 'string') mentions(f.value, `facts[${i}].value`, err, env);
      });
  }

  if (out.references !== undefined) {
    if (!Array.isArray(out.references) || out.references.length > 20)
      err.add('references', 'must be an array of at most 20 (use [] for none)');
    else
      each(out.references, (r, i) => {
        const p = `references[${i}]`;
        if (!isObj(r)) return err.add(p, 'must be an object {number?, text, rfc?}');
        for (const k of Object.keys(r))
          if (!['number', 'text', 'rfc'].includes(k)) err.add(p, `unexpected key "${k}" (allowed: number, text, rfc)`);
        if (r.number !== undefined && typeof r.number !== 'string' && typeof r.number !== 'number')
          err.add(`${p}.number`, 'must be a string such as "[RFC793]"');
        plainText(r.text, `${p}.text`, err, 5, 400);
        if (typeof r.text === 'string') mentions(r.text, `${p}.text`, err, env);
        if (r.rfc !== undefined && !(typeof r.rfc === 'number' && env.issued.has(r.rfc)))
          err.add(
            `${p}.rfc`,
            `${JSON.stringify(r.rfc)} is not an issued RFC number (use a plain number such as 793, or omit "rfc" for non-RFC references)`,
          );
      });
  }

  if (out.questions !== undefined) {
    if (!Array.isArray(out.questions) || out.questions.length < 3 || out.questions.length > MAX_QUESTIONS)
      err.add('questions', `must be 3 to ${MAX_QUESTIONS} search-style questions`);
    else
      each(out.questions, (q, i) => {
        plainText(q, `questions[${i}]`, err, 6, 100);
        if (typeof q === 'string' && q.includes('?'))
          err.add(`questions[${i}]`, 'must not contain "?" (write "what is tcp", not "What is TCP?")');
      });
  }
}

function checkGlossary(n: number, out: Obj, env: Env, err: Errors) {
  const terms = Array.isArray(out.glossaryTerms) ? out.glossaryTerms : null;
  if (out.glossaryTerms !== undefined && !terms)
    err.add('glossaryTerms', 'must be an array of new terms (use [] when you only reuse existing ids)');
  if (out.glossary === undefined) return;
  if (!Array.isArray(out.glossary)) return err.add('glossary', 'must be an array of glossary ids (use [] for none)');
  if (out.glossary.length > MAX_GLOSSARY_IDS) err.add('glossary', `at most ${MAX_GLOSSARY_IDS} ids (has ${out.glossary.length})`);
  const newIds = new Set<string>();
  if (terms) {
    if (terms.length > MAX_NEW_TERMS)
      err.add('glossaryTerms', `at most ${MAX_NEW_TERMS} new terms (has ${terms.length}); reuse existing ids from content/glossary/`);
    each(terms, (t, i) => {
      const p = `glossaryTerms[${i}]`;
      if (!isObj(t)) return err.add(p, 'must be an object {id, term, definition, plainLanguage}');
      for (const k of Object.keys(t))
        if (!['id', 'term', 'definition', 'plainLanguage'].includes(k))
          err.add(p, `unexpected key "${k}" (allowed: id, term, definition, plainLanguage)`);
      if (typeof t.id !== 'string' || !GLOSSARY_ID.test(t.id) || t.id.length > 48)
        err.add(`${p}.id`, `${JSON.stringify(t.id)} must be kebab-case, lowercase, singular (for example "path-mtu")`);
      else {
        if (newIds.has(t.id)) err.add(`${p}.id`, `duplicate term id "${t.id}"`);
        newIds.add(t.id);
        if (env.glossaryIds.has(t.id) && !termListsRfc(env, t.id, n))
          err.add(`${p}.id`, `"${t.id}" already exists in content/glossary: remove it from glossaryTerms and keep the id in "glossary"`);
      }
      plainText(t.term, `${p}.term`, err, 1, 60);
      plainText(t.plainLanguage, `${p}.plainLanguage`, err, 10, 300);
      const parsed = glossarySchema.safeParse({
        id: t.id,
        term: t.term,
        definition: t.definition,
        plainLanguage: t.plainLanguage,
        rfcs: [n],
      });
      if (!parsed.success) for (const issue of parsed.error.issues) err.add(`${p}.${issue.path.join('.')}`, issue.message);
      if (typeof t.definition === 'string') {
        if (t.definition.length < 30 || t.definition.length > 700)
          err.add(`${p}.definition`, `length ${t.definition.length} is outside 30 to 700 chars`);
        if (!/<p[\s>]/.test(t.definition)) err.add(`${p}.definition`, 'must be HTML: wrap it in <p>...</p>');
      }
    });
  }
  const seen = new Set<string>();
  each(out.glossary, (id, i) => {
    if (typeof id !== 'string' || !GLOSSARY_ID.test(id)) return err.add(`glossary[${i}]`, `${JSON.stringify(id)} must be a kebab-case id`);
    if (seen.has(id)) err.add(`glossary[${i}]`, `duplicate id "${id}"`);
    seen.add(id);
    if (!env.glossaryIds.has(id) && !newIds.has(id))
      err.add(`glossary[${i}]`, `unknown id "${id}": reuse an id that exists in content/glossary/, or define it in glossaryTerms`);
  });
  for (const id of newIds)
    if (!seen.has(id)) err.add('glossary', `new term "${id}" is defined in glossaryTerms but not listed in glossary`);
}

/** After the glossary merge a new term exists on disk and lists its RFC; re-validating that RFC's output must still pass. */
function termListsRfc(env: Env, id: string, n: number): boolean {
  try {
    const t = JSON.parse(fs.readFileSync(path.join(env.paths.glossaryContentDir, `${id}.json`), 'utf8')) as { rfcs?: number[] };
    return (t.rfcs ?? []).includes(n);
  } catch {
    return false;
  }
}

const numberErrors = (l: string[]) => [...new Set(l)].map((m, i) => `${i + 1}. ${m}`);

/** A citation quotes the RFC's own bibliography, so it may name the old framing without the site adopting it. */
const CITATION_POINTER = /^\/references\/\d+\/text$/;
/** The reader-facing texts: only these may talk about who the text is written for. */
const AUDIENCE_POINTER = /^\/(?:plainLanguage(?:\/summary)?|sections\/\d+\/plainLanguage|glossaryTerms\/\d+\/plainLanguage)$/;

/**
 * The retired ELI5 framing must not come back: the explainers are ISO Plain Language (ISO 24495-1:2023) written for
 * an adult reader who does not work in networking (SPEC.md section 8).
 */
function checkFraming(out: Obj, err: Errors) {
  walkStrings(out, (s, ptr) => {
    if (CITATION_POINTER.test(ptr)) return;
    for (const found of checkRetiredFraming(s, AUDIENCE_POINTER.test(ptr))) err.add(ptr, retiredFramingMessage(found, found));
  });
}

/** All structural errors for one output (empty = valid). `raw` is the parsed JSON. */
export function validateOutput(n: number, raw: unknown, env: Env): string[] {
  const err = new Errors();
  if (!env.issued.has(n)) return [`1. RFC ${n} is not an issued RFC`];
  if (!isObj(raw)) return ['1. the file must contain one JSON object'];
  const tier = tierOf(n, env.summary, env.april);
  checkKeys(raw, err);
  checkFraming(raw, err);
  const sectionIds = checkSections(raw, tier, env, err);
  checkViz(raw, tier, sectionIds, env, err);
  checkSmall(raw, env, sectionIds, err);
  checkGlossary(n, raw, env, err);
  if (err.list.length) return numberErrors(err.list);

  // Shape is sound: run the site's own schema (Zod + HTML sanitizer) on the output merged into the content file.
  const content: Content = readContent(env.paths, n) ?? { number: n };
  const merged = applyOutput(content, raw, env.today ?? new Date().toISOString().slice(0, 10));
  const parsed = rfcSchema.safeParse(merged);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path
        .map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`))
        .join('')
        .replace(/^\./, '');
      const extra = issue.code === 'unrecognized_keys' ? ` ${issue.keys.map((k) => `'${k}'`).join(', ')}` : '';
      err.add(where, `${issue.message}${extra}`);
    }
  }
  return numberErrors(err.list);
}

export function validateFile(n: number, env: Env): string[] {
  const f = outFile(env.paths, n);
  if (!fs.existsSync(f)) return [`1. ${path.relative(env.paths.root, f)} does not exist`];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return [`1. invalid JSON: ${(e as Error).message}`];
  }
  return validateOutput(n, raw, env);
}

function main(argv: string[]): number {
  let nums: number[];
  try {
    nums = parseNumbers(argv);
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  if (!nums.length) {
    console.error('usage: node --import tsx scripts/explain/validate.ts <rfc number...>');
    return 2;
  }
  const env = loadEnv();
  let bad = 0;
  for (const n of nums) {
    const errors = validateFile(n, env);
    if (!errors.length) console.log(`ok ${n}`);
    else {
      bad++;
      console.log(`FAIL ${n}: ${errors.length} error(s) in .work/explain/out/${n}.json (tier ${tierOf(n, env.summary, env.april)})`);
      for (const e of errors.slice(0, 40)) console.log(`  ${e}`);
      if (errors.length > 40) console.log(`  ... and ${errors.length - 40} more`);
    }
  }
  return bad ? 1 : 0;
}

if (isMain(import.meta.filename)) process.exit(main(process.argv.slice(2)));
