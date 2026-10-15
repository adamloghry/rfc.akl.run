'use strict';
const { html } = require('../html');

const side = (s, cls) => html`<div class="ct-side ${cls}"><span class="ct-title">${s.title}</span><span class="ct-flow">${s.from} → <span class="ct-to">${s.to}</span></span><span class="ct-desc">${s.desc}</span></div>`;

function render(spec) {
  return html`<div class="viz-card is-flush ct">${side(spec.left, 'is-left')}<div class="ct-joiner">${String(spec.joiner || 'inverse of').toUpperCase()}</div>${side(spec.right, 'is-right')}</div>`;
}

module.exports = { render };
