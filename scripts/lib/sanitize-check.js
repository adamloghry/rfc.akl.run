'use strict';
/**
 * Allowlist validator for the HTML fragments that content JSON is allowed to
 * carry (rendered with raw() by the templates). Used by lint-content.js and,
 * independently, by the build (model.js) so skipping lint cannot ship unsafe
 * markup. checkHtml(str) -> string[] of problems (empty = safe).
 *
 * Text is never inspected; only tags are. A '<' that is not followed by a
 * letter, '/', '!' or '?' is plain text (browsers parse it that way too).
 */

const TAGS = new Set(('p a em strong b i code pre ul ol li br sup sub abbr kbd blockquote h3 h4 h5 span div ' +
  'table thead tbody tr th td caption figure figcaption dl dt dd hr small mark').split(' '));
const ATTRS = new Set(['class', 'href', 'title', 'id', 'colspan', 'rowspan', 'lang']);
// Whitespace, C0/C1 controls, NBSP, zero-width and line-separator characters (browsers ignore several inside a scheme).
const STRIP = new RegExp('[\\x00-\\x20\\x7f-\\xa0' + String.fromCharCode(0x200b) + '-' + String.fromCharCode(0x200f) + String.fromCharCode(0x2028, 0x2029, 0xfeff) + ']', 'g');
// Site-relative paths must not be protocol-relative (//host) or backslash-variant (/\host).
const HREF_OK = /^(https?:|mailto:|\/(?![\/\\])|#)/i;

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', sol: '/', lpar: '(', rpar: ')',
  tab: '\t', newline: '\n', nbsp: ' ', num: '#', period: '.', comma: ',', semi: ';', equals: '=',
};

