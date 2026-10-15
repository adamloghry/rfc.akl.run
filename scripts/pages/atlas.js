'use strict';
// Atlas home page (Task 9): hero search, coverage band, map, journeys, areas, timeline.
const { html, raw, esc } = require('../lib/html');
const { layout } = require('../lib/layout');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUGGESTIONS = ['How does email get delivered?', 'Why is the padlock there?', 'TLS 1.3', '2119'];
const HASH_FORWARDER = "var m=location.hash.match(/^#rfc(\\d+)$/i);if(m)location.replace('/'+(+m[1])+'/');";

const fmt = (n) => Number(n).toLocaleString('en-US');
const pct1 = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%';
const w = (n, d) => (d ? ((n / d) * 100).toFixed(2) : '0') + '%';
const covered = (r) => r.tier !== 'index';
const featured = (r) => r.tier === 'explainer' || r.tier === 'interactive';

function eyebrow(text) { return html`<span class="at-eyebrow">${text}</span>`; }

function hero() {
  return html`<section class="at-hero">
<div class="at-hero-copy">
<h1 class="at-h1">The documents that built the Internet, explained.</h1>
<p class="at-lead">Every RFC has a permanent page at <span class="at-mono-inline">rfc.akl.run/&lt;number&gt;/</span>. The important ones get diagrams, simulations, and a version a five-year-old could follow.</p>
</div>
<div class="at-hero-search" id="search">
<div class="search-box search-hero" role="search"><span class="search-ring" aria-hidden="true"></span><input class="search-input" type="search" placeholder="RFC number, protocol, or a question" aria-label="Search RFCs" autocomplete="off" spellcheck="false"><span class="search-kbd" aria-hidden="true">/</span><div class="search-pop" hidden><div role="listbox"></div></div></div>
<div class="at-pills">${SUGGESTIONS.map((s) => html`<button type="button" class="at-pill" data-search-fill="${s}">${s}</button>`)}</div>
</div>
</section>`;
}

function coverage(site) {
  const c = site.counts;
  const cov = c.summary + c.explainer + c.interactive;
  const ladder = [
    { label: 'Index page', count: fmt(c.total), hint: 'Automatic, from the RFC Editor', color: 'var(--map-feat-dim)' },
    { label: 'Summary', count: fmt(c.summary), hint: 'Plain-language abstract + ELI5', color: 'var(--accent-2)' },
    { label: 'Explainer', count: fmt(c.explainer), hint: 'Sections, diagrams, glossary', color: 'var(--accent)' },
    { label: 'Interactive', count: c.interactive ? fmt(c.interactive) : '—', hint: 'Simulation or explorable', color: 'var(--ink)' },
  ];
  const fresh = site.newest.slice(0, 3);
  return html`<section class="at-cov">
<div class="at-panel at-goal">
<div class="at-row-between">${eyebrow('GOAL · EVERY RFC, EXPLAINED')}<a class="at-link" href="/coverage/">Coverage report →</a></div>
<div class="at-stat"><span class="at-stat-num">${pct1(cov, c.total)}</span><span class="at-stat-txt">of ${fmt(c.total)} RFCs have more than an index page</span></div>
<div class="at-bar at-bar-lg" role="img" aria-label="${pct1(cov, c.total)} covered"><span style="width:${w(c.explainer + c.interactive, c.total)};background:var(--accent)"></span><span style="width:${w(c.summary, c.total)};background:var(--accent-2)"></span></div>
<div class="at-ladder">${ladder.map((l) => html`<div class="at-step" style="border-top-color:${l.color}"><span class="at-step-num">${l.count}</span><span class="at-step-label">${l.label}</span><span class="at-step-hint">${l.hint}</span></div>`)}</div>
</div>
<div class="at-panel at-fresh">
<div class="at-row-between">${eyebrow('JUST PUBLISHED')}<a class="at-link" href="/feed.xml">Follow (RSS)</a></div>
<div class="at-fresh-list">${fresh.map((r) => html`<a class="at-fresh-row" href="${r.url}"><span class="at-fresh-n">RFC ${r.number}</span><span class="at-fresh-body"><span class="at-fresh-title">${r.title}</span><span class="at-fresh-meta">${MONTHS[r.month - 1]} ${r.year} · ${r.statusLabel} · ${r.tier} page</span></span></a>`)}</div>
<span class="at-note">New RFCs get an index page the day they're published — no manual step.</span>
</div>
</section>`;
}

