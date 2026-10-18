/**
 * Progress report: per tier, how many RFCs are explained already, merged by this pipeline, done (valid output waiting for merge),
 * invalid (output present but failing validation), failed (failed.json) and remaining; the next units to run; text mirror completeness.
 *
 * CLI: node --import tsx scripts/explain/status.ts [--next N]
 */
import fs from 'node:fs';
import {
  aprilFools,
  defaultPaths,
  hasSections,
  type IndexSummary,
  isMain,
  loadSummary,
  outFile,
  type Paths,
  PDF_ONLY,
  readContent,
  readJsonOr,
  TIERS,
  type TierName,
  textPathFor,
  tierOf,
} from './lib';
import type { Queue } from './plan';
import { loadEnv, validateFile } from './validate';

export interface TierStatus {
  total: number;
  existing: number;
  merged: number;
  done: number;
  invalid: number;
  failed: number;
  remaining: number;
}
export interface Status {
  tiers: Record<TierName, TierStatus>;
  totals: TierStatus;
  nextUnits: string[];
  text: { wanted: number; present: number; missing: number[]; pdf: number };
}

export function status(opts: { paths?: Paths; summary?: IndexSummary; next?: number } = {}): Status {
  const paths = opts.paths ?? defaultPaths();
  const summary = opts.summary ?? loadSummary(paths);
  const env = loadEnv(paths, summary);
  const april = aprilFools(paths);
  const failed = new Set(readJsonOr<{ number: number }[]>(paths.failedFile, []).map((f) => f.number));
  const empty = (): TierStatus => ({ total: 0, existing: 0, merged: 0, done: 0, invalid: 0, failed: 0, remaining: 0 });
  const tiers = Object.fromEntries(TIERS.map((t) => [t, empty()])) as Record<TierName, TierStatus>;
  const done = new Set<number>();
  const text = { wanted: 0, present: 0, missing: [] as number[], pdf: 0 };

  for (const n of summary.issued) {
    const tier = tierOf(n, summary, april);
    const t = tiers[tier];
    t.total++;
    const content = readContent(paths, n);
    if (hasSections(content)) {
      if (content?.provenance?.promptVersion) t.merged++;
      else t.existing++;
      continue;
    }
    text.wanted++;
    const tp = textPathFor(paths, n);
    if (fs.existsSync(tp) && fs.statSync(tp).size > 0) {
      text.present++;
      if (tp.endsWith('.pdf')) text.pdf++;
    } else text.missing.push(n);
    if (fs.existsSync(outFile(paths, n))) {
      if (validateFile(n, env).length === 0) {
        t.done++;
        done.add(n);
      } else t.invalid++;
    } else if (failed.has(n)) t.failed++;
    else t.remaining++;
  }

  const totals = empty();
  for (const t of Object.values(tiers)) for (const k of Object.keys(totals) as (keyof TierStatus)[]) totals[k] += t[k];

  const queue = readJsonOr<Queue | null>(paths.queueFile, null);
  const nextUnits = (queue?.units ?? [])
    .filter((u) => u.rfcs.some((r) => !done.has(r.number) && !failed.has(r.number) && !hasSections(readContent(paths, r.number))))
    .slice(0, opts.next ?? 5)
    .map((u) => u.id);
  return { tiers, totals, nextUnits, text };
}

export function format(s: Status): string {
  const cols = ['total', 'existing', 'merged', 'done', 'invalid', 'failed', 'remaining'] as const;
  const lines = [`${'tier'.padEnd(9)}${cols.map((c) => c.padStart(10)).join('')}`];
  for (const t of TIERS) lines.push(`${t.padEnd(9)}${cols.map((c) => String(s.tiers[t][c]).padStart(10)).join('')}`);
  lines.push(`${'all'.padEnd(9)}${cols.map((c) => String(s.totals[c]).padStart(10)).join('')}`);
  lines.push('');
  lines.push(`next units: ${s.nextUnits.length ? s.nextUnits.join(', ') : '(none; run npm run explain:plan)'}`);
  lines.push(
    `text mirror: ${s.text.present}/${s.text.wanted} present (${s.text.pdf} PDF; PDF-only RFCs: ${PDF_ONLY.join(', ')}), ${s.text.missing.length} missing${
      s.text.missing.length ? ` (first: ${s.text.missing.slice(0, 10).join(', ')})` : ''
    }`,
  );
  return lines.join('\n');
}

function main(argv: string[]): number {
  const i = argv.indexOf('--next');
  const next = i >= 0 ? Number(argv[i + 1]) : 5;
  console.log(format(status({ next })));
  return 0;
}

if (isMain(import.meta.filename)) process.exit(main(process.argv.slice(2)));
