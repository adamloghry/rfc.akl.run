const test = require('node:test');
const assert = require('node:assert');
const { html, raw, esc, attrs, SafeHtml } = require('../scripts/lib/html');

test('escapes interpolations', () => {
  assert.strictEqual(String(html`<p>${'<b>&"\''}</p>`), '<p>&lt;b&gt;&amp;&quot;&#39;</p>');
});
test('raw and nested html are not re-escaped', () => {
  const inner = html`<i>${'x'}</i>`;
  assert.strictEqual(String(html`<p>${inner}${raw('<br>')}</p>`), '<p><i>x</i><br></p>');
});
test('arrays flatten, nullish/false render empty', () => {
  assert.strictEqual(String(html`${['a', html`<b>b</b>`, null, undefined, false]}`), 'a<b>b</b>');
});
test('numbers render', () => { assert.strictEqual(String(html`${0}${903}`), '0903'); });
test('attrs', () => {
  assert.strictEqual(String(attrs({ class: 'a"b', hidden: true, off: false, 'data-n': 3, nil: null })), ' class="a&quot;b" hidden data-n="3"');
});
test('returns SafeHtml', () => { assert.ok(html`x` instanceof SafeHtml); assert.strictEqual(esc(null), ''); });
