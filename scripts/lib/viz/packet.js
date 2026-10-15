'use strict';
const { html, attrs } = require('../html');

const sizeLabel = (bits) => (bits % 8 === 0 ? `${bits / 8} byte${bits === 8 ? '' : 's'}` : `${bits} bits`);

// Split a display value across fragments, proportionally to bit counts, on
// ":" / "." separators ("08:00:20:01:AB:C2" -> "08:00:20:01" + ":AB:C2").
function splitValue(value, fragBits, totalBits) {
  const s = String(value ?? '');
  if (fragBits.length === 1) return [s];
  const parts = s.split(/(?=[:.])/);
  if (parts.length < fragBits.length) return [s, ...fragBits.slice(1).map(() => '')];
  const out = [];
  let used = 0;
  let acc = 0;
  for (let i = 0; i < fragBits.length; i++) {
    acc += fragBits[i];
    const upto = i === fragBits.length - 1 ? parts.length : Math.round((parts.length * acc) / totalBits);
    out.push(parts.slice(used, upto).join(''));
    used = upto;
  }
  return out;
}

function valueFor(field, modeKey) {
  if (field.values && modeKey && field.values[modeKey] !== undefined) return field.values[modeKey];
  if (field.value !== undefined) return field.value;
  if (field.values) return Object.values(field.values)[0];
  return '';
}

/** Lay fields out on a `width`-column grid; wide fields split across rows. */
function layout(fields, width) {
  const frags = [];
  let col = 0;
  for (const f of fields) {
    let left = f.bits;
    const fragBits = [];
    while (left > 0) {
      const take = Math.min(left, width - col);
      fragBits.push(take);
      left -= take;
      col = (col + take) % width;
    }
    fragBits.forEach((bits, i) => frags.push({ field: f, bits, part: i, parts: fragBits.length, fragBits }));
  }
  return frags;
}

function changedMode(field, modes) {
  if (!field.values || modes.length < 2) return null;
  const base = String(valueFor(field, modes[0].key));
  const diff = modes.slice(1).find((m) => String(valueFor(field, m.key)) !== base);
  return diff ? diff.key : null;
}

function render(spec, ctx) {
  const width = spec.width || 32;
  const modes = spec.modes && spec.modes.length ? spec.modes : [];
  const modeKeys = modes.length ? modes : [{ key: '', label: '' }];
  const frags = layout(spec.fields, width);

  const cellValues = new Map(); // field.key -> {modeKey: string[] per fragment}
  for (const f of spec.fields) {
    const m = {};
    for (const mk of modeKeys) m[mk.key] = splitValue(valueFor(f, mk.key), layout([f], width).map((x) => x.bits), f.bits);
    cellValues.set(f.key, m);
  }

  const ruler = [];
  for (let b = 0; b < width; b += 8) ruler.push(html`<span style="grid-column:span 8">${b}</span>`);

  const cells = frags.map((fr) => {
    const f = fr.field;
    const changed = changedMode(f, modes);
    const label = (f.label || f.key.toUpperCase()) + (fr.part > 0 ? ' (cont.)' : '');
    const vals = cellValues.get(f.key);
    return html`<a${attrs({
      class: 'pk-cell',
      href: `#field-${f.key}`,
      id: fr.part === 0 ? `field-${f.key}` : null,
      'data-key': f.key,
      'data-changed': changed,
      'data-name': f.name,
      'data-desc': f.desc,
      'data-size': sizeLabel(f.bits),
      style: `grid-column:span ${fr.bits}`,
    })}><span class="pk-k">${label}</span>${modeKeys.map((mk, i) => html`<span${attrs({ class: 'pk-v', 'data-mode-val': mk.key || null, hidden: i > 0 })}>${vals[mk.key][fr.part]}</span>`)}</a>`;
  });

  const showSeg = modes.length > 1;
  const header = html`<figcaption class="viz-cap viz-cap-bar"><span class="viz-eyebrow">${spec.caption || (spec.title ? `${spec.title}${spec.bytes ? ` · ${spec.bytes} bytes` : ''}` : '')}</span>${showSeg ? html`<div class="viz-seg" role="group" aria-label="Packet variant" hidden>${modes.map((m, i) => html`<button${attrs({ type: 'button', 'data-mode': m.key, 'aria-pressed': i === 0 ? 'true' : 'false' })}>${m.label}</button>`)}</div>` : ''}</figcaption>`;

  const table = html`<table class="viz-packet-table"><caption class="visually-hidden">${spec.title || 'Packet fields'}</caption><thead><tr><th scope="col">Field</th><th scope="col">Name</th><th scope="col">Size</th>${modes.length ? modes.map((m) => html`<th scope="col">${m.label}</th>`) : html`<th scope="col">Value</th>`}<th scope="col">Description</th></tr></thead><tbody>${spec.fields.map((f) => html`<tr><th scope="row"><code>${f.key.toUpperCase()}</code></th><td>${f.name}</td><td>${sizeLabel(f.bits)}</td>${modeKeys.map((mk) => html`<td>${valueFor(f, mk.key)}</td>`)}<td>${f.desc}</td></tr>`)}</tbody></table>`;

  return html`${header}<div${attrs({ class: 'pk-body', 'data-mode': modes.length ? modes[0].key : null, 'data-width': width })}><div class="pk-scroll"><div class="pk-ruler" style="--cols:${width}">${ruler}</div><div class="pk-grid" style="--cols:${width}">${cells}</div></div></div><div class="pk-inspector" aria-live="polite" hidden><span class="pk-i-name"></span><span class="pk-i-desc"></span><span class="pk-i-size"></span></div>${table}`;
}

module.exports = { render, layout, splitValue };
