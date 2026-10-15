'use strict';
const { html } = require('../html');

function render(spec) {
  return html`<ol class="tl">${spec.events.map((e) => html`<li><span class="tl-y">${e.year}</span><span class="tl-dot" aria-hidden="true"></span><span class="tl-l">${e.rfc ? html`<a href="/${e.rfc}/">${e.label}</a>` : e.label}</span>${e.rfc ? html`<span class="tl-r">RFC ${e.rfc}</span>` : ''}</li>`)}</ol>`;
}

module.exports = { render };
