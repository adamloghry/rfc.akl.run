'use strict';
const { html, raw, esc } = require('../lib/html');
const { layout } = require('../lib/layout');

function listing(site) {
  const js = site.journeys;
  const main = html`<div class="container container-atlas page-head">
<p class="eyebrow">Guided paths</p>
<h1 class="page-title">Journeys</h1>
<p class="page-lede">Follow one idea across the RFCs that built it, in reading order.</p>
<div class="journey-grid">${js.map((j, i) => {
    const n = (j.steps || []).reduce((a, s) => a + (s.rfcs || []).length, 0);
    return html`<a class="journey-card${j.featured && i === 0 ? ' is-feature' : ''}" href="/journeys/${j.slug}/">
<span class="eyebrow">${(j.steps || []).length} steps · ${n} RFCs</span>
<span class="journey-card-title">${j.title}</span>
<span class="journey-card-desc">${j.description || ''}</span></a>`;
  })}</div>
</div>`;
  return layout({ title: 'Journeys · rfc.akl.run', description: 'Guided reading paths through the RFCs, one idea at a time.', path: '/journeys/', palette: 'cool', header: 'site', active: 'journeys', main });
}

function page(site, j) {
  const rfcChip = (ref) => {
    const r = site.rfcs.get(ref.number);
    const label = ref.label || (r && (r.shortTitle || r.title)) || '';
    return html`<a class="rfc-chip" href="/${ref.number}/"><span class="mono">RFC ${ref.number}</span>${label ? html` <span>${label}</span>` : ''}</a>`;
  };
  const main = html`<div class="container container-index prose-page">
<p class="eyebrow"><a href="/journeys/">Journeys</a></p>
<h1 class="page-title">${j.title}</h1>
${j.description ? html`<p class="page-lede serif">${j.description}</p>` : ''}
<ol class="journey-steps">${(j.steps || []).map((s, i) => html`<li class="journey-step" id="step-${i + 1}">
<span class="step-num mono">${String(i + 1).padStart(2, '0')}</span>
<div class="step-body"><h2 class="step-title">${s.title}${s.subtitle ? html` <span class="step-sub">${s.subtitle}</span>` : ''}</h2>
${s.description ? html`<p>${s.description}</p>` : ''}
<p class="chips">${(s.rfcs || []).map(rfcChip)}</p></div></li>`)}</ol>
</div>`;
  return layout({
    title: `${j.title} · Journeys · rfc.akl.run`, description: (j.description || j.title).slice(0, 200), path: `/journeys/${j.slug}/`,
    palette: 'warm', header: 'reader', breadcrumb: [{ label: 'Journeys', href: '/journeys/' }, { label: j.title }],
    main,
  });
}

module.exports = {
  name: 'journeys',
  render(site) {
    const out = [{ path: 'journeys/index.html', html: listing(site), sitemap: true }];
    for (const j of site.journeys) out.push({ path: `journeys/${j.slug}/index.html`, html: page(site, j), sitemap: true });
    return out;
  },
};
