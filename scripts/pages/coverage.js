'use strict';
const { html } = require('../lib/html');
const { layout } = require('../lib/layout');

const REPO = 'https://github.com/adamloghry/rfc.akl.run';
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0') + '%';
const tally = (list) => {
  const t = { total: list.length, index: 0, summary: 0, explainer: 0, interactive: 0 };
  for (const r of list) t[r.tier]++;
  return t;
};
const row = (label, t) => html`<tr><th scope="row">${label}</th><td>${t.total}</td><td>${t.index}</td><td>${t.summary}</td><td>${t.explainer}</td><td>${t.interactive}</td><td>${pct(t.total - t.index, t.total)}</td></tr>`;
const head = (first) => html`<thead><tr><th scope="col">${first}</th><th scope="col">RFCs</th><th scope="col">Index</th><th scope="col">Summary</th><th scope="col">Explainer</th><th scope="col">Interactive</th><th scope="col">Covered</th></tr></thead>`;

module.exports = {
  name: 'coverage',
  render(site) {
    const all = [...site.rfcs.values()];
    const c = site.counts;
    const covered = c.summary + c.explainer + c.interactive;
    const byCat = site.categories.map((cat) => [cat.name, tally(all.filter((r) => r.category === cat.key)), cat.key]);
    const decades = new Map();
    for (const r of all) { const d = Math.floor(r.year / 10) * 10; if (!decades.has(d)) decades.set(d, []); decades.get(d).push(r); }
    const dec = [...decades].sort((a, b) => a[0] - b[0]);
    const top = all.filter((r) => r.tier === 'index' || r.tier === 'summary').sort((a, b) => b.priority - a.priority || a.number - b.number).slice(0, 50);
    const reqUrl = (r) => `${REPO}/issues/new?template=request.yml&title=${encodeURIComponent(`Explain RFC ${r.number}`)}`;
    const ladder = [['Index', c.index, 'Official metadata only'], ['Summary', c.summary, 'A plain-language paragraph'], ['Explainer', c.explainer, 'Sections, diagrams, ELI5'], ['Interactive', c.interactive, 'Packet or sequence simulator']];
    const main = html`<div class="container container-atlas page-head">
<p class="eyebrow">Progress</p>
<h1 class="page-title">Coverage</h1>
<p class="page-lede">${covered.toLocaleString('en-US')} of ${c.total.toLocaleString('en-US')} issued RFCs (${pct(covered, c.total)}) have more than an index page.</p>
<div class="ladder">${ladder.map(([n, v, d]) => html`<div class="ladder-step"><span class="eyebrow">${n}</span><span class="ladder-n">${v.toLocaleString('en-US')}</span><span class="ladder-d">${d}</span></div>`)}</div>
<h2 class="sec-title">By area</h2>
<div class="table-wrap"><table class="data-table">${head('Area')}<tbody>${byCat.map(([n, t, key]) => row(html`<a href="/areas/${key}/">${n}</a>`, t))}</tbody></table></div>
<h2 class="sec-title">By decade</h2>
<div class="table-wrap"><table class="data-table">${head('Decade')}<tbody>${dec.map(([d, l]) => row(`${d}s`, tally(l)))}</tbody></table></div>
<h2 class="sec-title">Top ${top.length} uncovered</h2>
<p class="page-note">The most valuable RFCs that still lack an explainer. <a href="${REPO}/issues/new?template=request.yml">Request one</a> or pick from this list.</p>
<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">RFC</th><th scope="col">Title</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Demand</th><th scope="col"><span class="visually-hidden">Request</span></th></tr></thead><tbody>${top.map((r) => html`<tr class="uncovered-row"><th scope="row" class="mono"><a href="${r.url}">${r.number}</a></th><td>${r.title}</td><td><span class="badge badge-${r.statusTone}">${r.statusLabel}</span></td><td class="mono">${r.priority.toFixed(2)}</td><td class="mono">${r.demand}</td><td><a href="${reqUrl(r)}">Request</a></td></tr>`)}</tbody></table></div>
<h2 class="sec-title">How priority is scored</h2>
<div class="formula"><p>Priority rewards RFCs that others build on. It adds 3 &middot; log2(1 + RFCs that update it), 0.5 &middot; log2(1 + RFCs it obsoletes), and 2 &middot; log2(1 + RFCs whose explainers mention it), plus a weight for status (Internet Standard 4, BCP 3, Proposed or Draft Standard 2, Informational 1, Experimental 0.5), 3 more if it is part of an STD, and 2 for recent IETF standards-track work. Reader requests add 2 &middot; log2(1 + requests) and page traffic adds log2(1 + visits/100). Obsoleted RFCs are multiplied by 0.3, and housekeeping documents (IANA registries, errata, procedures) by 0.2.</p></div>
</div>`;
    return [{ path: 'coverage/index.html', sitemap: true, html: layout({ title: 'Coverage · rfc.akl.run', description: `${pct(covered, c.total)} of RFCs have a summary or explainer. See what is covered and what is missing.`, path: '/coverage/', palette: 'cool', header: 'site', container: 'atlas', active: 'areas', main }) }];
  },
};