function mapSection(site) {
  const c = site.counts;
  return html`<section class="at-map" id="map">
<div class="at-row-between at-head">
<div class="at-title">${eyebrow('THE ATLAS')}<h2 class="at-h2">Every RFC number, 1 – ${fmt(site.max)}</h2></div>
<div class="at-legend"><span><i style="background:var(--accent)"></i>Deep explainer · ${fmt(c.explainer + c.interactive)}</span><span><i style="background:var(--accent-2)"></i>Summary · ${fmt(c.summary)}</span><span><i style="background:var(--map-empty)"></i>Index page · metadata only</span></div>
</div>
<div class="at-chips" role="group" aria-label="Filter by area"><button type="button" class="at-chip" data-cat="" aria-pressed="true">All areas</button>${site.categories.map((k) => html`<button type="button" class="at-chip" data-cat="${k.key}" aria-pressed="false">${k.name}</button>`)}</div>
<div class="at-panel at-canvas-wrap">
<canvas class="at-canvas" id="atlas-map" tabindex="0" role="img" aria-label="Coverage map of every RFC number, one cell each. Focus the map, use the arrow keys to move between RFCs, and press Enter to open the selected RFC page." data-max="${site.max}"></canvas>
<noscript><p class="at-note">The interactive map needs JavaScript. <a href="/areas/">Browse every RFC by area instead.</a></p></noscript>
<div class="at-caption" aria-live="polite"><span><b class="at-cap-label">Hover the map</b> <span class="at-cap-detail">— dark cells have full explainers with diagrams and ELI5.</span></span><span class="at-cap-hint">each cell = one RFC · every cell is a page · click to open</span></div>
</div>
</section>`;
}

function rfcPath(j) {
  const seen = [];
  for (const s of j.steps || []) for (const r of s.rfcs || []) if (!seen.includes(r.number)) seen.push(r.number);
  return seen;
}

function journeys(site) {
  const list = site.journeys || [];
  const feat = list.find((j) => j.featured) || list[0];
  const others = list.filter((j) => j !== feat).slice(0, 4);
  const head = html`<div class="at-row-between at-head"><div class="at-title">${eyebrow('JOURNEYS')}<h2 class="at-h2">Start from a question, not a number</h2></div><a class="at-link at-link-lg" href="/journeys/">All journeys →</a></div>`;
  if (!feat) return html`<section class="at-journeys" id="journeys">${head}<p class="at-note">Journeys are on their way.</p></section>`;
  const steps = feat.steps || [];
  const featCard = html`<a class="at-feature" href="/journeys/${feat.slug}/">
<span class="at-feature-eyebrow">${steps.length} STEPS · ${rfcPath(feat).length} RFCS</span>
<span class="at-feature-title">${feat.title}</span>
<span class="at-feature-desc">${feat.description || ''}</span>
<span class="at-feature-steps">${steps.map((s, i) => html`<span class="at-jstep"><span class="at-jstep-n">${i + 1}</span><span class="at-jstep-title">${s.title}</span><span class="at-jstep-rfcs">${(s.rfcs || []).map((r) => r.number).join(' · ')}</span></span>`)}</span>
</a>`;
  const cards = others.map((j) => html`<a class="at-jcard" href="/journeys/${j.slug}/"><span class="at-jcard-meta">${(j.steps || []).length} STEPS · ${rfcPath(j).length} RFCS</span><span class="at-jcard-title">${j.title}</span><span class="at-jcard-path">${rfcPath(j).slice(0, 4).join(' → ')}</span></a>`);
  return html`<section class="at-journeys" id="journeys">${head}<div class="at-jgrid">${featCard}${cards}</div></section>`;
}

