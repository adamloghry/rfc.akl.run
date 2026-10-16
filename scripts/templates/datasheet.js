'use strict';
const { html, raw, esc, attrs } = require('../lib/html');
const { layout } = require('../lib/layout');
const { renderViz, vizScripts } = require('../lib/viz');
const cite = require('../lib/cite');
const areas = require('../lib/areas');
const graph = require('../lib/graph');

const MAX_REL = 10;

const displayTitle = (r) => {
  if (r.shortTitle && r.shortTitle !== r.title && !r.title.startsWith(r.shortTitle)) return `${r.shortTitle}: ${r.title}`;
  return r.title;
};
const shortLabel = (r) => r.shortTitle || r.title;
const plain = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const upper = (s) => String(s).toUpperCase();

function describe(rfc) {
  const c = rfc.content || {};
  const text = plain(c.summary) || plain(rfc.abstract) || displayTitle(rfc);
  return text.length > 200 ? text.slice(0, 197).replace(/\s+\S*$/, '') + '…' : text;
}

/** Links to RFCs, "RFC n — label", capped. */
function relLinks(nums, site) {
  const shown = nums.slice(0, MAX_REL);
  const links = shown.map((n) => {
    const r = site.rfcs.get(n);
    return html`<a href="/${n}/">RFC ${n}</a>${r ? ` — ${shortLabel(r)}` : ''}`;
  });
  const out = [];
  links.forEach((l, i) => { if (i) out.push(', '); out.push(l); });
  if (nums.length > shown.length) out.push(` and ${nums.length - shown.length} more`);
  return out;
}

function dlRow(label, value, mono) {
  return html`<dt>${label}</dt><dd${mono ? raw(' class="mono"') : ''}>${value}</dd>`;
}

/** Fact value: "RFC n" -> link to /n/ (only numbers in the index); the rest is escaped text. */
function factValue(v, site) {
  const out = String(v).split(/(\bRFC\s?\d+\b)/).map((part) => {
    const m = /^RFC\s?(\d+)$/.exec(part);
    if (m && site.rfcs.has(Number(m[1]))) return `<a href="/${Number(m[1])}/">${esc(part)}</a>`;
    return esc(part);
  });
  return raw(out.join(''));
}

const normFactLabel = (l) => String(l == null ? '' : l).toLowerCase().trim().replace(/\s+/g, ' ').replace(/s$/, '');
const ALWAYS_DUP = new Set(['published', 'date', 'author', 'authors', 'organization', 'org', 'stream', 'status', 'doi', 'errata'].map(normFactLabel));
/** Relation facts are hidden only when the matching computed row is rendered with entries. */
const relGroup = (rfc) => ({
  [normFactLabel('builds on')]: [...rfc.obsoletes, ...rfc.updates].length,
  [normFactLabel('obsoletes')]: [...rfc.obsoletes, ...rfc.updates].length,
  [normFactLabel('updates')]: [...rfc.obsoletes, ...rfc.updates].length,
  [normFactLabel('obsoleted by')]: rfc.obsoletedBy.length,
  [normFactLabel('superseded by')]: rfc.obsoletedBy.length,
  [normFactLabel('updated by')]: rfc.updatedBy.length,
});
const isDupFact = (f, rfc) => {
  const k = normFactLabel(f && f.label);
  return ALWAYS_DUP.has(k) || (rfc ? relGroup(rfc)[k] > 0 : false);
};

function metaList(rfc, site) {
  const c = rfc.content || {};
  const rows = [dlRow('PUBLISHED', rfc.dateLabel), dlRow('AUTHORS', rfc.authors.join(', '))];
  if (rfc.organization) rows.push(dlRow('ORG', rfc.organization));
  if (rfc.stream) rows.push(dlRow('STREAM', rfc.stream));
  const builds = [...rfc.obsoletes, ...rfc.updates];
  if (builds.length) rows.push(dlRow('BUILDS ON', relLinks(builds, site)));
  if (rfc.obsoletedBy.length) rows.push(dlRow('OBSOLETED BY', relLinks(rfc.obsoletedBy, site)));
  if (rfc.updatedBy.length) rows.push(dlRow('UPDATED BY', relLinks(rfc.updatedBy, site)));
  for (const f of (c.facts || []).filter((x) => !isDupFact(x, rfc))) rows.push(dlRow(upper(f.label), factValue(f.value, site), String(f.value).length <= 24 && !/\bRFC\s?\d+/.test(f.value)));
  if (rfc.doi) rows.push(dlRow('DOI', rfc.doi, true));
  if (rfc.errataUrl) rows.push(dlRow('ERRATA', html`<a href="${rfc.errataUrl}">Reported errata</a>`));
  return html`<dl class="meta-dl">${rows}</dl>`;
}

