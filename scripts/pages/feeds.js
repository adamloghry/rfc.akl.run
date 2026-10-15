'use strict';
const { esc } = require('../lib/html');
const { pubDate, byDate } = require('../lib/graph');

const ORIGIN = 'https://rfc.akl.run';
const TIER_NOUN = { summary: 'summary', explainer: 'full explainer', interactive: 'interactive explainer' };
const DAY = 86400000;

function render(site) {
  const entries = [];
  const newest = [...site.rfcs.values()].sort((a, b) => byDate(b, a)).slice(0, 30);
  for (const r of newest) {
    entries.push({
      id: `${ORIGIN}${r.url}`, title: `RFC ${r.number}: ${r.title}`, href: `${ORIGIN}${r.url}`,
      date: pubDate(r), summary: r.abstract ? r.abstract.split('\n\n')[0] : r.title,
    });
  }
  for (const r of site.rfcs.values()) {
    const upd = r.content && r.content.updated;
    if (!upd || r.tier === 'index') continue;
    const d = new Date(upd);
    if (isNaN(d)) continue;
    const age = (site.buildDate - d) / DAY;
    if (age < 0 || age > 90) continue;
    entries.push({
      id: `${ORIGIN}${r.url}#${r.tier}-${upd}`, title: `RFC ${r.number} now has a ${TIER_NOUN[r.tier]}`,
      href: `${ORIGIN}${r.url}`, date: d, summary: r.title,
    });
  }
  entries.sort((a, b) => (b.date - a.date) || a.id.localeCompare(b.id));
  const list = entries.slice(0, 60);
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>rfc.akl.run: new RFCs and explainers</title>
<link href="${ORIGIN}/feed.xml" rel="self"/>
<link href="${ORIGIN}/"/>
<id>${ORIGIN}/</id>
<updated>${site.buildDate.toISOString()}</updated>
${list.map((e) => `<entry>
<title>${esc(e.title)}</title>
<link href="${esc(e.href)}"/>
<id>${esc(e.id)}</id>
<updated>${e.date.toISOString()}</updated>
<summary>${esc(e.summary)}</summary>
</entry>`).join('\n')}
</feed>
`;
  return [{ path: 'feed.xml', html: xml, sitemap: false }];
}

module.exports = { name: 'feeds', render };
