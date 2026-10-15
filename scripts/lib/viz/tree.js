'use strict';
const { html } = require('../html');

function node(n) {
  return html`<li><span class="tr-l">${n.label}</span>${n.note ? html` <span class="tr-n">${n.note}</span>` : ''}${n.children && n.children.length ? html`<ul>${n.children.map(node)}</ul>` : ''}</li>`;
}

function render(spec) {
  return html`<ul class="tr">${node(spec.root)}</ul>`;
}

module.exports = { render };