function lineageStrip(rfc, site) {
  const lin = graph.lineage(rfc, site);
  if (lin.items.length < 2) return '';
  const nodes = lin.items.map((n0) => { const n = { ...n0, current: n0.number === rfc.number }; return html`<a class="lin-node${n.current ? " is-current" : ""}" href="${n.url}"${n.current ? raw(' aria-current="page"') : ''}><span class="lin-dot">'${String(n.year % 100).padStart(2, '0')}</span><span class="lin-num">RFC ${n.number}</span><span class="lin-label">${n.label}</span></a>`; });
  return html`<div class="container container-reader lineage" aria-label="Lineage">
<div class="lineage-head"><span class="eyebrow">LINEAGE · ${!lin.title || lin.title === 'Lineage' ? 'FROM THE RFC INDEX' : upper(lin.title)}</span><a href="/graph/#${rfc.number}">Open full graph →</a></div>
<div class="lineage-scroll"><div class="lineage-rail" style="--n:${lin.items.length}">${nodes}</div></div>
</div>`;
}

function citeBlock(rfc) {
  const ed = cite.rfcEditor(rfc);
  const bib = cite.bibtex(rfc);
  return html`<div class="cite" id="cite" hidden>
<div class="cite-row"><span class="eyebrow">RFC EDITOR</span><button class="copy-btn" type="button" data-copy-target="#cite-rfced">COPY</button></div>
<p class="cite-text" id="cite-rfced">${ed}</p>
<div class="cite-row"><span class="eyebrow">BIBTEX</span><button class="copy-btn" type="button" data-copy-target="#cite-bibtex">COPY</button></div>
<pre class="cite-bib" id="cite-bibtex">${bib}</pre>
</div>`;
}

function obsoletedBanner(rfc, site) {
  if (!rfc.obsoletedBy.length) return '';
  const list = rfc.obsoletedBy.map((n) => site.rfcs.get(n)).filter(Boolean).sort(graph.byDate);
  const nums = list.length ? list.map((r) => r.number) : rfc.obsoletedBy;
  // newest by date; on a tie the lowest number (2616 -> 7230, not 7235)
  const newest = list.length ? list.reduce((a, b) => (graph.pubDate(b) > graph.pubDate(a) ? b : a)) : null;
  const links = nums.map((n) => {
    const r = site.rfcs.get(n);
    return html`<a href="/${n}/">RFC ${n}</a>${r ? `, ${r.dateLabel}` : ''}`;
  });
  const joined = [];
  links.forEach((l, i) => { if (i) joined.push('; '); joined.push(l); });
  const last = newest ? newest.number : nums[nums.length - 1];
  return html`<aside class="obs-banner" role="note"><strong>Obsoleted by</strong> ${joined}.
<span class="obs-help"><strong>Which version should I read?</strong> Start with <a href="/${last}/">RFC ${last}</a>${newest ? ` (${shortLabel(newest)})` : ''}; this page is kept for history.</span></aside>`;
}

function tldr(c) {
  const t = c.tldr;
  if (!t) return '';
  const cell = (label, text) => html`<div class="tldr-cell"><span class="eyebrow">${upper(label)}</span><span class="tldr-text">${text}</span></div>`;
  return html`<section class="tldr" id="tldr" aria-label="Summary">${cell('Problem', t.problem)}${cell('Mechanism', t.mechanism)}${cell(t.outcomeLabel || 'Outcome', t.outcome)}</section>`;
}

function renderSection(s, i, hasLevels, vizBySection) {
  const num = s.number || String(i + 1);
  const hasEli5 = !!s.eli5;
  const body = hasLevels && hasEli5
    ? html`<div class="prose" data-level="std">${raw(s.content || '')}</div><div class="prose eli5" data-level="eli5">${raw(s.eli5)}</div>`
    : html`<div class="prose">${raw(s.content || '')}</div>`;
  const vz = vizBySection.get(s.id) || { before: [], after: [] };
  return html`<section class="sec" id="${s.id}">
<h2><a class="sec-anchor" href="#${s.id}" aria-label="Permalink to section ${num}">§${num}</a>${s.title}</h2>
${vz.before}${body}${vz.after}
</section>`;
}

