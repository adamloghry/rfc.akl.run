'use strict';
const { html, raw, esc } = require('../lib/html');
const { layout } = require('../lib/layout');

const BLOCK = 1000;
const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const DESCRIPTIONS = {
  core: 'IP, ICMP, ARP and the link-layer glue everything else rides on.',
  dns: 'Names to addresses: resolvers, zones, DNSSEC.',
  http: 'The web: HTTP, URIs, WebSockets and friends.',
  transport: 'TCP, UDP, QUIC and congestion control.',
  security: 'TLS, PKI, authentication and cryptography.',
  email: 'SMTP, MIME, IMAP and message formats.',
  routing: 'BGP, OSPF, MPLS and multicast.',
  applications: 'Protocols for applications, real-time media and the web at large.',
  infrastructure: 'Operations, management and network plumbing.',
  data: 'Encodings and data models: ASN.1, JSON, CBOR, YANG.',
  meta: 'Process, policy and culture of the Internet standards.',
};

const byNum = (a, b) => a.number - b.number;
const byPri = (a, b) => b.priority - a.priority || a.number - b.number;

function groups(site) {
  const g = new Map(site.categories.map((c) => [c.key, []]));
  for (const r of site.rfcs.values()) (g.get(r.category) || g.get('meta')).push(r);
  return g;
}
const tally = (list) => {
  const t = { total: list.length, index: 0, summary: 0, explainer: 0, interactive: 0 };
  for (const r of list) t[r.tier]++;
  return t;
};

function card(cat, list) {
  const t = tally(list);
  const covered = t.summary + t.explainer + t.interactive;
  const pct = t.total ? Math.round((covered / t.total) * 100) : 0;
  return html`<a class="area-card" href="/areas/${cat.key}/">
<span class="eyebrow">${t.total.toLocaleString('en-US')} RFCs</span>
<span class="area-card-name">${cat.name}</span>
<span class="area-card-desc">${DESCRIPTIONS[cat.key] || ''}</span>
<span class="cov-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
<span class="area-card-meta">${t.explainer + t.interactive} explainers · ${t.summary} summaries · ${pct}% covered</span>
</a>`;
}

function listing(site, g) {
  const main = html`<div class="container container-atlas page-head">
<p class="eyebrow">Browse</p>
<h1 class="page-title">Areas</h1>
<p class="page-lede">Every RFC belongs to one of eleven areas. Each area page lists its explainers first, then plain-language summaries, then the full index.</p>
<div class="area-grid">${site.categories.map((c) => card(c, g.get(c.key)))}</div>
</div>`;
  return layout({ title: 'Areas · rfc.akl.run', description: 'Browse every RFC by area: core protocols, DNS, HTTP, transport, security, email, routing and more.', path: '/areas/', palette: 'cool', header: 'site', container: 'atlas', active: 'areas', main });
}

function indexBlocks(list) {
  const sorted = [...list].sort(byNum);
  const blocks = new Map();
  for (const r of sorted) {
    const k = Math.floor((r.number - 1) / BLOCK);
    if (!blocks.has(k)) blocks.set(k, []);
    blocks.get(k).push(r);
  }
  const line = (r) => `<li><a href="/${r.number}/">RFC ${r.number} · ${esc(r.title)}</a></li>`;
  if (blocks.size <= 1 && sorted.length <= 300) {
    return html`<ul class="idx-list">${raw(sorted.map(line).join(''))}</ul>`;
  }
  return html`${[...blocks].map(([k, rs], i) => html`<details class="idx-block"${i === 0 && blocks.size === 1 ? raw(' open') : ''}>
<summary><span class="mono">${k * BLOCK + 1}–${(k + 1) * BLOCK}</span> <span class="muted">${rs.length} RFCs</span></summary>
<ul class="idx-list">${raw(rs.map(line).join(''))}</ul>
</details>`)}`;
}

function areaPage(site, cat, list) {
  const t = tally(list);
  const expl = list.filter((r) => r.tier === 'explainer' || r.tier === 'interactive').sort(byPri);
  const sums = list.filter((r) => r.tier === 'summary').sort(byPri);
  const idx = list.filter((r) => r.tier === 'index');
  const sub = (r) => strip((r.content && (r.content.subtitle || (r.content.hero && r.content.hero.subtitle))) || '');
  const main = html`<div class="container container-atlas page-head">
<p class="eyebrow"><a href="/areas/">Areas</a> / ${cat.name}</p>
<h1 class="page-title">${cat.name}</h1>
<p class="page-lede">${DESCRIPTIONS[cat.key] || ''}</p>
<p class="area-stats mono">${t.total} RFCs · ${t.explainer + t.interactive} explainers · ${t.summary} summaries · ${t.index} index pages</p>
${expl.length ? html`<section class="area-sec"><h2 class="sec-title">Explainers <span class="count">${expl.length}</span></h2>
<div class="expl-grid">${expl.map((r) => html`<a class="expl-card" href="${r.url}">
<span class="eyebrow">RFC ${r.number}${r.tier === 'interactive' ? ' · interactive' : ''}</span>
<span class="expl-short">${r.shortTitle || r.title}</span>
<span class="expl-title">${r.shortTitle ? r.title : ''}</span>
<span class="expl-sub">${sub(r)}</span></a>`)}</div></section>` : ''}
${sums.length ? html`<section class="area-sec"><h2 class="sec-title">Summaries <span class="count">${sums.length}</span></h2>
<ul class="sum-rows">${sums.map((r) => html`<li><a href="${r.url}"><span class="mono num">RFC ${r.number}</span><span class="sum-title">${r.title}</span><span class="badge badge-${r.statusTone}">${r.statusLabel}</span></a></li>`)}</ul></section>` : ''}
${idx.length ? html`<section class="area-sec"><h2 class="sec-title">Index pages <span class="count">${idx.length}</span></h2>${indexBlocks(idx)}</section>` : ''}
</div>`;
  return layout({ title: `${cat.name} · Areas · rfc.akl.run`, description: `${cat.name}: ${DESCRIPTIONS[cat.key] || ''} ${t.total} RFCs.`.slice(0, 200), path: `/areas/${cat.key}/`, palette: 'cool', header: 'site', container: 'atlas', active: 'areas', main });
}

module.exports = {
  name: 'areas',
  render(site) {
    const g = groups(site);
    const out = [{ path: 'areas/index.html', html: listing(site, g), sitemap: true }];
    for (const c of site.categories) out.push({ path: `areas/${c.key}/index.html`, html: areaPage(site, c, g.get(c.key)), sitemap: true });
    return out;
  },
};
