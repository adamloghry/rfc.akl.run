import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type Content, defaultPaths, type IndexSummary, type Paths } from '../../scripts/explain/lib';

/** [pages, status, obsoleted] per RFC; year/month are irrelevant to the tooling. */
const INFO: Record<number, [number | null, string, 0 | 1]> = {
  100: [3, 'unknown', 0],
  760: [42, 'historic', 1],
  761: [85, 'historic', 1],
  768: [3, 'internet-standard', 0],
  900: [4, 'informational', 0],
  901: [20, 'proposed-standard', 0],
  902: [20, 'proposed-standard', 1],
  903: [40, 'informational', 0],
  904: [200, 'proposed-standard', 0],
  905: [10, 'historic', 0],
  906: [12, 'bcp', 0],
  907: [5, 'informational', 0],
  908: [2, 'informational', 0],
  1149: [2, 'experimental', 0],
  2000: [30, 'experimental', 0],
  2001: [150, 'proposed-standard', 0],
  2002: [151, 'proposed-standard', 0],
};

export function fixtureSummary(): IndexSummary {
  const issued = Object.keys(INFO).map(Number);
  const info: IndexSummary['info'] = {};
  const titles: Record<string, string> = {};
  for (const n of issued) {
    info[n] = [INFO[n][0], INFO[n][1], INFO[n][2], 1990, 1];
    titles[n] = `Title of RFC ${n}`;
  }
  return { max: 9999, issued, notIssued: [], info, titles };
}

export interface Fixture {
  root: string;
  paths: Paths;
  summary: IndexSummary;
  writeContent: (n: number, c: Content) => void;
  readContent: (n: number) => Content;
  writeGlossary: (id: string, extra?: Content) => void;
  writeOut: (n: number, out: unknown) => void;
  cleanup: () => void;
}

export function makeFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'explain-'));
  const paths = defaultPaths(root);
  // The curated April list is a repo file; tests use their own copy.
  fs.mkdirSync(path.dirname(paths.aprilFile), { recursive: true });
  fs.writeFileSync(paths.aprilFile, JSON.stringify({ rfcs: [{ number: 2000 }] }));
  for (const d of [paths.contentDir, paths.glossaryContentDir, paths.outDir, paths.textDir, paths.glossaryWorkDir])
    fs.mkdirSync(d, { recursive: true });
  const summary = fixtureSummary();
  const fx: Fixture = {
    root,
    paths,
    summary,
    writeContent: (n, c) => fs.writeFileSync(path.join(paths.contentDir, `${n}.json`), `${JSON.stringify(c, null, 2)}\n`),
    readContent: (n) => JSON.parse(fs.readFileSync(path.join(paths.contentDir, `${n}.json`), 'utf8')),
    writeGlossary: (id, extra = {}) =>
      fs.writeFileSync(
        path.join(paths.glossaryContentDir, `${id}.json`),
        JSON.stringify({ id, term: id, definition: `<p>Definition of ${id}.</p>`, ...extra }),
      ),
    writeOut: (n, out) => fs.writeFileSync(path.join(paths.outDir, `${n}.json`), JSON.stringify(out)),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
  for (const n of summary.issued) fx.writeContent(n, summaryOnly(n));
  for (const id of ['udp', 'port-number', 'datagram', 'connectionless', 'internet-checksum', 'pseudo-header'])
    fx.writeGlossary(id, { rfcs: [1] });
  return fx;
}

/** A summary-only content file as the repo has them today. */
export function summaryOnly(n: number): Content {
  return {
    number: n,
    shortTitle: n === 768 ? 'UDP' : null,
    category: 'core',
    categoryReviewed: false,
    summary: `<p>Summary of RFC ${n}.</p>`,
    eli5: { summary: `<p>Kid summary of RFC ${n}.</p>` },
    questions: ['existing question one', 'existing question two'],
    provenance: { source: 'llm-draft', model: 'claude-sonnet-5-5', drafted: '2026-10-15', reviewedBy: null },
    updated: '2026-10-15',
  };
}

const example = path.join(import.meta.dirname, '..', '..', 'scripts', 'explain', 'example-compact.json');
/** A fresh copy of the hand-written compact example (valid for the compact tier). */
export const validOutput = (): Content => JSON.parse(fs.readFileSync(example, 'utf8'));
