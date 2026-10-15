'use strict';
const { html, raw, esc } = require('../lib/html');
const { layout } = require('../lib/layout');
const { renderViz, vizScripts } = require('../lib/viz');

const REPO = 'https://github.com/adamloghry/rfc.akl.run';
const tpl = (t) => `${REPO}/issues/new?template=${t}`;

/** Minimal valid content objects, shown verbatim and validated by tests. */
function starters() {
  const provenance = { source: 'llm-draft', model: 'your-model-id', drafted: '2026-10-15', reviewedBy: null };
  return {
    summary: {
      number: 9999,
      summary: '<p>Two to four plain-language sentences: what problem this RFC solves and how.</p>',
      provenance,
    },
    explainer: {
      number: 9999,
      shortTitle: 'SHORT',
      subtitle: 'One serif line that says what this is for',
      summary: '<p>Two to four plain-language sentences.</p>',
      eli5: { summary: '<p>One to three sentences a child could follow.</p>' },
      questions: ['a question a reader might type into a search box'],
      tldr: { problem: 'What was broken', mechanism: 'What the RFC does', outcome: 'What changed', outcomeLabel: 'Result' },
      sections: [{ id: 'overview', number: '1', title: 'Overview', content: '<p>Explain this section of the RFC.</p>', eli5: '<p>The same idea, simpler.</p>' }],
      viz: [{ type: 'key-grid', anchor: 'overview', position: 'after', data: { items: [{ title: 'Idea', text: 'One sentence.' }] } }],
      provenance,
    },
  };
}

const SAMPLES = {
  packet: { type: 'packet', title: 'Mini header', bytes: 4, width: 32, fields: [{ key: 'ver', name: 'Version', bits: 8, desc: 'Protocol version.', value: '1' }, { key: 'len', name: 'Length', bits: 24, desc: 'Payload length.', value: '0' }] },
  sequence: { type: 'sequence', lanes: [{ key: 'a', label: 'Client' }, { key: 'b', label: 'Server' }], messages: [{ from: 'a', to: 'b', label: 'request', color: 'blue' }, { from: 'b', to: 'a', label: 'reply', color: 'green' }] },
  'compare-table': { type: 'compare-table', columns: ['Option', 'Trade-off'], rows: [{ cells: ['Old way', 'Manual'] }, { cells: ['This RFC', 'Automatic'], self: true }] },
  contrast: { type: 'contrast', joiner: 'inverse of', left: { title: 'ARP', from: 'IP', to: 'MAC', desc: 'Who has this IP?' }, right: { title: 'RARP', from: 'MAC', to: 'IP', desc: 'Who has this MAC?' } },
  'key-grid': { type: 'key-grid', items: [{ title: 'One', text: 'First idea.' }, { title: 'Two', text: 'Second idea.' }] },
  layers: { type: 'layers', layers: [{ label: 'Application', detail: 'HTTP' }, { label: 'Link', detail: 'This RFC', highlight: true }] },
  timeline: { type: 'timeline', events: [{ year: 1984, label: 'RARP', rfc: 903 }, { year: 1997, label: 'DHCP', rfc: 2131 }] },
  'state-machine': { type: 'state-machine', states: [{ key: 'a', label: 'IDLE', initial: true }, { key: 'b', label: 'DONE', final: true }], transitions: [{ from: 'a', to: 'b', label: 'reply received' }] },
  tree: { type: 'tree', root: { label: 'Root', children: [{ label: 'Leaf', note: 'note' }] } },
  opcodes: { type: 'opcodes', items: [{ code: '1', label: 'Request' }, { code: '2', label: 'Reply', highlight: true }] },
  code: { type: 'code', title: 'example.txt', lang: 'text', code: 'a line of code' },
};

const SHAPES = {
  packet: '{ title, bytes, width: 32, modes?: [{key,label}], fields: [{ key, name, bits, desc, value?, values?: {modeKey: string} }] }',
  'sequence-sim': '{ title, nodes: [{key,label,kind,x}], router?, packetFields: [{key,name}], table?, steps: [{ tag, title, eli5, spec, orig, why, packet, highlight, nodes, packetPos, packetLabel, packetColor }], failureSteps?, replacedBy? }',
  sequence: '{ lanes: [{key,label,dashed?}], messages: [{from,to,label,color: "blue"|"green"|"neutral",note?}] }',
  'compare-table': '{ columns: string[], rows: [{ cells: string[], self?: true }] }',
  contrast: '{ left: {title,from,to,desc}, right: {title,from,to,desc}, joiner: "inverse of" }',
  'key-grid': '{ items: [{ title, text }] }',
  layers: '{ layers: [{ label, detail, highlight? }] }',
  timeline: '{ events: [{ year, label, rfc? }] }',
  'state-machine': '{ states: [{key,label,initial?,final?}], transitions: [{from,to,label}] }',
  tree: '{ root: { label, note?, children?: [...] } }',
  opcodes: '{ items: [{ code, label, desc?, highlight? }] }',
  code: '{ title, lang?, code }',
};

