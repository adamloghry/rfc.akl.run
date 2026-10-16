/**
 * Merges LLM-drafted glossary entries (.work/glossary/<n>.json (zero-padded <n> also accepted), each an
 * array of {id, term, definition, eli5}) into content/glossary/<id>.json.
 * Existing files are kept and only get their `rfcs` unioned; new terms take the
 * longest definition among duplicates. Definitions failing checkHtml are
 * reported and not written.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkHtml } from '../src/lib/sanitize-check';

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

interface Draft {
  n: number;
  term: string;
  definition: string;
  eli5?: string;
}
interface GlossaryOut {
  id: string;
  term: string;
  definition: string;
  eli5?: string;
  rfcs?: number[];
}
interface Rejection {
  file?: string;
  id?: unknown;
  reason: string;
}

function writeAtomic(file: string, data: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function mergeGlossary({ workDir = '.work/glossary', outDir = 'content/glossary' } = {}) {
  const res: { created: number; updated: number; unchanged: number; rejected: Rejection[] } = {
    created: 0,
    updated: 0,
    unchanged: 0,
    rejected: [],
  };
  const groups = new Map<string, Draft[]>(); // id -> drafts from each batch file
  const files = fs.existsSync(workDir)
    ? fs
        .readdirSync(workDir)
        .filter((f) => /^\d+\.json$/.test(f))
        .sort()
    : [];
  for (const f of files) {
    const n = parseInt(f, 10);
    let arr: unknown;
    try {
      arr = JSON.parse(fs.readFileSync(path.join(workDir, f), 'utf8'));
    } catch (e) {
      res.rejected.push({ file: f, reason: `bad JSON: ${(e as Error).message}` });
      continue;
    }
    if (!Array.isArray(arr)) {
      res.rejected.push({ file: f, reason: 'not an array' });
      continue;
    }
    for (const e of arr as Array<Partial<GlossaryOut> | null>) {
      if (!e || typeof e.id !== 'string' || !ID_RE.test(e.id)) {
        res.rejected.push({ file: f, id: e?.id, reason: 'invalid id' });
        continue;
      }
      if (typeof e.term !== 'string' || !e.term || typeof e.definition !== 'string' || !e.definition) {
        res.rejected.push({ file: f, id: e.id, reason: 'missing term/definition' });
        continue;
      }
      const list = groups.get(e.id) ?? [];
      groups.set(e.id, list);
      list.push({ n, term: e.term, definition: e.definition, eli5: e.eli5 });
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const [id, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const target = path.join(outDir, `${id}.json`);
    const contributors = list.map((x) => x.n);
    if (fs.existsSync(target)) {
      const cur = JSON.parse(fs.readFileSync(target, 'utf8')) as GlossaryOut;
      const rfcs = [...new Set([...(cur.rfcs || []), ...contributors])].sort((a, b) => a - b);
      if (JSON.stringify(rfcs) === JSON.stringify(cur.rfcs || [])) {
        res.unchanged++;
        continue;
      }
      writeAtomic(target, { ...cur, rfcs });
      res.updated++;
      continue;
    }
    const best = list.reduce((a, b) => (b.definition.length > a.definition.length ? b : a));
    const problems = checkHtml(best.definition).concat(best.eli5 ? checkHtml(best.eli5) : []);
    if (problems.length) {
      res.rejected.push({ id, reason: problems.join('; ') });
      continue;
    }
    const out: GlossaryOut = { id, term: best.term, definition: best.definition };
    if (best.eli5) out.eli5 = best.eli5;
    out.rfcs = [...new Set(contributors)].sort((a, b) => a - b);
    writeAtomic(target, out);
    res.created++;
  }
  return res;
}

if (/(^|[\\/])merge-glossary\.ts$/.test(process.argv[1] || '')) {
  const r = mergeGlossary();
  console.log(`glossary: created ${r.created}, updated ${r.updated}, unchanged ${r.unchanged}, rejected ${r.rejected.length}`);
  for (const x of r.rejected) console.log('  reject', JSON.stringify(x));
  process.exit(r.rejected.length ? 1 : 0);
}
