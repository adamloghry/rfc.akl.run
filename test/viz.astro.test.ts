import fs from 'node:fs';
import path from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import Viz from '../src/components/viz/Viz.astro';
import { VIZ_TYPES, validateViz, vizScripts } from '../src/components/viz/validate';
import { must } from './helpers';

const FIX = path.join(__dirname, 'fixtures', 'viz');
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, `${n}.json`), 'utf8'));
const container = await AstroContainer.create();
const out = async (spec: unknown, rfc?: unknown) =>
  container.renderToString(Viz, { props: { spec, rfc: rfc || { number: 903, content: { viz: [spec] } } } });

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function balance(s: string): string | null {
  const stack: string[] = [];
  const re = /<script\b[^>]*>[\s\S]*?<\/script>|<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (!m[2]) continue;
    const name = m[2].toLowerCase();
    if (VOID.has(name) || m[3] === '/') continue;
    if (!m[1]) stack.push(name);
    else if (stack.pop() !== name) return `unexpected </${name}> at ${m.index}`;
  }
  return stack.length ? `unclosed: ${stack.join(',')}` : null;
}

describe('viz components', () => {
  test('packet renders 9 field cells, fallback table with 9 rows, changed fields', async () => {
    const h = await out(load('rarp-packet'));
    expect((h.match(/ id="field-/g) || []).length).toBe(9);
    expect(h).toMatch(/<figure class="viz viz-packet" id="packet-0" data-viz="packet"/);
    const tbody = must(h.match(/<table class="viz-packet-table"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/))[1] as string;
    expect((tbody.match(/<tr/g) || []).length).toBe(9);
    for (const k of ['oper', 'sha', 'spa', 'tpa']) expect(h).toMatch(new RegExp(`id="field-${k}"[^>]*data-changed="rep"`));
    expect(h).not.toMatch(/id="field-tha"[^>]*data-changed/);
    expect(h).not.toMatch(/id="field-htype"[^>]*data-changed/);
    expect(h).toMatch(/href="#field-oper"/);
  });

  test('packet: 48-bit field splits into 32 + 16 column fragments', async () => {
    const h = await out(load('rarp-packet'));
    const spans = [...h.matchAll(/data-key="sha"[^>]*?style="grid-column:span (\d+)"/g)].map((m) => +m[1]);
    expect(spans).toEqual([32, 16]);
    const all = [...h.matchAll(/class="pk-cell"[^>]*style="grid-column:span (\d+)"/g)].map((m) => +m[1]);
    expect(all.reduce((a, b) => a + b, 0)).toBe(224);
    expect(h).toMatch(/SHA \(cont\.\)/);
  });

  test('packet: value fragments split on separators and modes render', async () => {
    const h = await out(load('rarp-packet'));
    expect(h).toMatch(/08:00:20:01/);
    expect(h).toMatch(/:AB:C2/);
    expect(h).toMatch(/aria-pressed="true"/);
    expect(h).toMatch(/Request · op 3/);
  });

  test('sequence-sim: steps list, data round-trip, failure list', async () => {
    const spec = load('rarp-sim');
    const h = await out(spec);
    expect(h).toMatch(/<ol class="sim-steps"/);
    for (let i = 1; i <= 6; i++) expect(h.includes(`id="step-${i}"`), `step-${i}`).toBe(true);
    expect(h.includes('id="step-7"')).toBe(false);
    const m = h.match(/<script type="application\/json" class="sim-data">([\s\S]*?)<\/script>/);
    expect(m).toBeTruthy();
    expect(JSON.parse(must(m)[1] as string)).toEqual(spec);
    expect(h).toMatch(/class="sim-steps sim-failure-steps"/);
    expect(h).toMatch(/The request dies at the router/);
    expect(h).toMatch(/data-rfc="903"/);
  });

  test('sequence-sim: </script> in data is escaped', async () => {
    const spec = load('rarp-sim');
    spec.steps[0].why = 'evil </script><script>alert(1)</script> <!-- x';
    const h = await out(spec);
    const m = must(h.match(/class="sim-data">([\s\S]*?)<\/script>/));
    expect(m[1]).toContain('<\\/script>');
    expect(m[1]).not.toContain('</script');
    expect(m[1]).not.toContain('<!--');
    expect(JSON.parse(m[1]).steps[0].why).toBe(spec.steps[0].why);
    expect(h).not.toContain('<script>alert(1)');
    expect(balance(h)).toBeNull();
  });

  test('compare-table marks the self row', async () => {
    const h = await out(load('compare-table'));
    expect((h.match(/class="is-self"/g) || []).length).toBe(1);
    expect(h).toMatch(/THIS RFC/);
    expect(h).toMatch(/<tr class="is-self"[\s\S]*?RARP[\s\S]*?<\/tr>/);
  });

  test('sequence: step ids only when no sequence-sim on the page', async () => {
    const spec = load('rarp-sequence');
    const plain = await out(spec, { number: 903, content: { viz: [spec] } });
    expect(plain.includes('id="step-1"') && plain.includes('id="step-3"')).toBe(true);
    const withSim = await out(spec, { number: 903, content: { viz: [spec, load('rarp-sim')] } });
    expect(withSim.includes('id="step-')).toBe(false);
  });

  test('unknown type throws; missing rfc content tolerated', async () => {
    await expect(out({ type: 'nope' }, { number: 1 })).rejects.toThrow(/unknown viz type/i);
    await expect(out(load('contrast'), { number: 1, content: null })).resolves.toBeTruthy();
  });

  test('figure id and caption', async () => {
    const h = await out({ ...load('layers'), id: 'my-layers' });
    expect(h).toMatch(/<figure class="viz viz-layers" id="my-layers" data-viz="layers">/);
    expect(h).toMatch(/<figcaption class="viz-cap">Where RARP sits<\/figcaption>/);
  });

  test('every viz type renders balanced HTML and escapes text', async () => {
    const types = new Set<string>();
    for (const n of fs.readdirSync(FIX).map((f) => f.replace(/\.json$/, ''))) {
      const spec = load(n);
      types.add(spec.type);
      const h = await out(spec);
      expect(balance(h), n).toBeNull();
      expect(h).toMatch(new RegExp(`data-viz="${spec.type}"`));
      expect(validateViz(spec), n).toBeNull();
    }
    for (const t of VIZ_TYPES) expect(types.has(t), `fixture for ${t}`).toBe(true);
    const code = await out(load('code'));
    expect(code).not.toContain('<script>x');
    expect(code).toMatch(/&lt;script&gt;x&lt;\/script&gt;/);
  });

  test('timeline links RFCs; tree nests; opcodes highlight; state machine lists transitions', async () => {
    expect(await out(load('timeline'))).toMatch(/href="\/903\/"/);
    expect(await out(load('tree'))).toMatch(/<ul[\s\S]*<ul[\s\S]*<ul/);
    expect(((await out(load('opcodes'))).match(/is-hl/g) || []).length).toBe(2);
    const sm = await out(load('state-machine'));
    expect(sm).toMatch(/send op 3/);
    expect(sm).toMatch(/receive op 4/);
  });

  test('sequence: unknown lane key throws', async () => {
    const spec = load('rarp-sequence');
    spec.messages[0].to = 'nope';
    await expect(out(spec, { number: 1 })).rejects.toThrow(/unknown lane key/);
    expect(validateViz(spec)).toMatch(/unknown lane key/);
  });

  test('nested {type, anchor, data} form renders identically to flat form', async () => {
    const flat = load('rarp-packet');
    const { type, caption, ...data } = flat;
    const nested = { type, anchor: 'packet-format', position: 'after', caption, data };
    expect(await out(nested, { number: 903, content: { viz: [nested] } })).toBe(await out(flat, { number: 903, content: { viz: [flat] } }));
    expect(vizScripts([nested, { type: 'sequence-sim', data: {} }])).toEqual(['packet', 'sim']);
  });

  test('validateViz reports malformed specs', () => {
    expect(validateViz({ type: 'nope' })).toMatch(/unknown viz type/);
    expect(validateViz({ type: 'packet', data: {} })).toMatch(/fields/);
    expect(validateViz({ type: 'code', data: { code: 5 } })).toMatch(/code/);
    expect(validateViz({ type: 'tree', data: {} })).toMatch(/root/);
  });
});