function references(c, site, n) {
  const refs = c.references || [];
  if (!refs.length) return '';
  const rows = refs.map((r) => {
    const m = r.rfc || (/RFC\s?(\d+)/.exec(r.text || '') || [])[1];
    const num = m ? Number(m) : null;
    const known = num ? site.rfcs.get(num) : null;
    const cells = html`<span class="ref-n">${r.number || ''}</span><span class="ref-rfc">${num ? `RFC ${num}` : ''}</span><span class="ref-text">${r.text}</span><span class="ref-date">${known ? known.dateLabel : ''}</span>`;
    return num && num <= site.max && !r.url
      ? html`<a class="ref-row" href="/${num}/">${cells}</a>`
      : html`<div class="ref-row">${cells}</div>`;
  });
  return html`<section class="sec" id="references">
<h2><a class="sec-anchor" href="#references" aria-label="Permalink to references">§${n}</a>References</h2>
<div class="refs">${rows}</div>
</section>`;
}

function rail(rfc, hasLevels, toc, permalink) {
  const c = rfc.content || {};
  const levelCtl = hasLevels ? html`<div class="rail-block level-ctl" hidden>
<span class="eyebrow">READING LEVEL</span>
<div class="seg" role="group" aria-label="Reading level">
<button type="button" data-set-level="eli5" aria-pressed="false">Like I'm 5<span>story</span></button>
<button type="button" data-set-level="std" aria-pressed="true">Explained<span>default</span></button>
</div></div>` : '';
  const items = toc.map((t) => html`<a href="#${t.id}" data-toc="${t.id}"><span class="toc-n">${t.n}</span>${t.title}</a>`);
  return html`<aside class="rail rail-left">
${levelCtl}
<nav class="toc" aria-label="On this page">${items}</nav>
<p class="permalink-note">Every heading, field and step has a permanent link: <code>rfc.akl.run/${rfc.number}/#${permalink}</code></p>
</aside>`;
}

function journeyCards(rfc, site) {
  return rfc.journeys.map((slug) => {
    const j = site.journeys.find((x) => x.slug === slug);
    if (!j) return '';
    const steps = j.steps || [];
    const all = new Set();
    steps.forEach((s) => (s.rfcs || []).forEach((r) => all.add(r.number)));
    const at = steps.findIndex((s) => (s.rfcs || []).some((r) => r.number === rfc.number));
    return html`<a class="jcard" href="/journeys/${slug}/"><span class="jcard-title">${j.title}</span><span class="jcard-meta">${all.size} RFCs${at >= 0 ? ` · step ${at + 1} of ${steps.length}` : ''}</span></a>`;
  });
}

function rightRail(rfc, site) {
  const c = rfc.content || {};
  const blocks = [];
  if (c.eli5 && c.eli5.summary) blocks.push(html`<div class="pullquote"><span class="eyebrow">ELI5</span><div class="pq-text">${raw(c.eli5.summary)}</div></div>`);
  if (c.today) blocks.push(html`<div class="rail-block"><span class="eyebrow">WHERE YOU'LL MEET IT TODAY</span><div class="rail-text">${raw(c.today)}</div></div>`);
  // Ids without a glossary entry would link to a missing anchor; skip them (lint reports them).
  const terms = (c.glossary || []).filter((id) => site.glossary.has(id)).map((id) => {
    const t = site.glossary.get(id);
    return html`<a class="chip" href="/glossary/#${id}">${t.term}</a>`;
  });
  if (terms.length) blocks.push(html`<div class="rail-block ruled"><span class="eyebrow">GLOSSARY ON THIS PAGE</span><div class="chips">${terms}</div></div>`);
  const cards = journeyCards(rfc, site);
  if (cards.length) blocks.push(html`<div class="rail-block ruled"><span class="eyebrow">PART OF JOURNEY</span>${cards}</div>`);
  if ((c.implementations || []).length) {
    const items = c.implementations.map((im) => html`<li>${im.url ? html`<a href="${im.url}">${im.name}</a>` : im.name}${im.note ? ` — ${im.note}` : ''}</li>`);
    blocks.push(html`<div class="rail-block ruled"><span class="eyebrow">IMPLEMENTATIONS</span><ul class="impl">${items}</ul></div>`);
  }
  if (rfc.mentionedIn.length) {
    const links = rfc.mentionedIn.slice(0, 8).map((n) => html`<a class="chip" href="/${n}/">RFC ${n}</a>`);
    blocks.push(html`<div class="rail-block ruled"><span class="eyebrow">MENTIONED IN</span><div class="chips">${links}</div></div>`);
  }
  if (c.provenance && c.provenance.source === 'llm-draft') {
    blocks.push(html`<p class="draft-note">Draft · machine-assisted, not yet reviewed</p>`);
  }
  return html`<aside class="rail rail-right">${blocks}</aside>`;
}

