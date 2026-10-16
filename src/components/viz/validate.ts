/**
 * Pure viz helpers shared by Viz.astro and the content linter (which cannot use the Container API
 * outside Vite): spec normalization plus per-type shape checks mirroring what each component reads.
 */
export const VIZ_TYPES = [
  'packet',
  'sequence-sim',
  'sequence',
  'compare-table',
  'contrast',
  'key-grid',
  'layers',
  'timeline',
  'state-machine',
  'tree',
  'opcodes',
  'code',
] as const;
export type VizType = (typeof VIZ_TYPES)[number];

/** Content JSON nests type fields under `data`; accept that and the flat form. */
export function normalizeViz(spec: any): any {
  if (!spec?.data || typeof spec.data !== 'object') return spec;
  const out: any = { ...spec.data, type: spec.type };
  if (spec.id !== undefined) out.id = spec.id;
  const cap = spec.caption !== undefined ? spec.caption : spec.data.caption;
  if (cap !== undefined) out.caption = cap;
  if (spec.anchor !== undefined) out.anchor = spec.anchor;
  return out;
}

export function isVizType(t: unknown): t is VizType {
  return typeof t === 'string' && (VIZ_TYPES as readonly string[]).includes(t);
}

/** Asset scripts a set of viz specs needs (packet.ts also wires the COPY button of `code` blocks). */
export function vizScripts(specs: any[] | { viz?: any[] } | null | undefined): string[] {
  const list = Array.isArray(specs) ? specs : specs && Array.isArray(specs.viz) ? specs.viz : [];
  const types = new Set(list.filter(Boolean).map((s) => normalizeViz(s).type));
  const out: string[] = [];
  if (types.has('packet') || types.has('code')) out.push('packet');
  if (types.has('sequence-sim')) out.push('sim');
  return out;
}

const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: any, name: string, errs: string[], min = 1) => {
  if (!Array.isArray(v) || v.length < min) {
    errs.push(`${name} must be a non-empty array`);
    return false;
  }
  return true;
};

/** Returns an error message, or null when the spec will render. */
export function validateViz(rawSpec: any): string | null {
  const spec = normalizeViz(rawSpec);
  if (!isObj(spec)) return 'viz spec must be an object';
  if (!isVizType(spec.type)) return `unknown viz type: ${spec.type}`;
  const e: string[] = [];
  const t = spec.type as VizType;
  const eachObj = (list: any[], name: string, check: (x: any, p: string) => void) =>
    list.forEach((x, i) => {
      if (!isObj(x)) e.push(`${name}[${i}] must be an object`);
      else check(x, `${name}[${i}]`);
    });
  switch (t) {
    case 'packet':
      if (arr(spec.fields, 'fields', e)) {
        eachObj(spec.fields, 'fields', (f, p) => {
          if (typeof f.key !== 'string' || !f.key) e.push(`${p}.key must be a string`);
          if (typeof f.bits !== 'number' || !(f.bits > 0)) e.push(`${p}.bits must be a positive number`);
        });
      }
      if (spec.modes !== undefined && !Array.isArray(spec.modes)) e.push('modes must be an array');
      else
        (spec.modes || []).forEach((m: any, i: number) => {
          if (!isObj(m) || typeof m.key !== 'string') e.push(`modes[${i}].key must be a string`);
        });
      if (spec.width !== undefined && !(typeof spec.width === 'number' && spec.width > 0)) e.push('width must be a positive number');
      break;
    case 'sequence-sim':
      if (typeof spec.title !== 'string') e.push('title must be a string');
      if (arr(spec.steps, 'steps', e))
        eachObj(spec.steps, 'steps', (s, p) => {
          if (typeof s.title !== 'string') e.push(`${p}.title must be a string`);
        });
      if (!Array.isArray(spec.nodes)) e.push('nodes must be an array');
      if (spec.table) {
        if (!Array.isArray(spec.table.columns)) e.push('table.columns must be an array');
        if (!Array.isArray(spec.table.rows)) e.push('table.rows must be an array');
      }
      break;
    case 'sequence':
      if (arr(spec.lanes, 'lanes', e) && arr(spec.messages, 'messages', e)) {
        const keys = spec.lanes.map((l: any) => l?.key);
        eachObj(spec.messages, 'messages', (m, p) => {
          for (const k of ['from', 'to']) if (!keys.includes(m[k])) e.push(`sequence viz: unknown lane key "${m[k]}" (${p}.${k})`);
        });
      }
      break;
    case 'compare-table':
      if (arr(spec.columns, 'columns', e) && arr(spec.rows, 'rows', e))
        eachObj(spec.rows, 'rows', (r, p) => {
          if (!Array.isArray(r.cells)) e.push(`${p}.cells must be an array`);
        });
      break;
    case 'contrast':
      for (const s of ['left', 'right']) if (!isObj(spec[s])) e.push(`${s} must be an object`);
      break;
    case 'key-grid':
      if (arr(spec.items, 'items', e)) eachObj(spec.items, 'items', () => {});
      break;
    case 'layers':
      if (arr(spec.layers, 'layers', e)) eachObj(spec.layers, 'layers', () => {});
      break;
    case 'opcodes':
      if (arr(spec.items, 'items', e)) eachObj(spec.items, 'items', () => {});
      break;
    case 'timeline':
      if (arr(spec.events, 'events', e)) eachObj(spec.events, 'events', () => {});
      break;
    case 'state-machine':
      if (arr(spec.states, 'states', e)) eachObj(spec.states, 'states', () => {});
      if (arr(spec.transitions, 'transitions', e)) eachObj(spec.transitions, 'transitions', () => {});
      break;
    case 'tree':
      if (!isObj(spec.root)) e.push('root must be an object');
      break;
    case 'code':
      if (typeof spec.code !== 'string') e.push('code must be a string');
      break;
  }
  return e.length ? e[0] : null;
}
