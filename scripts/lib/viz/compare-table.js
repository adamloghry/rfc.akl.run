'use strict';
const { html, attrs } = require('../html');

function render(spec) {
  return html`<div class="cmp"><table class="cmp-table"><thead><tr>${spec.columns.map((c) => html`<th scope="col">${c}</th>`)}</tr></thead><tbody>${spec.rows.map((r) => html`<tr${attrs({ class: r.self ? 'is-self' : null })}>${r.cells.map((c, i) => (i === 0 ? html`<th scope="row">${c}${r.self ? html` <span class="cmp-self">THIS RFC</span>` : ''}</th>` : html`<td>${c}</td>`))}</tr>`)}</tbody></table></div>`;
}

module.exports = { render };
