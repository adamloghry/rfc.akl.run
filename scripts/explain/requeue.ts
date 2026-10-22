/**
 * Requeues the RFCs a generation wave left unfinished.
 *
 * A wave hands work units to agents (`.work/explain/batches/<wave>.json`). An agent that is cut off mid-unit leaves
 * some of its RFCs without an output, and the planner never hands that unit out again, so those RFCs would sit in the
 * queue forever. This reads the batch files, finds every RFC that is neither merged nor has a valid output, and
 * writes a retry batch of single-RFC units for them.
 *
 * Run it BEFORE planning the next wave: the units of the wave in flight are in the batch files by then, and they have
 * no output yet.
 *
 * CLI: node --import tsx scripts/explain/requeue.ts [--name <retry-name>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { defaultPaths, isExplained, isMain, outFile, readContent, readJsonOr, writeJson } from './lib';
import type { PlanRfc, Queue, TierName, Unit } from './plan';
import { loadEnv, validateFile } from './validate';

export interface RequeueReport {
  batches: string[];
  missing: number[];
}

/** The RFCs in the batch files that are neither merged nor have a valid output. */
export function findMissing(batchesDir: string, isDone: (n: number) => boolean, isValid: (n: number) => boolean): RequeueReport {
  const batches: string[] = [];
  const missing: number[] = [];
  if (!fs.existsSync(batchesDir)) return { batches, missing };
  for (const file of fs
    .readdirSync(batchesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const units = readJsonOr<Unit[] | null>(path.join(batchesDir, file), null);
    if (!units) continue;
    batches.push(file);
    for (const u of units)
      for (const r of u.rfcs) if (!isDone(r.number) && !isValid(r.number) && !missing.includes(r.number)) missing.push(r.number);
  }
  return { batches, missing: missing.sort((a, b) => a - b) };
}

function main(argv: string[]): number {
  const i = argv.indexOf('--name');
  const name = i >= 0 && argv[i + 1] ? argv[i + 1] : 'retry';
  const paths = defaultPaths();
  const env = loadEnv(paths);
  const queue = readJsonOr<Queue | null>(paths.queueFile, null);
  const byNumber = new Map<number, PlanRfc>();
  const tierOf = new Map<number, TierName>();
  for (const u of queue?.units ?? [])
    for (const r of u.rfcs) {
      byNumber.set(r.number, r);
      tierOf.set(r.number, u.tier);
    }

  const batchesDir = path.join(paths.root, '.work', 'explain', 'batches');
  const report = findMissing(
    batchesDir,
    (n) => isExplained(readContent(paths, n)),
    (n) => fs.existsSync(outFile(paths, n)) && validateFile(n, env).length === 0,
  );
  const units: Unit[] = report.missing.map((n) => {
    const r = byNumber.get(n);
    return {
      id: `retry-${n}`,
      tier: tierOf.get(n) ?? 'full',
      rfcs: r ? [r] : [{ number: n, title: '', pages: null, textPath: '', contentPath: '' }],
    };
  });
  const out = path.join(batchesDir, `${name}.json`);
  writeJson(out, units);
  console.log(
    `requeue: ${report.missing.length} RFC(s) to redo, from ${report.batches.length} batch file(s) -> ${path.relative(paths.root, out)}`,
  );
  for (const n of report.missing) console.log(`  ${n}`);
  return 0;
}

if (isMain(import.meta.filename)) process.exit(main(process.argv.slice(2)));
