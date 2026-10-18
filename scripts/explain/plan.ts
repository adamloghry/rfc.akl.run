/**
 * Builds .work/explain/queue.json: every issued RFC that has no `sections` yet, in C9 priority order, grouped into agent work units.
 * Units: large 1 RFC, full 2, standard 3, compact 6. RFCs that already have a valid output file (or are merged) are skipped, so reruns resume.
 *
 * CLI: node --import tsx scripts/explain/plan.ts [--retry-failed]
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildSite } from '../../src/lib/model';
import { loadIndex } from '../../src/lib/rfc-index';
import {
  aprilFools,
  defaultPaths,
  hasSections,
  type IndexSummary,
  isMain,
  loadSummary,
  outFile,
  type Paths,
  PROMPT_VERSION,
  readContent,
  readJsonOr,
  TIERS,
  type TierName,
  textPathFor,
  tierOf,
  UNIT_SIZE,
  writeJson,
} from './lib';
import { loadEnv, validateFile } from './validate';

export interface PlanRfc {
  number: number;
  title: string;
  pages: number | null;
  textPath: string;
  contentPath: string;
  /** index metadata the agent needs to state status plainly (present when plan runs against the real site model) */
  published?: string;
  status?: string;
  obsoletes?: number[];
  obsoletedBy?: number[];
  updates?: number[];
  updatedBy?: number[];
  /** true for the curated April 1st list: write it as the joke it is */
  aprilFools?: boolean;
}
export interface Unit {
  id: string;
  tier: TierName;
  rfcs: PlanRfc[];
}
export interface Queue {
  promptVersion: string;
  counts: Record<TierName, { rfcs: number; units: number }> & { total: { rfcs: number; units: number } };
  skipped: { merged: number; done: number; failed: number };
  units: Unit[];
}
export interface Candidate {
  number: number;
  tier: TierName;
  priority: number;
  rfc: PlanRfc;
}

/** Groups candidates (already filtered) into units. Order: by the priority of each unit's first RFC, ties by RFC number. */
export function groupUnits(cands: Candidate[]): Unit[] {
  const sorted = [...cands].sort((a, b) => b.priority - a.priority || a.number - b.number);
  const byTier = new Map<TierName, Candidate[]>(TIERS.map((t) => [t, []]));
  for (const c of sorted) byTier.get(c.tier)?.push(c);
  const units: { unit: Unit; priority: number; first: number }[] = [];
  for (const tier of TIERS) {
    const list = byTier.get(tier) ?? [];
    for (let i = 0; i < list.length; i += UNIT_SIZE[tier]) {
      const chunk = list.slice(i, i + UNIT_SIZE[tier]);
      units.push({
        unit: { id: `${tier}-${chunk[0].number}`, tier, rfcs: chunk.map((c) => c.rfc) },
        priority: chunk[0].priority,
        first: chunk[0].number,
      });
    }
  }
  units.sort((a, b) => b.priority - a.priority || a.first - b.first);
  return units.map((u) => u.unit);
}

export function countQueue(units: Unit[]): Queue['counts'] {
  const counts = Object.fromEntries(TIERS.map((t) => [t, { rfcs: 0, units: 0 }])) as Queue['counts'];
  counts.total = { rfcs: 0, units: 0 };
  for (const u of units) {
    counts[u.tier].units++;
    counts[u.tier].rfcs += u.rfcs.length;
    counts.total.units++;
    counts.total.rfcs += u.rfcs.length;
  }
  return counts;
}

export interface PlanInput {
  paths: Paths;
  summary: IndexSummary;
  /** n -> C9 priority score */
  priority: (n: number) => number;
  retryFailed?: boolean;
  /** extra per-RFC metadata copied into each queue entry */
  meta?: (n: number) => Partial<PlanRfc>;
  /** treat an output file as done when this says so; defaults to a full validation */
  isValid?: (n: number) => boolean;
}

export function plan(input: PlanInput): Queue {
  const { paths, summary } = input;
  const april = aprilFools(paths);
  const failed = new Set<number>(input.retryFailed ? [] : readJsonOr<{ number: number }[]>(paths.failedFile, []).map((f) => f.number));
  const env = input.isValid ? null : loadEnv(paths, summary);
  const isValid = input.isValid ?? ((n: number) => validateFile(n, env as ReturnType<typeof loadEnv>).length === 0);
  const skipped = { merged: 0, done: 0, failed: 0 };
  const cands: Candidate[] = [];
  const rel = (p: string) => path.relative(paths.root, p);
  for (const n of summary.issued) {
    const content = readContent(paths, n);
    if (hasSections(content)) {
      skipped.merged++;
      continue;
    }
    if (fs.existsSync(outFile(paths, n)) && isValid(n)) {
      skipped.done++;
      continue;
    }
    if (failed.has(n)) {
      skipped.failed++;
      continue;
    }
    const tier = tierOf(n, summary, april);
    cands.push({
      number: n,
      tier,
      priority: input.priority(n),
      rfc: {
        number: n,
        title: content?.title ?? summary.titles[n] ?? '',
        pages: summary.info[n]?.[0] ?? null,
        textPath: rel(textPathFor(paths, n)),
        contentPath: rel(path.join(paths.contentDir, `${n}.json`)),
        ...(input.meta?.(n) ?? {}),
        ...(april.has(n) ? { aprilFools: true } : {}),
      },
    });
  }
  const units = groupUnits(cands);
  return { promptVersion: PROMPT_VERSION, counts: countQueue(units), skipped, units };
}

function main(argv: string[]): number {
  const paths = defaultPaths();
  const retryFailed = argv.includes('--retry-failed');
  const index = loadIndex();
  const site = buildSite({ index });
  const queue = plan({
    paths,
    summary: loadSummary(paths),
    priority: (n) => site.rfcs.get(n)?.priority ?? 0,
    retryFailed,
    meta: (n) => {
      const r = site.rfcs.get(n);
      if (!r) return {};
      return {
        published: r.dateLabel,
        status: r.statusLabel,
        obsoletes: r.obsoletes,
        obsoletedBy: r.obsoletedBy,
        updates: r.updates,
        updatedBy: r.updatedBy,
      };
    },
  });
  writeJson(paths.queueFile, queue, false);
  const c = queue.counts;
  console.log(`queue: ${c.total.rfcs} RFCs in ${c.total.units} units -> ${path.relative(paths.root, paths.queueFile)}`);
  for (const t of TIERS) console.log(`  ${t.padEnd(9)} ${String(c[t].rfcs).padStart(5)} RFCs  ${String(c[t].units).padStart(5)} units`);
  console.log(
    `  skipped: ${queue.skipped.merged} already explained, ${queue.skipped.done} with valid output, ${queue.skipped.failed} failed`,
  );
  const missing = queue.units.flatMap((u) => u.rfcs).filter((r) => !fs.existsSync(path.join(paths.root, r.textPath))).length;
  if (missing) console.log(`  warning: ${missing} queued RFCs have no mirrored text yet (run npm run explain:fetch)`);
  return 0;
}

if (isMain(import.meta.filename)) process.exit(main(process.argv.slice(2)));
