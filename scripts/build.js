#!/usr/bin/env node
'use strict';
/**
 * Static site build orchestrator.
 *
 * CLI: node scripts/build.js [--offline] [--index <file>] [--content <dir>] [--out <dir>]
 *                            [--only <n,n>]
 * API: build({ indexFile, contentDir, outDir, buildDate, offline, only, pages, quiet })
 */
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://rfc.akl.run';
const STATE = { 'not-issued': 0, reserved: 1, index: 2, summary: 3, explainer: 4, interactive: 5 };

function listPageModules() {
  const dir = path.join(__dirname, 'pages');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(dir, f));
}

function sitemapUrl(p) {
  if (p === 'index.html') return '/';
  if (p.endsWith('/index.html')) return '/' + p.slice(0, -'index.html'.length);
  return null;
}

function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const { buildSearchIndex } = require('./lib/search-index');

// ---- data files (C12) ----------------------------------------------------

function dataFiles(site) {
  const files = {};
  const catKeys = site.categories.map((c) => c.key);
  // The cell byte packs the category in 4 bits and reserves 15 for "none".
  if (catKeys.length > 15) throw new Error(`coverage.json packs the category in 4 bits (15 = none): ${catKeys.length} categories, max 15`);
  const cells = Buffer.alloc(site.max);
  for (let n = 1; n <= site.max; n++) {
    const r = site.rfcs.get(n);
    let state, cat = 15;
    if (r) {
      state = STATE[r.tier];
      const i = catKeys.indexOf(r.category);
      cat = i < 0 ? 15 : i;
    } else state = site.notIssued.has(n) ? STATE['not-issued'] : STATE.reserved;
    cells[n - 1] = (cat << 4) | state; // low 3 bits state, high 4 bits category (15 = none)
  }
  files['data/coverage.json'] = JSON.stringify({
    max: site.max, buildDate: site.buildDate.toISOString().slice(0, 10), categories: catKeys, cells: cells.toString('base64'),
  });

  const titles = {};
  for (const r of site.rfcs.values()) {
    const k = Math.floor((r.number - 1) / 1000);
    (titles[k] = titles[k] || {})[r.number] = [r.shortTitle || null, r.title, r.year, r.status];
  }
  for (const [k, v] of Object.entries(titles)) files[`data/titles/${k}.json`] = JSON.stringify(v);

  const questions = [];
  for (const j of site.journeys) {
    for (const q of j.questions || []) questions.push({ q, href: `/journeys/${j.slug}/`, label: 'JOURNEY', title: j.title });
  }
  for (const r of site.rfcs.values()) {
    if (r.tier !== 'explainer' && r.tier !== 'interactive') continue;
    const t = r.shortTitle ? `${r.shortTitle}: ${r.title}` : r.title;
    for (const q of (r.content && r.content.questions) || []) questions.push({ q, href: r.url, label: `RFC ${r.number}`, title: t });
  }
  files['data/questions.json'] = JSON.stringify(questions);

  const graph = {};
  for (const r of site.rfcs.values()) {
    if (!(r.obsoletes.length || r.obsoletedBy.length || r.updates.length || r.updatedBy.length)) continue;
    graph[r.number] = { o: r.obsoletes, ob: r.obsoletedBy, u: r.updates, ub: r.updatedBy, t: r.shortTitle || r.title, y: r.year };
  }
  files['data/graph.json'] = JSON.stringify(graph);

  for (const f of buildSearchIndex(site).files) files[f.path] = f.json;
  return files;
}

// ---- build ---------------------------------------------------------------

