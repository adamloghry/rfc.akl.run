'use strict';
const { html } = require('../html');

function render(spec) {
  return html`<ul class="kg">${spec.items.map((it) => html`<li><span class="kg-t">${it.title}</span><span class="kg-d">${it.text}</span></li>`)}</ul>`;
}

module.exports = { render };
