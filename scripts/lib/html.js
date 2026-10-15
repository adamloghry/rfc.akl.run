'use strict';
// Tagged template that escapes every interpolation unless it is a SafeHtml
// (returned by html`` or raw()). Arrays are flattened and joined with ''.
// null/undefined/false/true render as ''.

class SafeHtml {
  constructor(s) { this.value = s; }
  toString() { return this.value; }
}

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]);
}

function raw(s) {
  return new SafeHtml(String(s ?? ''));
}

function render(v) {
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === null || v === undefined || typeof v === 'boolean') return '';
  return esc(v);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

function attrs(obj) {
  let out = '';
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined || v === false) continue;
    out += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return raw(out);
}

module.exports = { SafeHtml, esc, raw, html, attrs };
