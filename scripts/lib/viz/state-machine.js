'use strict';
const { html, attrs } = require('../html');

function render(spec) {
  const label = (k) => (spec.states.find((s) => s.key === k) || { label: k }).label;
  return html`<div class="viz-card"><ul class="sm-states">${spec.states.map((s) => html`<li${attrs({ class: `sm-state${s.initial ? ' is-initial' : ''}${s.final ? ' is-final' : ''}` })}>${s.label}${s.initial ? html` <span class="sm-flag">start</span>` : ''}${s.final ? html` <span class="sm-flag">end</span>` : ''}</li>`)}</ul><table class="sm-table"><thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Event</th></tr></thead><tbody>${spec.transitions.map((t) => html`<tr><td>${label(t.from)}</td><td>${label(t.to)}</td><td>${t.label}</td></tr>`)}</tbody></table></div>`;
}

module.exports = { render };
