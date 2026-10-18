/**
 * Applies valid outputs (.work/explain/out/<n>.json) to content/rfcs/<n>.json.
 *
 * - Skips any content file that already has non-empty `sections` (never overwrites an explainer).
 * - Preserves summary, eli5.summary, category, shortTitle (unless absent) and questions (union, max 6); sets provenance and `updated`.
 * - Moves `glossaryTerms` to .work/glossary/<n>.json (the input format of scripts/merge-glossary.ts).
 * - Re-validates the merged file with the site's Zod schema before writing; writes atomically; idempotent.
 *
 * CLI: node --import tsx scripts/explain/merge.ts [--dry-run] [n...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { rfcSchema } from '../../src/lib/schemas';
import { applyOutput } from './apply';
import { defaultPaths, hasSections, isMain, outFile, type Paths, parseNumbers, readContent, today, writeJson } from './lib';
import { type Env, loadEnv, validateOutput } from './validate';

export interface MergeReport {
  merged: number[];
  skippedExisting: number[];
  invalid: { number: number; errors: string[] }[];
  unreadable: { number: number; error: string }[];
  glossaryFiles: number;
  newTerms: number;
}

export function listOutputs(paths: Paths): number[] {
  if (!fs.existsSync(paths.outDir)) return [];
  return fs
    .readdirSync(paths.outDir)
    .map((f) => f.match(/^(\d+)\.json$/)?.[1])
    .filter((x): x is string => !!x)
    .map(Number)
    .sort((a, b) => a - b);
}

export function mergeOutputs(opts: { paths?: Paths; env?: Env; numbers?: number[]; date?: string; dryRun?: boolean } = {}): MergeReport {
  const paths = opts.paths ?? defaultPaths();
  const date = opts.date ?? today();
  const env = opts.env ?? loadEnv(paths);
  env.today = date;
  const report: MergeReport = { merged: [], skippedExisting: [], invalid: [], unreadable: [], glossaryFiles: 0, newTerms: 0 };

  for (const n of opts.numbers ?? listOutputs(paths)) {
    const content = readContent(paths, n);
    if (hasSections(content)) {
      report.skippedExisting.push(n);
      continue;
    }
    let out: Record<string, unknown>;
    try {
      out = JSON.parse(fs.readFileSync(outFile(paths, n), 'utf8'));
    } catch (e) {
      report.unreadable.push({ number: n, error: (e as Error).message });
      continue;
    }
    const errors = validateOutput(n, out, env);
    if (errors.length) {
      report.invalid.push({ number: n, errors });
      continue;
    }
    const merged = applyOutput(content ?? { number: n }, out, date);
    const parsed = rfcSchema.safeParse(merged);
    if (!parsed.success) {
      report.invalid.push({ number: n, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      continue;
    }
    const terms = (out.glossaryTerms as unknown[]) ?? [];
    if (!opts.dryRun) {
      // Glossary first: if we crash before the content write, a rerun still sees no sections and redoes both.
      if (terms.length) {
        writeJson(path.join(paths.glossaryWorkDir, `${n}.json`), terms);
        report.glossaryFiles++;
        report.newTerms += terms.length;
      }
      writeJson(path.join(paths.contentDir, `${n}.json`), merged);
    }
    report.merged.push(n);
  }
  return report;
}

function main(argv: string[]): number {
  const dryRun = argv.includes('--dry-run');
  let numbers: number[] | undefined;
  try {
    const nums = parseNumbers(argv.filter((a) => a !== '--dry-run'));
    if (nums.length) numbers = nums;
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  const r = mergeOutputs({ numbers, dryRun });
  console.log(
    `merge${dryRun ? ' (dry run)' : ''}: ${r.merged.length} merged, ${r.skippedExisting.length} skipped (already have sections), ${r.invalid.length} invalid, ${r.unreadable.length} unreadable; ${r.newTerms} new glossary terms in ${r.glossaryFiles} files`,
  );
  for (const x of r.invalid.slice(0, 20))
    console.log(`  invalid ${x.number}: ${x.errors[0]}${x.errors.length > 1 ? ` (+${x.errors.length - 1} more)` : ''}`);
  for (const x of r.unreadable.slice(0, 20)) console.log(`  unreadable ${x.number}: ${x.error}`);
  return r.invalid.length || r.unreadable.length ? 1 : 0;
}

if (isMain(import.meta.filename)) process.exit(main(process.argv.slice(2)));
