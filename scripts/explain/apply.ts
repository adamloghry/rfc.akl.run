/** Applies a generated explainer output onto an existing content file (used by validate in memory, and by merge for real). */
import { type Content, MODEL, PROMPT_VERSION, SCHEMA_VERSION } from './lib';
import { MAX_QUESTIONS } from './vocab';

/** Exactly the keys an output file may contain. Everything else (provenance, status, dates, relations, hero, implementations, number) is the merge's or the index's. */
export const OUTPUT_KEYS = [
  'shortTitle',
  'subtitle',
  'tags',
  'tldr',
  'plainLanguage',
  'sections',
  'viz',
  'references',
  'facts',
  'today',
  'glossaryTerms',
  'glossary',
  'questions',
] as const;

export const REQUIRED_KEYS = OUTPUT_KEYS.filter((k) => k !== 'shortTitle');

const uniq = <T>(a: T[], key: (x: T) => string = String): T[] => {
  const seen = new Set<string>();
  return a.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function unionQuestions(existing: unknown, generated: unknown): string[] {
  const a = Array.isArray(existing) ? (existing as string[]) : [];
  const b = Array.isArray(generated) ? (generated as string[]) : [];
  return uniq([...a, ...b].map((q) => String(q).trim()).filter(Boolean), (q) => q.toLowerCase()).slice(0, MAX_QUESTIONS);
}

export function provenanceFor(drafted: string) {
  return {
    source: 'llm-draft' as const,
    model: MODEL,
    drafted,
    reviewedBy: null,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * Takes plainLanguage.summary from the output (falling back to the file's). Preserves summary, category (and everything else already in the file), shortTitle unless absent, and the
 * union of questions (existing first, deduped, at most 6). glossaryTerms is not stored here (merge writes it to .work/glossary).
 */
export function applyOutput(content: Content, out: Content, drafted: string): Content {
  const { provenance: _p, updated: _u, ...rest } = content;
  const next: Content = { ...rest };
  if (!next.shortTitle && out.shortTitle) next.shortTitle = out.shortTitle;
  next.tags = out.tags;
  next.subtitle = out.subtitle;
  next.plainLanguage = { ...(content.plainLanguage ?? {}), ...(out.plainLanguage ?? {}) };
  next.questions = unionQuestions(content.questions, out.questions);
  next.tldr = out.tldr;
  next.facts = out.facts;
  next.today = out.today;
  next.glossary = uniq([...(Array.isArray(content.glossary) ? content.glossary : []), ...(out.glossary ?? [])]);
  next.sections = out.sections;
  next.viz = out.viz;
  next.references = out.references;
  next.provenance = provenanceFor(drafted);
  next.updated = drafted;
  return next;
}
