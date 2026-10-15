'use strict';
const { html, raw } = require('../lib/html');
const { layout } = require('../lib/layout');

module.exports = {
  name: 'graph',
  render() {
    const main = html`<div class="container container-reader prose-page">
<p class="eyebrow">Explore</p>
<h1 class="page-title">RFC graph</h1>
<p class="page-lede serif">See what an RFC replaced on the left and what replaced or amended it on the right. Pick a node to re-center; double-click to open it.</p>
<form class="graph-form" id="graph-form" action="/graph/" method="get"><label for="graph-n" class="eyebrow">RFC number</label> <input id="graph-n" name="n" type="number" min="1" inputmode="numeric" placeholder="903"> <button class="btn" type="submit">Show</button></form>
<div id="graph" class="graph-stage" role="img" aria-label="Relationship graph for the selected RFC"></div>
<noscript><p class="page-note">The graph needs JavaScript. Each RFC page lists its obsoletes and updates relations in plain text.</p></noscript>
</div>`;
    return [{ path: 'graph/index.html', sitemap: true, html: layout({ title: 'RFC graph · rfc.akl.run', description: 'Explore which RFCs obsolete or update each other.', path: '/graph/', palette: 'warm', header: 'reader', breadcrumb: [{ label: 'RFC graph' }], main, scripts: ['graph.js'], head: raw('<meta name="rfc-hash-route" content="1">') }) }];
  },
};
