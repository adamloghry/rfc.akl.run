/**
 * Finalizes glossary terms drafted by the explainers (.work/glossary/<n>.json):
 * dedupes by id (existing content/glossary definitions win, otherwise the shortest complete definition),
 * drops new terms that fewer than 2 RFCs defined (existing terms are always kept), writes the survivors through
 * scripts/merge-glossary.ts, then rewrites every RFC's `glossary` array to ids that exist.
 *
 * CLI: node --import tsx scripts/explain/glossary-finalize.ts [--dry-run]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHtml } from '../../src/lib/sanitize-check';
import { mergeGlossary } from '../merge-glossary';
import { defaultPaths, isMain, type Paths, readJson, writeJson } from './lib';

interface Draft {
  id: string;
  term: string;
  definition: string;
  eli5?: string;
}
export interface FinalizeReport {
  created: number;
  updated: number;
  unchanged: number;
  rejected: { id?: unknown; reason: string; file?: string }[];
  /** new ids dropped because fewer than 2 RFCs defined them */
  dropped: string[];
  /** ids whose drafts disagreed and were resolved to a single definition */
  deduped: string[];
  rewritten: number[];
}

const MIN_RFCS = 2;

/** A definition is complete when its visible text ends with sentence punctuation. */
export function isComplete(definition: string): boolean {
  return /[.!?)"'”’]$/.test(definition.replace(/<[^>]*>/g, '').trim());
}

/** Shortest complete definition; the shortest overall when none is complete. Ties: first RFC number. */
export function pickDefinition(drafts: (Draft & { n: number })[]): Draft & { n: number } {
  const ranked = [...drafts].sort((a, b) => a.definition.length - b.definition.length || a.n - b.n);
  return ranked.find((d) => isComplete(d.definition) && checkHtml(d.definition).length === 0) ?? ranked[0];
}

function readDrafts(workDir: string): Map<string, (Draft & { n: number })[]> {
  const byId = new Map<string, (Draft & { n: number })[]>();
  if (!fs.existsSync(workDir)) return byId;
  for (const f of fs.readdirSync(workDir).sort()) {
    if (!/^\d+\.json$/.test(f)) continue;
    const n = Number.parseInt(f, 10);
    let arr: unknown;
    try {
      arr = readJson(path.join(workDir, f));
    } catch {
      continue; // merge-glossary reports unreadable files; nothing to finalize from them
    }
    if (!Array.isArray(arr)) continue;
    for (const d of arr as Draft[]) {
      if (!d || typeof d.id !== 'string' || typeof d.definition !== 'string' || typeof d.term !== 'string') continue;
      const list = byId.get(d.id) ?? [];
      byId.set(d.id, list);
      list.push({ ...d, n });
    }
  }
  return byId;
}

export function finalizeGlossary(opts: { paths?: Paths; dryRun?: boolean } = {}): FinalizeReport {
  const paths = opts.paths ?? defaultPaths();
  const drafts = readDrafts(paths.glossaryWorkDir);
  const existing = new Set<string>(
    fs.existsSync(paths.glossaryContentDir)
      ? fs
          .readdirSync(paths.glossaryContentDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.slice(0, -5))
      : [],
  );
  const report: FinalizeReport = { created: 0, updated: 0, unchanged: 0, rejected: [], dropped: [], deduped: [], rewritten: [] };

  // Stage canonical drafts: one definition per id, only for survivors.
  const stage = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'glossary-finalize-'));
  const staged = new Map<number, Draft[]>();
  try {
    for (const [id, list] of [...drafts].sort((a, b) => a[0].localeCompare(b[0]))) {
      const contributors = [...new Set(list.map((d) => d.n))];
      if (!existing.has(id) && contributors.length < MIN_RFCS) {
        report.dropped.push(id);
        continue;
      }
      const best = pickDefinition(list);
      if (new Set(list.map((d) => d.definition)).size > 1 && !existing.has(id)) report.deduped.push(id);
      for (const n of contributors) {
        const entry: Draft = { id, term: best.term, definition: best.definition };
        if (best.eli5) entry.eli5 = best.eli5;
        staged.set(n, [...(staged.get(n) ?? []), entry]);
      }
    }
    if (opts.dryRun) {
      const survivors = [...drafts.keys()].filter((id) => !report.dropped.includes(id));
      report.created = survivors.filter((id) => !existing.has(id)).length;
      return report;
    }
    for (const [n, entries] of staged) writeJson(path.join(stage, `${n}.json`), entries);
    const r = mergeGlossary({ workDir: stage, outDir: paths.glossaryContentDir });
    report.created = r.created;
    report.updated = r.updated;
    report.unchanged = r.unchanged;
    report.rejected = r.rejected;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }

  // Rewrite each RFC's glossary array to the ids that exist now.
  const alive = new Set(
    fs
      .readdirSync(paths.glossaryContentDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5)),
  );
  for (const f of fs.readdirSync(paths.contentDir)) {
    if (!f.endsWith('.json')) continue;
    const file = path.join(paths.contentDir, f);
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('"glossary"')) continue;
    const doc = JSON.parse(text) as { number: number; glossary?: string[] };
    if (!Array.isArray(doc.glossary)) continue;
    const kept = doc.glossary.filter((id) => alive.has(id));
    if (kept.length === doc.glossary.length) continue;
    doc.glossary = kept;
    writeJson(file, doc);
    report.rewritten.push(doc.number);
  }
  report.rewritten.sort((a, b) => a - b);
  return report;
}

function main(argv: string[]): number {
  const dryRun = argv.includes('--dry-run');
  const r = finalizeGlossary({ dryRun });
  console.log(
    `glossary-finalize${dryRun ? ' (dry run)' : ''}: ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged, ${r.dropped.length} singleton terms dropped, ${r.deduped.length} deduped, ${r.rejected.length} rejected, ${r.rewritten.length} RFC glossary arrays rewritten`,
  );
  for (const x of r.rejected.slice(0, 20)) console.log(`  reject ${JSON.stringify(x)}`);
  return r.rejected.length ? 1 : 0;
}

if (isMain(import.meta.filename)) process.exit(main(process.argv.slice(2)));
