'use strict';
const { pubDate, DAY } = require('./graph');

const STATUS_WEIGHT = {
  'internet-standard': 4, bcp: 3, 'proposed-standard': 2, 'draft-standard': 2,
  informational: 1, experimental: 0.5, historic: 0, unknown: 0,
};
const BOILERPLATE = /IANA|Deprecat|Updating References|Registry|Registries|Allocat|Clarification|Errata|Administrative|Procedures? for|Guidelines for Writing/i;
const STANDARDS = new Set(['proposed-standard', 'draft-standard', 'internet-standard']);
const lg = (n) => Math.log2(1 + n);

/** C9. @param {import('./model').RfcRecord} rfc @param {{buildDate?: Date}} [site] @param {number} [traffic]
 *  @returns {number} */
function score(rfc, site, traffic = 0) {
  const now = (site && site.buildDate) || new Date();
  let p = 3 * lg(rfc.updatedBy.length)
    + 0.5 * lg(rfc.obsoletes.length)
    + 2 * lg(rfc.mentionedIn.length)
    + (STATUS_WEIGHT[rfc.status] || 0)
    + ((rfc.isAlso || []).some((x) => /^STD/i.test(x)) ? 3 : 0);
  const age = (now - pubDate(rfc)) / DAY;
  if (rfc.stream === 'IETF' && STANDARDS.has(rfc.status) && age >= 0 && age <= 365) p += 2;
  p += 2 * lg(rfc.demand || 0) + Math.log2(1 + (traffic || 0) / 100);
  if (rfc.obsoletedBy.length > 0) p *= 0.3;
  if (BOILERPLATE.test(rfc.title)) p *= 0.2;
  return Math.round(p * 100) / 100;
}

module.exports = { score };