function areas(site) {
  const by = new Map(site.categories.map((k) => [k.key, { key: k.key, name: k.name, f: 0, s: 0, ex: [] }]));
  for (const r of site.rfcs.values()) {
    const a = by.get(r.category);
    if (!a || !covered(r)) continue;
    if (featured(r)) { a.f++; a.ex.push(r.shortTitle || r.title); } else a.s++;
  }
  const list = [...by.values()];
  const maxCov = Math.max(1, ...list.map((a) => a.f + a.s));
  return html`<section class="at-areas" id="areas">
<div class="at-title">${eyebrow('AREAS')}<h2 class="at-h2">Browse by what it does</h2></div>
<div class="at-agrid">${list.map((a) => html`<a class="at-acard" href="/areas/${a.key}/"><div class="at-row-between"><span class="at-acard-name">${a.name}</span><span class="at-acard-count">${a.f + a.s} covered</span></div><div class="at-bar"><span style="width:${w(a.f, maxCov)};background:var(--accent)"></span><span style="width:${w(a.s, maxCov)};background:var(--accent-2)"></span></div><span class="at-acard-ex">${a.ex.slice(0, 4).join(' · ') || '—'}</span></a>`)}</div>
</section>`;
}

function timeline(site) {
  const years = new Map();
  let maxYear = 1969;
  for (const r of site.rfcs.values()) {
    if (r.year > maxYear) maxYear = r.year;
    if (!covered(r)) continue;
    const y = years.get(r.year) || { f: 0, b: 0, nums: [] };
    if (featured(r)) y.f++; else y.b++;
    y.nums.push(r.number);
    years.set(r.year, y);
  }
  const maxY = Math.max(1, ...[...years.values()].map((y) => y.f + y.b));
  const cols = [];
  for (let yr = 1969; yr <= maxYear; yr++) {
    const v = years.get(yr) || { f: 0, b: 0, nums: [] };
    const nums = v.nums.sort((a, b) => a - b);
    const tip = `${yr}: ${v.f + v.b} RFCs` + (nums.length ? ` — ${nums.slice(0, 8).join(', ')}` : '');
    cols.push(html`<div class="at-tl-col" title="${tip}"><div class="at-tl-b" style="height:${w(v.b, maxY)}"></div><div class="at-tl-f" style="height:${w(v.f, maxY)}"></div></div>`);
  }
  const axis = [1969, 1980, 1990, 2000, 2010, maxYear];
  return html`<section class="at-timeline">
<div class="at-row-between at-head"><div class="at-title">${eyebrow('TIMELINE')}<h2 class="at-h2">Covered RFCs by year published</h2></div><span class="at-note">Hover a bar for the year’s RFCs</span></div>
<div class="at-panel at-tl-panel"><div class="at-tl">${cols}</div><div class="at-tl-axis">${axis.map((y) => html`<span>${y}</span>`)}</div></div>
</section>`;
}

function render(site) {
  const main = html`<div class="container container-atlas at-main">${hero()}${coverage(site)}${mapSection(site)}${journeys(site)}${areas(site)}${timeline(site)}</div>`;
  const doc = layout({
    title: 'rfc.akl.run — every RFC, explained',
    description: `Plain-language explainers, diagrams and simulations for the RFCs that built the Internet. A permanent page for every RFC number, 1–${site.max}.`,
    path: '/',
    palette: 'cool',
    header: 'site',
    container: 'atlas',
    active: 'atlas',
    main,
    head: raw(`<script>${HASH_FORWARDER}</script>`),
    scripts: ['atlas.js'],
  });
  return [{ path: 'index.html', html: doc }];
}

module.exports = { name: 'atlas', render, HASH_FORWARDER };