async function build(opts = {}) {
  const assets = require('./lib/assets');
  const { loadIndex } = require('./lib/rfc-index');
  const { buildSite } = require('./lib/model');
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  const outDir = path.resolve(opts.outDir || path.join(ROOT, 'dist'));
  const contentDir = path.resolve(opts.contentDir || path.join(ROOT, 'content'));
  if (outDir === ROOT || ROOT.startsWith(outDir + path.sep) || outDir === path.parse(outDir).root) {
    throw new Error(`refusing to wipe unsafe output dir ${outDir}`);
  }
  const timings = {};
  const t0 = performance.now();
  let t = t0;
  const lap = (k) => { const n = performance.now(); timings[k] = n - t; t = n; };

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  assets.build(outDir);
  lap('assets');

  const index = await loadIndex({
    offline: !!opts.offline, file: opts.indexFile ? path.resolve(opts.indexFile) : null, cacheDir: path.join(ROOT, '.cache'),
  });
  lap('index');
  const site = buildSite({ index, contentDir, buildDate: opts.buildDate || new Date() });
  if (opts.only && opts.only.length) site.only = new Set(opts.only.map(Number));
  lap('model');

  const modules = (opts.pages || listPageModules()).map((p) => path.resolve(p));
  const written = new Map(); // path -> module name
  const sitemap = [];
  const madeDirs = new Set();
  let pageCount = 0;
  const write = (rel, data) => {
    const abs = path.join(outDir, rel);
    const dir = path.dirname(abs);
    if (!madeDirs.has(dir)) { fs.mkdirSync(dir, { recursive: true }); madeDirs.add(dir); }
    fs.writeFileSync(abs, data);
  };
  for (const file of modules) {
    const mod = require(file);
    if (!mod || typeof mod.render !== 'function') { log(`  skipping ${path.basename(file)} (no render export)`); continue; }
    const name = mod.name || path.basename(file, '.js');
    const mt = performance.now();
    let n = 0;
    for (const out of mod.render(site) || []) {
      const p = out.path;
      if (typeof p !== 'string' || !p || p.startsWith('/') || p.split('/').includes('..')) throw new Error(`module ${name}: invalid output path ${JSON.stringify(p)}`);
      if (written.has(p)) throw new Error(`duplicate output path ${p} (modules ${written.get(p)} and ${name})`);
      written.set(p, name);
      write(p, out.html);
      const url = out.sitemap === false ? null : sitemapUrl(p);
      if (url) sitemap.push(url);
      n++;
    }
    pageCount += n;
    log(`  ${name}: ${n} files (${((performance.now() - mt) / 1000).toFixed(1)}s)`);
  }
  lap('pages');

  for (const [rel, data] of Object.entries(dataFiles(site))) {
    if (written.has(rel)) throw new Error(`duplicate output path ${rel} (data files)`);
    written.set(rel, 'data'); write(rel, data); pageCount++;
  }
  lap('data');

  if (written.has('sitemap.xml')) throw new Error('duplicate output path sitemap.xml');
  sitemap.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b, 'en', { numeric: true })));
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    sitemap.map((u) => `<url><loc>${xmlEsc(ORIGIN + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  lap('sitemap');

  timings.total = performance.now() - t0;
  const counts = { pages: pageCount, sitemap: sitemap.length, max: site.max, tiers: site.counts };
  log('Build complete: ' + Object.entries(timings).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`).join(', '));
  log(`  ${pageCount} files, ${sitemap.length} sitemap URLs, tiers ${JSON.stringify(site.counts)}`);
  return { outDir, site, counts, timings };
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--offline') o.offline = true;
    else if (a === '--no-pagefind') { /* accepted and ignored: Pagefind was replaced by the static index in data/search/ */ }
    else if (a === '--index') o.indexFile = argv[++i];
    else if (a === '--content') o.contentDir = argv[++i];
    else if (a === '--out') o.outDir = argv[++i];
    else if (a === '--only') o.only = argv[++i].split(',').map(Number).filter(Boolean);
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

if (require.main === module) {
  build(parseArgs(process.argv.slice(2))).catch((e) => { console.error(e.stack || e); process.exit(1); });
}

module.exports = { build, dataFiles, parseArgs };
