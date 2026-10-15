'use strict';
const { html, raw, attrs, esc } = require('../html');

// Each renderer exports render(spec, ctx) -> SafeHtml (the figure's inner HTML).
// ctx = { rfc, id, index, hasSim }.
const RENDERERS = {
  packet: require('./packet'),
  'sequence-sim': require('./sequence-sim'),
  sequence: require('./sequence'),
  'compare-table': require('./compare-table'),
  contrast: require('./contrast'),
  'key-grid': require('./key-grid'),
  layers: require('./layers'),
  timeline: require('./timeline'),
  'state-machine': require('./state-machine'),
  tree: require('./tree'),
  opcodes: require('./opcodes'),
  code: require('./code'),
};

const vizList = (rfc) => (rfc && rfc.content && Array.isArray(rfc.content.viz) ? rfc.content.viz : []);

// Content JSON (C7) nests type fields under `data`; accept that and the flat form.
function normalize(spec) {
  if (!spec || !spec.data || typeof spec.data !== 'object') return spec;
  const out = { ...spec.data, type: spec.type };
  if (spec.id !== undefined) out.id = spec.id;
  const cap = spec.caption !== undefined ? spec.caption : spec.data.caption;
  if (cap !== undefined) out.caption = cap;
  if (spec.anchor !== undefined) out.anchor = spec.anchor;
  return out;
}

/** @param {{type: string, [k: string]: any}} spec @param {import('../model').RfcRecord} rfc
 *  @returns {import('../html').SafeHtml} */
function renderViz(rawSpec, rfc) {
  const spec = normalize(rawSpec);
  const renderer = spec && Object.prototype.hasOwnProperty.call(RENDERERS, spec.type) ? RENDERERS[spec.type] : null;
  if (!renderer) throw new Error(`unknown viz type: ${spec && spec.type}`);
  const list = vizList(rfc);
  const found = list.indexOf(rawSpec);
  const index = found >= 0 ? found : 0;
  const id = spec.id || `${spec.type}-${index}`;
  const hasSim = list.some((v) => v && v.type === 'sequence-sim');
  const inner = renderer.render(spec, { rfc, id, index, hasSim });
  return html`<figure${attrs({ class: `viz viz-${spec.type}`, id, 'data-viz': spec.type })}>${spec.caption && spec.type !== 'packet' && spec.type !== 'sequence-sim' ? html`<figcaption class="viz-cap">${spec.caption}</figcaption>` : ''}${inner}</figure>`;
}

/** @param {object[]|{viz?: object[]}|null} specs viz specs, or a content object with .viz
 *  @returns {string[]} asset script names the viz blocks need */
function vizScripts(specs) {
  const list = Array.isArray(specs) ? specs : specs && Array.isArray(specs.viz) ? specs.viz : [];
  const types = new Set(list.filter(Boolean).map((s) => normalize(s).type));
  const out = [];
  // packet.js also wires the COPY button of `code` blocks.
  if (types.has('packet') || types.has('code')) out.push('packet.js');
  if (types.has('sequence-sim')) out.push('sim.js');
  return out;
}

module.exports = { renderViz, vizScripts };
