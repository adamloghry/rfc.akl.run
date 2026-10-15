'use strict';
const { html, raw } = require('../lib/html');
const { layout } = require('../lib/layout');

const letterOf = (t) => { const c = t.term.trim()[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };

module.exports = {
  name: 'glossary',
  render(site) {
    const terms = [...site.glossary.values()].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
    const letters = [...new Set(terms.map(letterOf))].sort();
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const jump = [...alpha, '#'].map((l) => (letters.includes(l) ? html`<a href="#letter-${l}">${l}</a>` : html`<span aria-hidden="true">${l}</span>`));
    const body = letters.map((l) => html`<section class="gloss-group" id="letter-${l}"><h2 class="gloss-letter">${l}</h2><dl>${terms.filter((t) => letterOf(t) === l).map((t) => {
      const used = [...new Set([...(t.rfcs || []), ...(t.usedBy || [])])].sort((a, b) => a - b);
      return html`<div class="gloss-entry"><dt id="${t.id}">${t.term}</dt><dd>${raw(t.definition || '')}
${t.eli5 ? html`<p class="gloss-eli5"><span class="eyebrow">Like I'm five</span> ${t.eli5}</p>` : ''}
${used.length ? html`<p class="gloss-used"><span class="eyebrow">Used in</span> ${used.map((n) => html`<a class="rfc-chip mono" href="/${n}/">RFC ${n}</a> `)}</p>` : ''}</dd></div>`;
    })}</dl></section>`);
    const main = html`<div class="container container-index prose-page">
<p class="eyebrow">Reference</p>
<h1 class="page-title">Glossary</h1>
<p class="page-lede serif">${terms.length} terms, in plain language.</p>
<nav class="jump-bar" aria-label="Jump to letter">${jump}</nav>
${body}
</div>`;
    return [{
      path: 'glossary/index.html', sitemap: true,
      html: layout({ title: 'Glossary · rfc.akl.run', description: 'Networking terms from the RFCs, explained in plain language.', path: '/glossary/', palette: 'warm', header: 'reader', breadcrumb: [{ label: 'Glossary' }], main, searchable: true, pagefindMeta: { tier: 'glossary', title: 'Glossary' } }),
    }];
  },
};
