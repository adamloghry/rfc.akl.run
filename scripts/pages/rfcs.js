'use strict';
const { renderDatasheet } = require('../templates/datasheet');
const { renderIndexTier } = require('../templates/index-tier');
const { renderNotIssued } = require('../templates/not-issued');

/** One page per number 1..max. site.only (optional Set) restricts rendering for fast iteration. */
function* render(site) {
  for (let n = 1; n <= site.max; n++) {
    if (site.only && !site.only.has(n)) continue;
    const path = `${n}/index.html`;
    const rfc = site.rfcs.get(n);
    if (rfc) {
      const fn = rfc.tier === 'explainer' || rfc.tier === 'interactive' ? renderDatasheet : renderIndexTier;
      let page;
      try {
        page = fn(rfc, site);
      } catch (e) {
        // Name the offending file instead of surfacing a bare TypeError from deep in a renderer.
        const err = new Error(`RFC ${n} (content/rfcs/${n}.json): ${e.message}`);
        err.cause = e;
        throw err;
      }
      yield { path, html: page };
    } else if (site.notIssued.has(n)) {
      yield { path, html: renderNotIssued(n, 'not-issued', site), sitemap: false };
    } else {
      yield { path, html: renderNotIssued(n, 'reserved', site), sitemap: false };
    }
  }
}

module.exports = { name: 'rfcs', render };
