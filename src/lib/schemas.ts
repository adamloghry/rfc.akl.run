/**
 * Zod schemas for content files. They define the content contract and are the
 * single source for the content collections (src/content.config.ts) and scripts/lint-content.ts.
 * Fields that templates insert with set:html are checked with sanitize-check in superRefine.
 */
import { z } from 'astro/zod';
import { checkContent } from './sanitize-check';

export const CATEGORY_KEYS = [
  'core',
  'dns',
  'http',
  'transport',
  'security',
  'email',
  'routing',
  'applications',
  'infrastructure',
  'data',
  'meta',
] as const;
export const VIZ_TYPES = [
  'packet',
  'sequence-sim',
  'sequence',
  'compare-table',
  'contrast',
  'key-grid',
  'layers',
  'timeline',
  'state-machine',
  'tree',
  'opcodes',
  'code',
] as const;

const slugRe = /^[a-z0-9][a-z0-9-]*$/;
const posInt = z.number().int().min(1);
const strOrNum = z.union([z.string(), z.number()]);

/** Content stores viz either nested ({type, data}) or flat (fields beside type); both pass through. */
const viz = z.looseObject({
  type: z.enum(VIZ_TYPES),
  id: z.string().optional(),
  caption: z.string().optional(),
  anchor: z.string().optional(),
  position: z.enum(['before', 'after']).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

const section = z.strictObject({
  id: z.string().regex(slugRe),
  number: strOrNum.optional(),
  title: z.string(),
  content: z.string(),
  eli5: z.string().optional(),
});

export const rfcSchema = z
  .looseObject({
    number: posInt,
    slug: z.string().regex(slugRe).optional(),
    title: z.string().min(1).optional(),
    shortTitle: z.string().nullable().optional(),
    authors: z.array(z.string()).optional(),
    organization: z.string().nullable().optional(),
    category: z.enum(CATEGORY_KEYS).optional(),
    categoryReviewed: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    subtitle: z.string().optional(),
    summary: z.string().optional(),
    eli5: z.looseObject({ summary: z.string().optional() }).optional(),
    questions: z.array(z.string().regex(/^[^?]*$/)).optional(),
    tldr: z
      .strictObject({
        problem: z.string().optional(),
        mechanism: z.string().optional(),
        outcome: z.string().optional(),
        outcomeLabel: z.string().optional(),
      })
      .optional(),
    facts: z.array(z.strictObject({ label: z.string(), value: z.string() })).optional(),
    lineage: z.strictObject({ title: z.string().optional(), rfcs: z.array(posInt) }).optional(),
    today: z.string().optional(),
    implementations: z.array(z.strictObject({ name: z.string(), url: z.string().optional(), note: z.string().optional() })).optional(),
    glossary: z.array(z.string()).optional(),
    journeys: z.array(z.string()).optional(),
    sections: z.array(section).optional(),
    viz: z.array(viz).optional(),
    references: z.array(z.strictObject({ number: strOrNum.optional(), text: z.string(), rfc: posInt.optional() })).optional(),
    hero: z.record(z.string(), z.any()).optional(),
    provenance: z
      .strictObject({
        source: z.enum(['human', 'llm-draft']),
        model: z.string().optional(),
        drafted: z.string().optional(),
        reviewedBy: z.string().nullable().optional(),
      })
      .optional(),
    updated: z.string().optional(),
    featured: z.boolean().optional(),
    date: z.string().optional(),
    status: z.string().optional(),
    obsoletes: z.any().optional(),
    obsoletedBy: z.any().optional(),
  })
  .superRefine((data, ctx) => htmlIssues(data, 'rfc', ctx));

export const glossarySchema = z
  .looseObject({
    id: z.string().regex(slugRe),
    term: z.string().min(1),
    definition: z.string(),
    eli5: z.string().optional(),
    rfcs: z.array(posInt).optional(),
  })
  .superRefine((data, ctx) => htmlIssues(data, 'glossary', ctx));

export const journeySchema = z.looseObject({
  slug: z.string().regex(slugRe),
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  steps: z
    .array(
      z.strictObject({
        title: z.string(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        rfcs: z.array(z.strictObject({ number: posInt, label: z.string().optional() })),
      }),
    )
    .min(1),
});

export type RfcDoc = z.infer<typeof rfcSchema>;
export type GlossaryDoc = z.infer<typeof glossarySchema>;
export type JourneyDoc = z.infer<typeof journeySchema>;

function htmlIssues(data: unknown, kind: 'rfc' | 'glossary', ctx: z.RefinementCtx) {
  for (const { ptr, problem } of checkContent(data, kind)) {
    ctx.addIssue({
      code: 'custom',
      path: ptr
        .split('/')
        .slice(1)
        .map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
      message: `unsafe HTML (${problem})`,
    });
  }
}
