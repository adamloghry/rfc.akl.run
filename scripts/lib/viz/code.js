'use strict';
const { html, attrs } = require('../html');

function render(spec) {
  // Comment tails ("# ...") get a subdued span; everything is escaped.
  const lines = String(spec.code).split('\n').map((ln) => {
    const m = ln.match(/^(.*?)(\s#\s.*)$/);
    return m ? html`${m[1]}<span class="code-c">${m[2]}</span>` : html`${ln}`;
  });
  const body = lines.map((l, i) => html`${l}${i < lines.length - 1 ? '\n' : ''}`);
  return html`<div class="code-block"><div class="code-head"><span>${spec.title || spec.lang || 'code'}</span><button type="button" class="code-copy" hidden>COPY</button></div><pre${attrs({ 'data-lang': spec.lang })}><code>${body}</code></pre></div>`;
}

module.exports = { render };
