'use strict';
const { html, raw, esc } = require('../lib/html');
const { layout } = require('../lib/layout');
const areas = require('../lib/areas');

const REPO = 'https://github.com/adamloghry/rfc.akl.run';
const CAP = 12; // max relation links shown per list ("and N more" links to the graph)
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TIER_LEVEL = { index: 1, summary: 2, explainer: 3, interactive: 4 };
const LADDER = [
  ['Index page', 'Metadata, lineage and backlinks from rfc-index.xml.'],
  ['Summary', 'Plain-language abstract and a one-paragraph ELI5. Small PR.'],
  ['Explainer', 'Sections, glossary terms and at least one diagram.'],
  ['Interactive', 'A simulation or explorable built from the shared viz library.'],
];

const hasExplainer = (r) => !!r && (r.tier === 'explainer' || r.tier === 'interactive');
const plain = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Inline links "RFC 1, RFC 2 … and N more" (numbers only, optional title when few). */
function relLinks(nums, rfc, site, withTitles) {
  const shown = nums.slice(0, CAP).map((n) => {
    const t = withTitles && site.rfcs.get(n);
    return html`<a href="/${n}/">RFC ${n}</a>${t ? ` — ${t.shortTitle || t.title}` : ''}`;
  });
  const out = [];
  shown.forEach((s, i) => { if (i) out.push(', '); out.push(s); });
  if (nums.length > CAP) out.push(html`, <a href="/graph/#${rfc.number}">and ${nums.length - CAP} more</a>`);
  return html`${out}`;
}

/** Lineage cell items: one block per RFC (titles, "has explainer"), capped. */
function cellItems(nums, rfc, site) {
  const items = nums.slice(0, CAP).map((n) => {
    const t = site.rfcs.get(n);
    return html`<a class="it-n" href="/${n}/"><b>RFC ${n}</b>${t ? html` ${t.shortTitle || t.title}` : ''}${hasExplainer(t) ? html` · has explainer` : ''}</a>`;
  });
  if (nums.length > CAP) items.push(html`<a class="it-n" href="/graph/#${rfc.number}">and ${nums.length - CAP} more →</a>`);
  return html`${items}`;
}

const uniq = (a) => [...new Set(a)];

function lineage(rfc, site) {
  const left = uniq([...rfc.obsoletes, ...rfc.updates]);
  const right = uniq([...rfc.obsoletedBy, ...rfc.updatedBy]);
  const lLabel = rfc.obsoletes.length && rfc.updates.length ? 'OBSOLETES / UPDATES' : rfc.obsoletes.length ? 'OBSOLETES' : 'UPDATES';
  return html`<section class="it-sec" data-pagefind-ignore>
<div class="it-row"><span class="it-eye">LINEAGE · GENERATED FROM RFC-INDEX.XML</span><a class="it-sm" href="/graph/#${rfc.number}">Open full graph →</a></div>
<div class="it-lin">
<div class="it-c"><span class="it-eye">${lLabel}</span>${left.length ? cellItems(left, rfc, site) : html`<span class="it-none">None</span>`}</div>
<div class="it-me">${rfc.number}</div>
<div class="it-c"><span class="it-eye">UPDATED / OBSOLETED BY</span>${right.length ? cellItems(right, rfc, site) : html`<span class="it-none">None — current</span>`}</div>
</div>
</section>`;
}

function dlRow(k, v) {
  return html`<dt>${k}</dt><dd>${v}</dd>`;
}

function facts(rfc, site) {
  const stream = [rfc.stream, rfc.wg].filter(Boolean).join(' · ');
  const rows = [
    dlRow('PUBLISHED', rfc.dateLabel),
    dlRow(rfc.authors.length > 1 ? 'AUTHORS' : 'AUTHOR', rfc.authors.join(', ')),
  ];
  if (stream) rows.push(dlRow('STREAM', stream));
  if (!rfc.categoryReviewed) {
    rows.push(dlRow('AREA (GUESSED)', html`<a href="/areas/${rfc.category}/">${areas.name(rfc.category)}</a> <span class="it-mono">· from IETF area, unreviewed</span>`));
  }
  if (rfc.obsoletes.length) rows.push(dlRow('OBSOLETES', relLinks(rfc.obsoletes, rfc, site, rfc.obsoletes.length <= 2)));
  if (rfc.updates.length) rows.push(dlRow('UPDATES', relLinks(rfc.updates, rfc, site, rfc.updates.length <= 2)));
  if (rfc.doi) rows.push(dlRow('DOI', html`<span class="it-mono">${rfc.doi}</span>`));
  return html`<dl class="it-dl">${rows}</dl>`;
}

