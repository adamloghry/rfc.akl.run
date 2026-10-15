'use strict';
const { html, attrs } = require('../html');

function render(spec) {
  return html`<ul class="oc">${spec.items.map((o) => html`<li${attrs({ class: o.highlight ? 'is-hl' : null })}><span class="oc-c">${o.code}</span><span class="oc-t">${o.label}${o.desc ? html` — ${o.desc}` : ''}</span></li>`)}</ul>`;
}

module.exports = { render };
