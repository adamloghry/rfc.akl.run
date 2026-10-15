'use strict';
const { html, raw } = require('../lib/html');
const { layout } = require('../lib/layout');

const COPY = {
  'not-issued': {
    label: 'NEVER ISSUED',
    line: 'The RFC Editor skipped this number; no document was ever published under it.',
    title: 'never issued',
  },
  reserved: {
    label: 'NOT YET PUBLISHED',
    line: "This number is assigned but the RFC hasn't been published yet. Check back after the next nightly build.",
    title: 'not yet published',
  },
};

/** @param {number} number @param {'not-issued'|'reserved'} kind @param {import('../lib/model').Site} site @returns {string} */
function renderNotIssued(number, kind, site) {
  const c = COPY[kind];
  if (!c) throw new Error(`renderNotIssued: unknown kind ${kind}`);
  const max = site && site.max ? site.max : number;
  const prev = number > 1 ? number - 1 : null;
  const next = number < max ? number + 1 : null;
  const main = html`<div class="container container-index">
<div class="it-head" style="padding:48px 0 24px">
<span class="badge badge-solid mono">RFC ${number}</span>
<span class="badge badge-dashed">${c.label}</span>
<h1 class="ni-title" style="margin:20px 0 8px">RFC ${number} was ${c.title}</h1>
<p class="ni-line" style="color:var(--muted);max-width:60ch">${c.line}</p>
</div>
<nav class="ni-nav" aria-label="Neighbouring RFCs" style="display:flex;gap:16px;padding:16px 0 48px">
${prev ? raw(`<a href="/${prev}/" rel="prev">&larr; RFC ${prev}</a>`) : ''}
${next ? raw(`<a href="/${next}/" rel="next">RFC ${next} &rarr;</a>`) : ''}
<a href="/">Atlas</a>
</nav>
</div>`;
  return layout({
    title: `RFC ${number} (${c.title}) — rfc.akl.run`,
    description: `RFC ${number} was ${c.title}. ${c.line}`,
    path: `/${number}/`,
    palette: 'warm',
    header: 'reader',
    breadcrumb: [{ label: 'Index', href: '/areas/' }, { label: `RFC ${number}` }],
    main,
    head: raw('<meta name="rfc-tier" content="not-issued">'),
    robots: 'noindex, follow',
  });
}

module.exports = { renderNotIssued };