function ladder(rfc) {
  const reached = TIER_LEVEL[rfc.tier] || 1;
  const cells = LADDER.map(([label, hint], i) => {
    const done = i < reached, next = i === reached;
    return html`<div class="${next ? 'it-cell it-next' : 'it-cell'}"><div class="it-ch"><span class="${done ? 'it-dot it-done' : next ? 'it-dot it-nx' : 'it-dot'}">${done ? '✓' : String(i + 1)}</span><b>${label}</b></div><span>${hint}</span></div>`;
  });
  return html`<section class="it-sec" data-pagefind-ignore>
<div class="it-row"><span class="it-eye">COVERAGE FOR THIS RFC</span>${rfc.demand > 0 ? html`<span class="it-sm">${rfc.demand} ${rfc.demand === 1 ? 'reader' : 'readers'} requested an explainer · counted daily</span>` : ''}</div>
<div class="it-lad">${cells}</div>
</section>`;
}

function starterUrl(rfc) {
  const starter = { number: rfc.number, category: rfc.category, summary: '', eli5: { summary: '' }, questions: [] };
  const file = rfc.number + '.json';
  return `${REPO}/new/trunk/content/rfcs?filename=${file}&value=${encodeURIComponent(JSON.stringify(starter))}`;
}

function help(rfc) {
  const n = rfc.number;
  const req = `${REPO}/issues/new?template=request.yml&title=Explainer%20request%3A%20RFC%20${n}`;
  return html`<div class="it-box it-dash"><span class="it-eye">${rfc.tier === 'index' && rfc.isNew ? 'HELP COVER IT' : 'NO EXPLAINER YET'}</span>
<p>Explainers are JSON files in the repo, so anyone can add one by pull request. Requests are counted from GitHub reactions at build time.</p>
<div class="it-links"><a href="${starterUrl(rfc)}">Start the explainer ↗</a><a href="${req}">Request an explainer ↗</a><a href="/contribute/">How explainers work</a></div></div>`;
}

function mentioned(rfc, site) {
  const rows = rfc.mentionedIn.slice(0, CAP).map((n) => {
    const t = site.rfcs.get(n);
    return html`<a href="/${n}/"><span>${t ? t.shortTitle || t.title : `RFC ${n}`}</span><i>${n}</i></a>`;
  });
  for (const slug of rfc.journeys || []) {
    const j = (site.journeys || []).find((x) => x.slug === slug);
    if (j) rows.push(html`<a href="/journeys/${slug}/"><span>Journey · ${j.title}</span><i>journey</i></a>`);
  }
  if (rfc.mentionedIn.length > CAP) rows.push(html`<a href="/graph/#${rfc.number}"><span>and ${rfc.mentionedIn.length - CAP} more</span><i>→</i></a>`);
  if (!rows.length) return '';
  return html`<div class="it-box it-ment"><span class="it-eye">MENTIONED IN</span>${rows}</div>`;
}