/** Decodes numeric and the named entities that matter for scheme smuggling; semicolon optional on numerics. */
function decodeEntities(s) {
  return s.replace(/&(?:#[xX]([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z][a-zA-Z0-9]*));?/g, (m, hex, dec, name) => {
    if (hex || dec) {
      const cp = hex ? parseInt(hex, 16) : parseInt(dec, 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '�';
    }
    const v = NAMED[name.toLowerCase()];
    return v !== undefined && (m.endsWith(';') || name === name.toLowerCase()) ? v : m;
  });
}

function hrefProblem(raw) {
  // Decode to a fixed point (double-encoding), then drop whitespace/control chars browsers ignore.
  let v = raw;
  for (let i = 0; i < 3; i++) { const d = decodeEntities(v); if (d === v) break; v = d; }
  v = v.replace(STRIP, '');
  return HREF_OK.test(v) ? null : `href not allowed: ${raw.slice(0, 60)}`;
}

/** Parses one start tag beginning at s[i] === '<' + letter. Returns {end, name, attrs} or null if malformed. */
function parseStartTag(s, i) {
  const nm = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(s.slice(i, i + 40));
  let p = i + nm[0].length;
  const attrs = [];
  for (;;) {
    while (p < s.length && /\s/.test(s[p])) p++;
    if (p >= s.length) return null;
    if (s[p] === '>') return { end: p + 1, name: nm[1], attrs };
    if (s[p] === '/') { if (s[p + 1] === '>') return { end: p + 2, name: nm[1], attrs }; return null; }
    const an = /^[^\s"'<>\/=`]+/.exec(s.slice(p));
    if (!an) return null;
    p += an[0].length;
    let value = null;
    let q = p;
    while (q < s.length && /\s/.test(s[q])) q++;
    if (s[q] === '=') {
      q++;
      while (q < s.length && /\s/.test(s[q])) q++;
      const quote = s[q];
      if (quote === '"' || quote === "'") {
        const close = s.indexOf(quote, q + 1);
        if (close < 0) return null;
        value = s.slice(q + 1, close);
        p = close + 1;
        if (p < s.length && !/[\s>\/]/.test(s[p])) return null; // attribute glued to the next one
      } else {
        const un = /^[^\s"'=<>`]+/.exec(s.slice(q));
        if (!un) return null;
        value = un[0];
        p = q + un[0].length;
      }
    }
    attrs.push([an[0], value]);
  }
}

/** @param {string} str @returns {string[]} problems (empty when the fragment is within the allowlist) */
function checkHtml(str) {
  const problems = [];
  const s = String(str);
  let i = 0;
  while ((i = s.indexOf('<', i)) >= 0) {
    const c = s[i + 1];
    if (c !== undefined && /[a-zA-Z]/.test(c)) {
      const tag = parseStartTag(s, i);
      if (!tag) { problems.push(`malformed tag: ${s.slice(i, i + 40)}`); break; }
      const name = tag.name.toLowerCase();
      if (!TAGS.has(name)) problems.push(`tag not allowed: <${name}>`);
      for (const [an, av] of tag.attrs) {
        const a = an.toLowerCase();
        if (a === 'href') {
          if (av === null) problems.push('href without value');
          else { const hp = hrefProblem(av); if (hp) problems.push(hp); }
        } else if (!ATTRS.has(a) && !a.startsWith('aria-')) problems.push(`attribute not allowed: ${a} on <${name}>`);
      }
      i = tag.end;
    } else if (c === '/') {
      const m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/.exec(s.slice(i, i + 60));
      if (!m) { if (/[a-zA-Z]/.test(s[i + 2] || '')) { problems.push(`malformed closing tag: ${s.slice(i, i + 40)}`); break; } i += 2; continue; }
      if (!TAGS.has(m[1].toLowerCase())) problems.push(`tag not allowed: </${m[1].toLowerCase()}>`);
      i += m[0].length;
    } else if (c === '!' || c === '?') {
      problems.push(`markup declaration/comment not allowed: ${s.slice(i, i + 20)}`);
      const e = s.indexOf('>', i);
      if (e < 0) break;
      i = e + 1;
    } else i += 1; // lone '<' is text
  }
  return [...new Set(problems)];
}

/** Calls fn(string, jsonPointer) for every string value; skips `code` viz source (verbatim, escaped on render). */
function walkStrings(v, fn, ptr = '') {
  if (typeof v === 'string') fn(v, ptr);
  else if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, fn, `${ptr}/${i}`));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'viz' && Array.isArray(x)) {
        x.forEach((spec, i) => {
          if (spec && spec.type === 'code') {
            const { data, ...rest } = spec;
            walkStrings(rest, fn, `${ptr}/viz/${i}`);
          } else walkStrings(spec, fn, `${ptr}/viz/${i}`);
        });
      } else walkStrings(x, fn, `${ptr}/${k}`);
    }
  }
}

/**
 * JSON pointers whose strings the templates insert with raw(). Everything else is
 * escaped on render (plain text may legitimately contain "<qname>" etc.), so it is
 * not checked here. KEEP IN SYNC with raw() call sites: datasheet.js (sections
 * content/eli5, eli5.summary, today), index-tier.js (summary, eli5.summary),
 * pages/glossary.js (definition).
 */
const HTML_FIELDS = {
  rfc: /^\/(summary|today|eli5\/summary|sections\/\d+\/(content|eli5))$/,
  glossary: /^\/definition$/,
  journey: /^$\b/, // journeys render every string escaped
};

/** @param {object} data parsed content file @param {'rfc'|'glossary'|'journey'} kind
 *  @returns {{ptr: string, problem: string}[]} every unsafe-HTML problem in the raw()-rendered fields */
function checkContent(data, kind = 'rfc') {
  const out = [];
  const re = HTML_FIELDS[kind];
  walkStrings(data, (s, ptr) => { if (re.test(ptr)) for (const problem of checkHtml(s)) out.push({ ptr, problem }); });
  return out;
}

module.exports = { checkHtml, checkContent, walkStrings, HTML_FIELDS };
