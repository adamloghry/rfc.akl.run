'use strict';
const { html, raw, attrs } = require('../html');

// JSON for a <script type="application/json"> block. "</" and "<!" can never
// terminate or double-escape the script element.
function safeJson(data) {
  return JSON.stringify(data).replace(/<\//g, '<\\/').replace(/<(?=[a-zA-Z!?])/g, '\\u003c');
}

function stepItem(s, id) {
  return html`<li${attrs({ id })}><h4>${s.title}</h4>${s.tag ? html`<span class="sim-tag">${s.tag}</span>` : ''}<p>${s.spec}</p>${s.why ? html`<p class="sim-why"><strong>Why:</strong> ${s.why}</p>` : ''}</li>`;
}

function render(spec, ctx) {
  const rfcNumber = ctx.rfc && ctx.rfc.number;
  const t = spec.table;
  const table = t ? html`<table class="sim-table"><caption>${t.title}${t.caption ? html` <code>${t.caption}</code>` : ''}</caption><thead><tr>${t.columns.map((c) => html`<th scope="col">${c}</th>`)}</tr></thead><tbody>${t.rows.map((r, i) => html`<tr${attrs({ class: i === t.matchRow ? 'is-match' : null })}>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody></table>` : '';
  const replaced = spec.replacedBy && spec.replacedBy.length ? html`<div class="sim-replaced"><h4>What replaced it</h4><ul>${spec.replacedBy.map((r) => html`<li><a href="/${r.number}/">${r.label} · RFC ${r.number}</a></li>`)}</ul>${spec.replacedNote ? html`<p>${spec.replacedNote}</p>` : ''}</div>` : '';
  const failure = spec.failureSteps && spec.failureSteps.length ? html`<h4 class="sim-fail-h">${spec.router ? `Failure branch: with the server behind a ${String(spec.router.label || 'router').toLowerCase()}` : 'Failure branch'}</h4><ol class="sim-steps sim-failure-steps">${spec.failureSteps.map((s, i) => stepItem(s, `fail-${i + 1}`))}</ol>` : '';

  return html`<figcaption class="viz-cap viz-cap-bar"><span class="viz-eyebrow">${spec.caption || 'simulation'}</span></figcaption><div${attrs({ class: 'sim', 'data-rfc': rfcNumber })}><div class="sim-fallback"><h3 class="sim-title">${spec.title}</h3><ol class="sim-steps">${spec.steps.map((s, i) => stepItem(s, `step-${i + 1}`))}</ol>${failure}${table}${replaced}</div><script type="application/json" class="sim-data">${raw(safeJson(spec))}</script></div>`;
}

module.exports = { render, safeJson };
