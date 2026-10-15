'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderViz, vizScripts } = require('../scripts/lib/viz');

const FIX = path.join(__dirname, 'fixtures', 'viz');
const load = (n) => JSON.parse(fs.readFileSync(path.join(FIX, n + '.json'), 'utf8'));
const out = (spec, rfc) => String(renderViz(spec, rfc || { number: 903, content: { viz: [spec] } }));

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Tiny tag-balance checker: returns an error string or null. Skips script bodies.
function balance(s) {
  const stack = [];
  const re = /<script\b[^>]*>[\s\S]*?<\/script>|<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(s))) {
    if (!m[2]) continue;
    const name = m[2].toLowerCase();
    if (VOID.has(name) || m[3] === '/') continue;
    if (!m[1]) stack.push(name);
    else if (stack.pop() !== name) return `unexpected </${name}> at ${m.index}`;
  }
  return stack.length ? `unclosed: ${stack.join(',')}` : null;
}

test('packet renders 9 field cells, fallback table with 9 rows, changed fields', () => {
  const h = out(load('rarp-packet'));
  assert.equal((h.match(/ id="field-/g) || []).length, 9);
  assert.match(h, /<figure class="viz viz-packet" id="packet-0" data-viz="packet"/);
  const tbody = h.match(/<table class="viz-packet-table"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((tbody.match(/<tr/g) || []).length, 9);
  for (const k of ['oper', 'sha', 'spa', 'tpa']) {
    assert.match(h, new RegExp(`id="field-${k}"[^>]*data-changed="rep"`));
  }
  assert.doesNotMatch(h, /id="field-tha"[^>]*data-changed/);
  assert.doesNotMatch(h, /id="field-htype"[^>]*data-changed/);
  assert.match(h, /href="#field-oper"/);
});

test('packet: 48-bit field splits into 32 + 16 column fragments', () => {
  const h = out(load('rarp-packet'));
  const spans = [...h.matchAll(/data-key="sha"[^>]*?style="grid-column:span (\d+)"/g)].map((m) => +m[1]);
  assert.deepEqual(spans, [32, 16]);
  // total grid is 7 rows x 32 columns = 224 bits = 28 bytes
  const all = [...h.matchAll(/class="pk-cell[^"]*"[^>]*style="grid-column:span (\d+)"/g)].map((m) => +m[1]);
  assert.equal(all.reduce((a, b) => a + b, 0), 224);
  assert.match(h, /SHA \(cont\.\)/);
});

test('packet: value fragments split on separators and modes render', () => {
  const h = out(load('rarp-packet'));
  assert.match(h, /08:00:20:01/);
  assert.match(h, /:AB:C2/);
  assert.match(h, /aria-pressed="true"/);
  assert.match(h, /Request · op 3/);
});

test('sequence-sim: steps list, data round-trip, failure list', () => {
  const spec = load('rarp-sim');
  const h = out(spec);
  assert.match(h, /<ol class="sim-steps"/);
  for (let i = 1; i <= 6; i++) assert.ok(h.includes(`id="step-${i}"`), `step-${i}`);
  assert.ok(!h.includes('id="step-7"'));
  const m = h.match(/<script type="application\/json" class="sim-data">([\s\S]*?)<\/script>/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1]), spec);
  assert.match(h, /class="sim-steps sim-failure-steps"/);
  assert.match(h, /The request dies at the router/);
  assert.match(h, /data-rfc="903"/);
});

test('sequence-sim: </script> in data is escaped', () => {
  const spec = load('rarp-sim');
  spec.steps[0].why = 'evil </script><script>alert(1)</script> <!-- x';
  const h = out(spec);
  const m = h.match(/class="sim-data">([\s\S]*?)<\/script>/);
  assert.ok(m[1].includes('<\\/script>'));
  assert.ok(!m[1].includes('</script'));
  assert.ok(!m[1].includes('<!--'));
  assert.equal(JSON.parse(m[1]).steps[0].why, spec.steps[0].why);
  // the injected markup is escaped in the visible fallback too
  assert.ok(!h.includes('<script>alert(1)'));
  assert.equal(balance(h), null);
});

test('compare-table marks the self row', () => {
  const h = out(load('compare-table'));
  assert.equal((h.match(/class="is-self"/g) || []).length, 1);
  assert.match(h, /THIS RFC/);
  assert.match(h, /<tr class="is-self"[\s\S]*?RARP[\s\S]*?<\/tr>/);
});

test('sequence: step ids only when no sequence-sim on the page', () => {
  const spec = load('rarp-sequence');
  const plain = out(spec, { number: 903, content: { viz: [spec] } });
  assert.ok(plain.includes('id="step-1"') && plain.includes('id="step-3"'));
  const sim = load('rarp-sim');
  const withSim = out(spec, { number: 903, content: { viz: [spec, sim] } });
  assert.ok(!withSim.includes('id="step-'));
});

test('unknown type throws; missing rfc content tolerated', () => {
  assert.throws(() => renderViz({ type: 'nope' }, { number: 1 }), /unknown viz type/i);
  assert.doesNotThrow(() => renderViz(load('contrast'), { number: 1, content: null }));
});

test('figure id and caption', () => {
  const spec = { ...load('layers'), id: 'my-layers' };
  const h = out(spec);
  assert.match(h, /<figure class="viz viz-layers" id="my-layers" data-viz="layers">/);
  assert.match(h, /<figcaption class="viz-cap">Where RARP sits<\/figcaption>/);
});

test('vizScripts', () => {
  const p = load('rarp-packet'), s = load('rarp-sim'), c = load('contrast');
  assert.deepEqual(vizScripts([p, s, c]), ['packet.js', 'sim.js']);
  assert.deepEqual(vizScripts([s, p]), ['packet.js', 'sim.js']);
  assert.deepEqual(vizScripts([c]), []);
  assert.deepEqual(vizScripts([p]), ['packet.js']);
  assert.deepEqual(vizScripts({ viz: [s] }), ['sim.js']);
  assert.deepEqual(vizScripts(null), []);
});

test('every viz type renders balanced HTML and escapes text', () => {
  const names = fs.readdirSync(FIX).map((f) => f.replace(/\.json$/, ''));
  const types = new Set();
  for (const n of names) {
    const spec = load(n);
    types.add(spec.type);
    const h = out(spec);
    assert.equal(balance(h), null, `${n}: ${balance(h)}`);
    assert.match(h, new RegExp(`data-viz="${spec.type}"`));
  }
  for (const t of ['packet', 'sequence-sim', 'sequence', 'compare-table', 'contrast', 'key-grid', 'layers', 'timeline', 'state-machine', 'tree', 'opcodes', 'code']) {
    assert.ok(types.has(t), `fixture for ${t}`);
  }
  const code = out(load('code'));
  assert.ok(!code.includes('<script>x'));
  assert.match(code, /&lt;script&gt;x&lt;\/script&gt;/);
});

test('timeline links RFCs; tree nests; opcodes highlight; state machine lists transitions', () => {
  assert.match(out(load('timeline')), /href="\/903\/"/);
  assert.match(out(load('tree')), /<ul[\s\S]*<ul[\s\S]*<ul/);
  assert.equal((out(load('opcodes')).match(/is-hl/g) || []).length, 2);
  const sm = out(load('state-machine'));
  assert.match(sm, /send op 3/);
  assert.match(sm, /receive op 4/);
});

test('sequence: unknown lane key throws', () => {
  const spec = load('rarp-sequence');
  spec.messages[0].to = 'nope';
  assert.throws(() => renderViz(spec, { number: 1 }), /unknown lane key/);
});

test('nested {type, anchor, data} form renders identically to flat form', () => {
  const flat = load('rarp-packet');
  const { type, caption, ...data } = flat;
  const nested = { type, anchor: 'packet-format', position: 'after', caption, data };
  assert.equal(out(nested, { number: 903, content: { viz: [nested] } }), out(flat, { number: 903, content: { viz: [flat] } }));
  assert.deepEqual(vizScripts([nested, { type: 'sequence-sim', data: {} }]), ['packet.js', 'sim.js']);
});
