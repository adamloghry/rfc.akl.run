#!/usr/bin/env node
'use strict';
// Split every index-tier RFC into .work/summaries/in/batch-NNN.json (sorted by number) for drafting agents.
// Also writes .work/explainer-targets.json (top 60 by priority, tier index|summary, not obsoleted).
const fs = require('node:fs');
const path = require('node:path');
const areas = require('./lib/areas');

const ROOT = path.resolve(__dirname, '..');

function toItem(r, entry) {
  const existing = {};
  const c = r.content;
  if (c && c.shortTitle) existing.shortTitle = c.shortTitle;
  if (c && c.category) existing.category = c.category;
  return {
    number: r.number, title: r.title, authors: r.authors, year: r.year, status: r.status, stream: r.stream,
    area: r.area, wg: r.wg, keywords: r.keywords, abstract: r.abstract,
    guessedCategory: areas.guessCategory(entry),
    obsoletes: r.obsoletes, obsoletedBy: r.obsoletedBy, updates: r.updates, updatedBy: r.updatedBy,
    existing,
  };
}

/** @returns {{batches: number, items: number}} */
function makeBatches({ site, index, outDir, size = 100 }) {
  // Callers are responsible for the overwrite guard; this only clears old batch files it owns.
  const items = [...site.rfcs.values()].filter((r) => r.tier === 'index').sort((a, b) => a.number - b.number)
    .map((r) => toItem(r, index.entries.get(r.number)));
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (let i = 0; i < items.length; i += size) {
    n++;
    fs.writeFileSync(path.join(outDir, `batch-${String(n).padStart(3, '0')}.json`), JSON.stringify(items.slice(i, i + size), null, 1) + '\n');
  }
  return { batches: n, items: items.length };
}

function explainerTargets(site, count = 60) {
  return [...site.rfcs.values()]
    .filter((r) => (r.tier === 'index' || r.tier === 'summary') && r.obsoletedBy.length === 0)
    .sort((a, b) => b.priority - a.priority || a.number - b.number)
    .slice(0, count)
    .map((r) => ({ number: r.number, title: r.title, status: r.status, priority: r.priority }));
}

async function main(argv) {
  let size = 100;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--size') size = Number(argv[++i]);
    else if (argv[i] === '--force') force = true;
    else { console.error(`unknown argument: ${argv[i]}`); return 2; }
  }
  if (!Number.isInteger(size) || size < 1) { console.error('--size must be a positive integer'); return 2; }
  const work = path.join(ROOT, '.work');
  const dirs = ['in', 'out'].map((d) => path.join(work, 'summaries', d));
  const targets = path.join(work, 'explainer-targets.json');
  const busy = [...dirs.filter((d) => fs.existsSync(d) && fs.readdirSync(d).length), ...(fs.existsSync(targets) ? [targets] : [])];
  if (busy.length && !force) {
    console.error(`refusing to overwrite existing work (drafting may be in progress):\n  ${busy.join('\n  ')}\nre-run with --force to replace`);
    return 1;
  }
  const { loadIndex } = require('./lib/rfc-index');
  const { buildSite } = require('./lib/model');
  const index = await loadIndex({ cacheDir: path.join(ROOT, '.cache'), offline: true });
  const site = buildSite({ index, contentDir: path.join(ROOT, 'content') });
  if (force) fs.rmSync(dirs[0], { recursive: true, force: true });
  const r = makeBatches({ site, index, outDir: path.join(work, 'summaries', 'in'), size });
  fs.writeFileSync(path.join(work, 'explainer-targets.json'), JSON.stringify(explainerTargets(site), null, 2) + '\n');
  console.log(`${r.items} items in ${r.batches} batches (size ${size}); wrote .work/explainer-targets.json`);
  return 0;
}

module.exports = { makeBatches, explainerTargets, toItem };
if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(2); });
