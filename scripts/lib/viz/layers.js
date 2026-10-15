'use strict';
const { html, attrs } = require('../html');

function render(spec) {
  return html`<ol class="ly">${spec.layers.map((l) => html`<li${attrs({ class: l.highlight ? 'is-hl' : null })}><span class="ly-l">${l.label}</span><span class="ly-d">${l.detail}</span></li>`)}</ol>`;
}

module.exports = { render };