const pretty = (o) => JSON.stringify(o, null, 2);

function gallery() {
  const fake = { number: 0, content: null };
  return html`${Object.keys(SHAPES).map((t) => {
    let live = '';
    if (SAMPLES[t]) { const { type, ...rest } = SAMPLES[t]; const spec = { type, anchor: 'overview', position: 'after', data: rest }; live = renderViz(spec, { ...fake, content: { viz: [spec] } }); }
    return html`<div class="gallery-item" data-gallery="${t}"><h3 class="gallery-type mono">${t}</h3><pre class="shape"><code>${SHAPES[t]}</code></pre>${live ? html`<div class="gallery-live">${live}</div>` : html`<p class="muted">Live example: see <a href="/903/">RFC 903</a>.</p>`}</div>`;
  })}`;
}

function page() {
  const s = starters();
  const levels = [
    ['Index', 'Automatic', 'Official metadata from the RFC Editor index. Nothing to write.'],
    ['Summary', 'Easy', 'A <code>summary</code> of two to four plain-language sentences in <code>content/rfcs/&lt;n&gt;.json</code> (e.g. <code>content/rfcs/903.json</code>).'],
    ['Explainer', 'Moderate', 'Sections with ELI5 versions, a TL;DR, search questions and at least one visualization.'],
    ['Interactive', 'Advanced', 'An explainer that includes a <code>sequence-sim</code> or packet inspector.'],
  ];
  const specs = Object.values(SAMPLES);
  const main = html`<div class="container container-index prose-page">
<p class="eyebrow">Contribute</p>
<h1 class="page-title">Contribute an explainer</h1>
<p class="page-lede serif">Every RFC gets a page. You can help it climb a four-level ladder, and each level adds something readers can use.</p>

<h2 class="sec-title">The ladder</h2>
<ol class="level-list">${levels.map(([n, d, t]) => html`<li><span class="badge badge-neutral">${n}</span> <strong>${d}.</strong> ${raw(t)}</li>`)}</ol>

<h2 class="sec-title">Start from JSON</h2>
<p>Content lives in <code>content/rfcs/&lt;n&gt;.json</code> (e.g. <code>content/rfcs/903.json</code>) and is checked by <code>node scripts/lint-content.js</code>. Replace <code>9999</code> with the RFC number.</p>
<h3 class="sub-title">Summary</h3>
<pre class="starter" data-starter="summary"><code>${pretty(s.summary)}</code></pre>
<h3 class="sub-title">Explainer</h3>
<pre class="starter" data-starter="explainer"><code>${pretty(s.explainer)}</code></pre>

<h2 class="sec-title">Visualization gallery</h2>
<p>Add blocks to the <code>viz</code> array. Each is an object with a <code>type</code>, an <code>anchor</code> (a section id), an optional <code>position</code> and a <code>data</code> object with the shape shown below.</p>
<div class="gallery">${gallery()}</div>

<h2 class="sec-title">Ways to help</h2>
<ul class="help-list">
<li><a href="${tpl('request.yml')}">Request an explainer</a> for an RFC you want covered.</li>
<li><a href="/contribute/question/">Ask a question</a> the site should answer (<a href="${tpl('question.yml')}">issue template</a>).</li>
<li><a href="${tpl('error.yml')}">Report an error</a> in an explanation.</li>
</ul>

<h2 class="sec-title">Provenance and LLM policy</h2>
<p>Drafts written with a language model are welcome but must be labeled: set <code>provenance.source</code> to <code>"llm-draft"</code> and leave <code>reviewedBy</code> as <code>null</code>. Pages then show &ldquo;Draft &middot; machine-assisted, not yet reviewed&rdquo; until a human reviews the file and records their name. Check every claim against the RFC text. Nothing is generated when a reader visits the site.</p>
</div>`;
  return layout({
    title: 'Contribute · rfc.akl.run', description: 'Help explain an RFC: the coverage ladder, JSON starters, visualization types and issue templates.', path: '/contribute/',
    palette: 'warm', header: 'reader', breadcrumb: [{ label: 'Contribute' }], main, scripts: vizScripts(specs),
  });
}

function question() {
  const url = tpl('question.yml');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ask a question · rfc.akl.run</title>
<meta http-equiv="refresh" content="0; url=${esc(url)}">
<link rel="canonical" href="https://rfc.akl.run/contribute/">
<meta name="robots" content="noindex"></head>
<body><p>Redirecting to <a href="${esc(url)}">the question form</a>.</p></body></html>
`;
}

module.exports = {
  name: 'contribute',
  starters,
  render() {
    return [
      { path: 'contribute/index.html', html: page(), sitemap: true },
      { path: 'contribute/question/index.html', html: question(), sitemap: false },
    ];
  },
};
