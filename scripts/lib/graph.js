'use strict';
const DAY = 86400000;

/** Publication date as UTC midnight; when the index has no day, the LAST day of the month.
 *  @param {{year: number, month: number, day: number|null}} r @returns {Date} */
function pubDate(r) {
  const day = r.day || new Date(Date.UTC(r.year, r.month, 0)).getUTCDate();
  return new Date(Date.UTC(r.year, r.month - 1, day));
}

function byDate(a, b) {
  return (pubDate(a) - pubDate(b)) || (a.number - b.number);
}

const RFC_RE = /\bRFC\s?(\d{1,5})\b/g;
const HREF_RE = /href="\/(\d+)\/"/g;

/** @param {string} text @param {Set<number>} out */
function scan(text, out) {
  if (typeof text !== 'string') return;
  for (const re of [RFC_RE, HREF_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) out.add(Number(m[1]));
  }
}

/** RFC numbers mentioned by a content object (sections, summary, today, references).
 *  @param {object} content @returns {Set<number>} */
function contentMentions(content) {
  const out = new Set();
  if (!content) return out;
  scan(content.summary, out);
  scan(content.today, out);
  for (const s of content.sections || []) scan(s.content, out);
  for (const r of content.references || []) {
    scan(r.text, out);
    if (Number.isInteger(r.rfc)) out.add(r.rfc);
  }
  return out;
}

/** Fills rfc.mentionedIn (sorted asc, no self) on every record of the site.
 *  Journeys cannot appear in a number[] so they are not sources.
 *  @param {import('./model').Site} site @returns {import('./model').Site} */
function mentions(site) {
  const into = new Map();
  for (const rfc of site.rfcs.values()) {
    for (const n of contentMentions(rfc.content)) {
      if (n === rfc.number || !site.rfcs.has(n)) continue;
      if (!into.has(n)) into.set(n, new Set());
      into.get(n).add(rfc.number);
    }
  }
  for (const rfc of site.rfcs.values()) {
    rfc.mentionedIn = [...(into.get(rfc.number) || [])].sort((a, b) => a - b);
  }
  return site;
}

function item(r, self) {
  return { number: r.number, year: r.year, label: r.shortTitle || r.title, current: r === self, url: r.url };
}

const MAX_ITEMS = 5;

/** @param {import('./model').RfcRecord} rfc @param {import('./model').Site} site
 *  @returns {{title: string, items: {number: number, year: number, label: string, current: boolean, url: string}[]}} */
function lineage(rfc, site) {
  const curated = rfc.content && rfc.content.lineage;
  if (curated && Array.isArray(curated.rfcs) && curated.rfcs.length) {
    const items = curated.rfcs.map((n) => site.rfcs.get(n)).filter(Boolean).map((r) => item(r, rfc));
    return { title: curated.title || 'Lineage', items };
  }
  const seen = new Set([rfc.number]);
  const related = [rfc];
  for (const n of [...rfc.obsoletes, ...rfc.updates, ...rfc.obsoletedBy]) {
    const r = site.rfcs.get(n);
    if (r && !seen.has(n)) { seen.add(n); related.push(r); }
  }
  related.sort(byDate);
  let list = related;
  if (list.length > MAX_ITEMS) {
    const at = list.indexOf(rfc);
    const start = Math.min(Math.max(at - 2, 0), list.length - MAX_ITEMS);
    list = list.slice(start, start + MAX_ITEMS);
  }
  return { title: 'Lineage', items: list.map((r) => item(r, rfc)) };
}

module.exports = { lineage, mentions, contentMentions, pubDate, byDate, DAY };