/** @param {import('../lib/model').RfcRecord} rfc @param {import('../lib/model').Site} site @returns {string} full HTML document */
function renderDatasheet(rfc0, site) {
  const c = rfc0.content || {};
  const sections = c.sections || [];
  const rfc = rfc0;
  const hasLevels = sections.some((s) => s.eli5);
  const n = rfc.number;
  const title = displayTitle(rfc);

  // viz grouped by anchor section; unmatched ones render before References
  const vizBySection = new Map();
  const orphans = [];
  const ids = new Set(sections.map((s) => s.id));
  for (const spec of c.viz || []) {
    const fig = renderViz(spec, rfc0);
    if (!ids.has(spec.anchor)) { orphans.push(fig); continue; }
    if (!vizBySection.has(spec.anchor)) vizBySection.set(spec.anchor, { before: [], after: [] });
    vizBySection.get(spec.anchor)[spec.position === 'before' ? 'before' : 'after'].push(fig);
  }

  const toc = sections.map((s, i) => ({ id: s.id, n: s.number || String(i + 1), title: s.title }));
  const refs = references(c, site, sections.length + 1);
  if (refs.toString()) toc.push({ id: 'references', n: String(sections.length + 1), title: 'References' });

  const firstViz = (c.viz || []).find((v) => v.type === 'packet' && ((v.data || v).fields || []).length);
  const permalink = firstViz ? `field-${(firstViz.data || firstViz).fields[0].key}` : (sections[0] ? sections[0].id : 'top');

  const tags = c.tags && c.tags.length ? c.tags.join(' · ') : areas.name(rfc.category);
  const badges = html`<div class="badges">
<span class="badge badge-solid">RFC ${n}</span>
<span class="${'badge badge-' + rfc.statusTone}">${upper(rfc.statusLabel)}</span>
<span class="badge badge-neutral">${upper(tags)}</span>
${rfc.isNew ? html`<span class="badge badge-new">NEW</span>` : ''}
</div>`;

  const subtitle = c.subtitle || (c.hero && c.hero.subtitle) || '';

  const band = html`<section class="band">
<div class="container container-reader band-grid">
<div class="band-main">
${badges}
<h1>${title}</h1>
${subtitle ? html`<p class="subtitle">${subtitle}</p>` : ''}
<div class="band-actions">
<button class="btn btn-solid" type="button" data-copy="https://rfc.akl.run/${n}/" data-copy-label="Copy link">Copy link</button>
<button class="btn" type="button" aria-expanded="false" aria-controls="cite" data-cite-toggle>Cite</button>
<a class="btn" href="https://www.rfc-editor.org/rfc/rfc${n}.html">Original text ↗</a>
</div>
${citeBlock(rfc)}
</div>
${metaList(rfc, site)}
</div>
${lineageStrip(rfc, site)}
</section>`;

  const tocDetails = html`<details class="toc-disclosure"><summary>On this page</summary><nav aria-label="On this page">${toc.map((t) => html`<a href="#${t.id}"><span class="toc-n">${t.n}</span>${t.title}</a>`)}</nav></details>`;

  const main = html`${band}
<div class="container container-reader body-grid">
${tocDetails}
${rail(rfc, hasLevels, toc, permalink)}
<div class="main-col">
${obsoletedBanner(rfc, site)}
${tldr(c)}
${sections.map((s, i) => renderSection(s, i, hasLevels, vizBySection))}
${orphans}
${refs}
</div>
${rightRail(rfc, site)}
</div>`;

  const prev = n > 1 ? html`<a href="/${n - 1}/">← RFC ${n - 1}</a>` : '';
  const next = n < site.max ? html`<a href="/${n + 1}/">RFC ${n + 1} →</a>` : '';
  const footer = html`<div class="rd-foot"><span><span class="rd-foot-n">RFC ${n}</span> — ${title}</span><div class="rd-foot-nav">${prev}${next}</div></div>`;

  const head = html`<meta name="rfc-tier" content="${rfc.tier}">
<noscript><style>#cite[hidden]{display:block}</style></noscript>`;

  return layout({
    title: `RFC ${n} — ${title} · rfc.akl.run`,
    description: describe(rfc),
    path: `/${n}/`,
    palette: 'warm',
    header: 'reader',
    breadcrumb: [{ label: areas.name(rfc.category), href: `/areas/${rfc.category}/` }, { label: `RFC ${n}` }],
    main, footer, head,
    scripts: ['reader.js', ...vizScripts(c.viz)],
    ogType: 'article',
  });
}

module.exports = {
  isDupFact, renderDatasheet };
