#!/usr/bin/env node
'use strict';
/**
 * Merges LLM-drafted glossary entries (.work/glossary/<n>.json (zero-padded <n> also accepted), each an
 * array of {id, term, definition, eli5}) into content/glossary/<id>.json.
 * Existing files are kept and only get their `rfcs` unioned; new terms take the
 * longest definition among duplicates. Definitions failing checkHtml are
 * reported and not written.
 */
const fs = require('node:fs');
const path = require('node:path');
const { checkHtml } = require('./lib/sanitize-check');

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function mergeGlossary({ workDir = '.work/glossary', outDir = 'content/glossary' } = {}) {
  const res = { created: 0, updated: 0, unchanged: 0, rejected: [] };
  const groups = new Map(); // id -> [{n, term, definition, eli5}]
  const files = fs.existsSync(workDir) ? fs.readdirSync(workDir).filter((f) => /^\d+\.json$/.test(f)).sort() : [];
  for (const f of files) {
    const n = parseInt(f, 10);
    let arr;
    try { arr = JSON.parse(fs.readFileSync(path.join(workDir, f), 'utf8')); } catch (e) {
      res.rejected.push({ file: f, reason: `bad JSON: ${e.message}` }); continue;
    }
    if (!Array.isArray(arr)) { res.rejected.push({ file: f, reason: 'not an array' }); continue; }
    for (const e of arr) {
      if (!e || typeof e.id !== 'string' || !ID_RE.test(e.id)) { res.rejected.push({ file: f, id: e && e.id, reason: 'invalid id' }); continue; }
      if (typeof e.term !== 'string' || !e.term || typeof e.definition !== 'string' || !e.definition) {
        res.rejected.push({ file: f, id: e.id, reason: 'missing term/definition' }); continue;
      }
      if (!groups.has(e.id)) groups.set(e.id, []);
      groups.get(e.id).push({ n, term: e.term, definition: e.definition, eli5: e.eli5 });
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const [id, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const target = path.join(outDir, `${id}.json`);
    const contributors = list.map((x) => x.n);
    if (fs.existsSync(target)) {
      const cur = JSON.parse(fs.readFileSync(target, 'utf8'));
      const rfcs = [...new Set([...(cur.rfcs || []), ...contributors])].sort((a, b) => a - b);
      if (JSON.stringify(rfcs) === JSON.stringify(cur.rfcs || [])) { res.unchanged++; continue; }
      writeAtomic(target, { ...cur, rfcs });
      res.updated++;
      continue;
    }
    const best = list.reduce((a, b) => (b.definition.length > a.definition.length ? b : a));
    const problems = checkHtml(best.definition).concat(best.eli5 ? checkHtml(best.eli5) : []);
    if (problems.length) { res.rejected.push({ id, reason: problems.join('; ') }); continue; }
    const out = { id, term: best.term, definition: best.definition };
    if (best.eli5) out.eli5 = best.eli5;
    out.rfcs = [...new Set(contributors)].sort((a, b) => a - b);
    writeAtomic(target, out);
    res.created++;
  }
  return res;
}

module.exports = { mergeGlossary };

if (require.main === module) {
  const r = mergeGlossary();
  console.log(`glossary: created ${r.created}, updated ${r.updated}, unchanged ${r.unchanged}, rejected ${r.rejected.length}`);
  for (const x of r.rejected) console.log('  reject', JSON.stringify(x));
  process.exit(r.rejected.length ? 1 : 0);
}
