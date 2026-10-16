/**
 * Coverage diff between two dist/data/coverage.json objects (contract C12).
 *
 *   node scripts/coverage-diff.ts <old.json> <new.json>
 *
 * Writes Markdown to $GITHUB_STEP_SUMMARY when set, else stdout. A missing or
 * unreadable <old.json> (first deploy, site unreachable) is treated as "no
 * baseline": the script prints a note and exits 0.
 *
 * Cell byte = (categoryIndex << 4) | state; state: 0 not issued, 1 reserved,
 * 2 historic or obsoleted, 3 unknown, 4 informational or experimental,
 * 5 standard or BCP (the status class); category 15 = none.
 * Note: coverage.json carries no relation data, so "covered pages whose
 * relations changed" is not derivable here; status/tier/category changes are.
 */
import fs from 'node:fs';

export interface CoverageJson {
  max?: number;
  cells?: string;
  categories: string[];
}
interface Cell {
  state: number;
  category: string | null;
}
interface DiffResult {
  added: number[];
  changed: Array<{ n: number; from: string; to: string }>;
}

const STATES = ['not issued', 'reserved', 'historic or obsoleted', 'unknown status', 'informational or experimental', 'standard or BCP'];

export function decode(cov: CoverageJson): Cell[] {
  const buf = Buffer.from(cov.cells || '', 'base64');
  const out: Cell[] = [];
  for (const byte of buf) {
    const ci = byte >> 4;
    out.push({ state: byte & 7, category: ci === 15 ? null : cov.categories[ci] || null });
  }
  return out;
}

function label(c: Cell): string {
  const s = STATES[c.state] || `state ${c.state}`;
  return c.category ? `${s} (${c.category})` : s;
}

/** Pure: → { added: [n], changed: [{n, from, to}] } */
export function diff(oldCov: CoverageJson | null | undefined, newCov: CoverageJson): DiffResult {
  const a = oldCov ? decode(oldCov) : [];
  const b = decode(newCov);
  const added: number[] = [];
  const changed: DiffResult['changed'] = [];
  b.forEach((to, i) => {
    const n = i + 1;
    const from = a[i];
    if (!from) {
      added.push(n);
      return;
    }
    if (from.state === to.state && from.category === to.category) return;
    const stateChanged = from.state !== to.state;
    changed.push({
      n,
      from: stateChanged ? STATES[from.state] || String(from.state) : label(from),
      to: stateChanged ? STATES[to.state] || String(to.state) : label(to),
    });
  });
  return { added, changed };
}

export function render(d: DiffResult, meta: { note?: string } = {}): string {
  const lines = ['## Coverage diff', ''];
  if (meta.note) lines.push(meta.note, '');
  if (!d.added.length && !d.changed.length) {
    lines.push('No coverage changes.');
    return `${lines.join('\n')}\n`;
  }
  if (d.added.length) {
    lines.push(`### New RFC numbers (${d.added.length})`, '');
    const shown = d.added.slice(0, 200);
    lines.push(
      shown.map((n) => `RFC ${n}`).join(', ') + (d.added.length > shown.length ? `, and ${d.added.length - shown.length} more` : ''),
      '',
    );
  }
  if (d.changed.length) {
    lines.push(`### Status / tier changes (${d.changed.length})`, '', '| RFC | From | To |', '|---|---|---|');
    for (const c of d.changed.slice(0, 500)) lines.push(`| RFC ${c.n} | ${c.from} | ${c.to} |`);
    if (d.changed.length > 500) lines.push(`| … | ${d.changed.length - 500} more | |`);
  }
  return `${lines.join('\n')}\n`;
}

function readJson(p: string): CoverageJson | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function main(argv: string[]): number {
  const [oldPath, newPath] = argv;
  if (!oldPath || !newPath) {
    console.error('usage: coverage-diff.ts <old.json> <new.json>');
    return 2;
  }
  const newCov = readJson(newPath);
  if (!newCov) {
    console.error(`cannot read ${newPath}`);
    return 1;
  }
  const oldCov = readJson(oldPath);
  const md = oldCov
    ? render(diff(oldCov, newCov))
    : '## Coverage diff\n\nNo deployed baseline available (first deploy or rfc.akl.run unreachable); diff skipped.\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  else process.stdout.write(md);
  return 0;
}

if (/(^|[\\/])coverage-diff\.ts$/.test(process.argv[1] || '')) process.exit(main(process.argv.slice(2)));
