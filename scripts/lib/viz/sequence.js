'use strict';
const { html, attrs } = require('../html');

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const circled = (n) => CIRCLED[n - 1] || `(${n})`;

function render(spec, ctx) {
  const lanes = spec.lanes;
  const n = lanes.length;
  const idx = (k) => {
    const i = lanes.findIndex((l) => l.key === k);
    if (i < 0) throw new Error(`sequence viz: unknown lane key "${k}"`);
    return i;
  };
  const cells = () => lanes.map((l, i) => html`<span${attrs({ class: `seq-lane${l.dashed ? ' is-dashed' : ''}`, style: `grid-column:${i + 1}` })}></span>`);

  const rows = spec.messages.map((m, i) => {
    const a = idx(m.from), b = idx(m.to);
    const num = i + 1;
    const stepId = ctx.hasSim ? null : `step-${num}`;
    const color = m.color || 'neutral';
    const label = html`<span${attrs({ id: stepId, class: 'seq-label' })}><span class="seq-n" aria-hidden="true">${circled(num)}</span> ${m.label}</span>`;
    if (a === b) {
      return html`<li class="seq-row is-chip">${cells()}<div class="seq-msg" style="grid-column:${a + 1}"><span class="seq-chip">${label}</span>${m.note ? html`<span class="seq-note">${m.note}</span>` : ''}</div></li>`;
    }
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return html`<li class="seq-row">${cells()}<div${attrs({ class: `seq-msg is-${color}`, 'data-dir': b > a ? 'ltr' : 'rtl', style: `grid-column:${lo + 1} / ${hi + 2};--span:${hi - lo + 1}` })}>${label}<span class="seq-arrow" aria-hidden="true"></span>${m.note ? html`<span class="seq-note">${m.note}</span>` : ''}</div></li>`;
  });

  return html`<div class="viz-card"><div class="seq-head" style="--n:${n}">${lanes.map((l) => html`<span${attrs({ class: l.dashed ? 'is-dim' : null })}>${l.label}</span>`)}</div><ol class="seq-body" style="--n:${n}">${rows}</ol></div>`;
}

module.exports = { render };