function renderIndexTier(rfc, site) {
  const n = rfc.number;
  const summary = rfc.tier === 'summary' && rfc.content && rfc.content.summary;
  const eli5 = summary && rfc.content.eli5 && rfc.content.eli5.summary;
  const draft = rfc.content && rfc.content.provenance && rfc.content.provenance.source === 'llm-draft';
  const absParas = rfc.abstract ? rfc.abstract.split(/\n\n+/).map((p) => html`<p>${p}</p>`) : [];
  const tone = rfc.statusTone === 'green' ? 'badge-green' : rfc.statusTone === 'amber' ? 'badge-amber' : 'badge-neutral';
  const monoNote = summary
    ? (draft ? 'Draft · machine-assisted, not yet reviewed · no explainer yet' : 'Summary written for rfc.akl.run · no explainer yet')
    : (rfc.abstract ? 'Abstract from the RFC Editor index · no summary yet' : 'No abstract in the RFC Editor index · no summary yet');
  const noAbs = !summary && !rfc.abstract;
  const auto = !summary
    ? (noAbs
      ? "This page was generated automatically from the RFC Editor index. The index has no abstract for this RFC; read the original for details."
      : rfc.isNew
        ? "This page was generated automatically when the RFC was published. Below is the authors' abstract. A plain-language summary hasn't been written yet."
        : "This page was generated automatically from the RFC Editor index. Below is the authors' abstract. A plain-language summary hasn't been written yet.")
    : '';
  const questions = (rfc.content && rfc.content.questions) || [];
  const ob = rfc.obsoletedBy;
  const title = rfc.title;
  const metaTitle = rfc.shortTitle ? `${rfc.shortTitle}: ${title}` : title;
  const desc = plain(summary || rfc.abstract || title).slice(0, 200);

  const mainHtml = html`<div class="it container container-index">
${ob.length ? html`<div class="it-warn" role="note"><b>Obsoleted</b> by ${relLinks(ob, rfc, site, false)}. Prefer the newer RFC.</div>` : ''}
<section class="it-hero">
<div class="it-main">
<div class="it-badges"><span class="badge badge-solid">RFC ${n}</span><span class="badge ${tone}">${rfc.statusLabel.toUpperCase()}</span><span class="badge badge-dashed">${rfc.tier === 'index' ? 'INDEX PAGE' : 'SUMMARY'}</span>${rfc.isNew ? html`<span class="badge badge-new">NEW · ${MONTHS[rfc.month - 1]} ${rfc.year}</span>` : ''}</div>
<h1 class="it-h1">${title}</h1>
${auto ? html`<div class="it-auto it-dash"><b>AUTO</b><span>${auto}</span></div>` : ''}
${summary ? html`<div class="it-lede">${raw(summary)}</div>` : absParas.length ? html`<div class="it-lede">${absParas}</div>` : ''}
<span class="it-mono">${monoNote}</span>
${eli5 ? html`<div class="it-eli5"><span class="it-eye">Like I'm 5</span>${raw(eli5)}</div>` : ''}
${summary && absParas.length ? html`<div class="it-abs"><span class="it-eye">AUTHORS' ABSTRACT</span>${absParas}</div>` : ''}
<div class="it-btns"><a class="btn btn-solid" href="https://www.rfc-editor.org/rfc/rfc${n}.html">Read the RFC ↗</a><a class="btn" href="https://datatracker.ietf.org/doc/rfc${n}/">Datatracker ↗</a></div>
</div>
${facts(rfc, site)}
</section>
${lineage(rfc, site)}
<section class="it-two" data-pagefind-ignore>${mentioned(rfc, site)}${help(rfc)}</section>
${ladder(rfc)}
${questions.length ? html`<div class="visually-hidden" data-pagefind-weight="8">${questions.map((q) => html`<p>${q}</p>`)}</div>` : ''}
</div>`;

  const pn = html`<span>rfc.akl.run/${n}/</span><span class="it-pn">${n > 1 ? html`<a href="/${n - 1}/">← RFC ${n - 1}</a>` : ''}${n < site.max ? html`<a href="/${n + 1}/">RFC ${n + 1} →</a>` : ''}</span>`;

  return layout({
    title: `RFC ${n} — ${rfc.shortTitle || title} · rfc.akl.run`,
    description: desc,
    path: `/${n}/`,
    palette: 'warm',
    header: 'reader',
    container: 'index',
    breadcrumb: [{ label: areas.name(rfc.category), href: `/areas/${rfc.category}/` }, { label: `RFC ${n}` }],
    main: mainHtml,
    footer: pn,
    head: raw(`<meta name="rfc-tier" content="${esc(rfc.tier)}">`),
    ogType: 'article',
    searchable: true,
    pagefindMeta: { number: n, tier: rfc.tier, title: metaTitle },
  });
}

module.exports = { renderIndexTier };
