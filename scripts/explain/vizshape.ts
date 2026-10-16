/**
 * Strict viz shapes for generated explainers. validateViz (src/components/viz/validate.ts) only checks what
 * the renderer will not crash on; this adds the exact shapes the SPEC promises (no extra keys, tree depth,
 * sequence lane keys, and so on). VIZ_EXAMPLES also feeds SPEC.md, so the doc and the checker cannot drift.
 */

import { VIZ_TYPES } from '../../src/components/viz/validate';
import { each } from './util';

/** Types an agent may emit: everything the site renders except the interactive simulator. */
export const GENERATED_VIZ_TYPES = VIZ_TYPES.filter((t) => t !== 'sequence-sim');
export const MAX_TREE_DEPTH = 4;
export const MAX_TREE_NODES = 40;
export const SEQUENCE_COLORS = ['blue', 'green', 'neutral'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export const VIZ_EXAMPLES: Record<string, { use: string; data: Obj }> = {
  packet: {
    use: 'a fixed-layout header or message the RFC draws as a bit diagram. `bits` is the field width; fields wrap at `width` (default 32).',
    data: {
      title: 'Example header',
      bytes: 8,
      width: 32,
      fields: [
        { key: 'src-port', name: 'Source Port', bits: 16, desc: 'Port of the sender.' },
        { key: 'dst-port', name: 'Destination Port', bits: 16, desc: 'Port of the receiver.' },
        { key: 'length', name: 'Length', bits: 16, desc: 'Header plus data, in bytes.', value: '8' },
        { key: 'checksum', name: 'Checksum', bits: 16, desc: 'Error check over header and data.' },
      ],
    },
  },
  sequence: {
    use: 'a message exchange between 2 to 5 parties. `from` and `to` MUST be lane `key`s. `color` is blue, green or neutral.',
    data: {
      lanes: [
        { key: 'client', label: 'Client' },
        { key: 'server', label: 'Server' },
      ],
      messages: [
        { from: 'client', to: 'server', label: 'REQUEST', color: 'blue', note: 'What the client asks for.' },
        { from: 'server', to: 'client', label: 'REPLY', color: 'green' },
      ],
    },
  },
  'compare-table': {
    use: 'a side-by-side comparison. Every row has exactly one cell per column; the first cell is the row header. `self: true` marks the row for this RFC.',
    data: {
      columns: ['Version', 'Address size'],
      rows: [{ cells: ['IPv4', '32 bits'] }, { cells: ['IPv6', '128 bits'], self: true }],
    },
  },
  contrast: {
    use: 'two things that mirror or oppose each other (request/reply, old/new). `joiner` is the word between them (default "inverse of").',
    data: {
      left: { title: 'Request', from: 'client', to: 'server', desc: 'Asks a question.' },
      right: { title: 'Reply', from: 'server', to: 'client', desc: 'Answers it.' },
      joiner: 'answered by',
    },
  },
  'key-grid': {
    use: '2 to 8 short key ideas or properties.',
    data: {
      items: [
        { title: 'Checksum', text: 'Detects corruption.' },
        { title: 'Retry', text: 'Resends lost data.' },
      ],
    },
  },
  layers: {
    use: 'where the protocol sits in a stack (2 to 8 layers, top to bottom). `highlight: true` marks this RFC.',
    data: {
      layers: [
        { label: 'Application', detail: 'The program using the protocol' },
        { label: 'This protocol', detail: 'What the RFC defines', highlight: true },
        { label: 'IP', detail: 'Delivers packets' },
      ],
    },
  },
  timeline: {
    use: 'dated events (at most 10). `rfc`, when present, must be an issued RFC number; it becomes a link.',
    data: {
      events: [
        { year: 1981, label: 'Original specification', rfc: 793 },
        { year: 2022, label: 'Consolidated specification' },
      ],
    },
  },
  'state-machine': {
    use: 'states and transitions the RFC defines. Transition `from` and `to` MUST be state `key`s.',
    data: {
      states: [
        { key: 'closed', label: 'CLOSED', initial: true },
        { key: 'open', label: 'OPEN' },
      ],
      transitions: [
        { from: 'closed', to: 'open', label: 'open request' },
        { from: 'open', to: 'closed', label: 'close request' },
      ],
    },
  },
  tree: {
    use: 'a hierarchy such as a name space or object tree. At most 4 levels (the root counts as level 1) and 40 nodes.',
    data: {
      root: {
        label: 'root',
        note: 'optional note',
        children: [{ label: 'child A' }, { label: 'child B', children: [{ label: 'grandchild' }] }],
      },
    },
  },
  opcodes: {
    use: 'a table of codes, types or flags with their meaning (at most 24 rows). `highlight: true` marks the important one.',
    data: {
      items: [
        { code: '1', label: 'REQUEST', desc: 'Asks for something.' },
        { code: '2', label: 'REPLY', desc: 'Answers a request.', highlight: true },
      ],
    },
  },
  code: {
    use: 'a short verbatim or illustrative text snippet (a message, ABNF, pseudo-code). Rendered escaped, so write it raw. If you wrote it as an illustration rather than copying the RFC, say so in `caption`.',
    data: { title: 'Example message', lang: 'text', code: 'HELLO world\nBYE' },
  },
};

const allowKeys = (o: Obj, allowed: string[], p: string, e: string[]) => {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) e.push(`${p}: unexpected key "${k}" (allowed: ${allowed.join(', ')})`);
};
const needStr = (o: Obj, k: string, p: string, e: string[], max = 300) => {
  if (!isStr(o[k])) e.push(`${p}.${k} must be a non-empty string`);
  else if ((o[k] as string).length > max) e.push(`${p}.${k} is too long (${(o[k] as string).length} chars, max ${max})`);
};
const optStr = (o: Obj, k: string, p: string, e: string[], max = 300) => {
  if (o[k] !== undefined) needStr(o, k, p, e, max);
};
const optBool = (o: Obj, k: string, p: string, e: string[]) => {
  if (o[k] !== undefined && typeof o[k] !== 'boolean') e.push(`${p}.${k} must be true or false`);
};
const list = (o: Obj, k: string, p: string, e: string[], min: number, max: number): Obj[] => {
  const v = o[k];
  if (!Array.isArray(v)) {
    e.push(`${p}.${k} must be an array`);
    return [];
  }
  if (v.length < min || v.length > max) e.push(`${p}.${k} must have ${min} to ${max} items (has ${v.length})`);
  const out: Obj[] = [];
  each(v, (x, i) => {
    if (!isObj(x)) e.push(`${p}.${k}[${i}] must be an object`);
    else out.push(x);
  });
  return out;
};

function treeCheck(node: unknown, depth: number, p: string, e: string[], count: { n: number }) {
  if (!isObj(node)) {
    e.push(`${p} must be an object`);
    return;
  }
  count.n++;
  allowKeys(node, ['label', 'note', 'children'], p, e);
  needStr(node, 'label', p, e, 120);
  optStr(node, 'note', p, e, 200);
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) e.push(`${p}.children must be an array`);
    else if (node.children.length) {
      if (depth >= MAX_TREE_DEPTH) e.push(`${p}: tree is deeper than ${MAX_TREE_DEPTH} levels; flatten it or summarize the lower levels`);
      else each(node.children, (c, i) => treeCheck(c, depth + 1, `${p}.children[${i}]`, e, count));
    }
  }
}

/** Strict-shape errors for the `data` of one viz (type already known to be allowed). */
export function strictVizData(type: string, d: unknown, p: string, issued: (n: number) => boolean): string[] {
  const e: string[] = [];
  if (!isObj(d)) return [`${p} must be an object`];
  switch (type) {
    case 'packet': {
      allowKeys(d, ['title', 'bytes', 'width', 'modes', 'fields'], p, e);
      optStr(d, 'title', p, e, 80);
      if (d.bytes !== undefined && !(typeof d.bytes === 'number' && d.bytes > 0)) e.push(`${p}.bytes must be a positive number`);
      if (d.width !== undefined && !(typeof d.width === 'number' && d.width > 0 && d.width <= 64))
        e.push(`${p}.width must be a number from 1 to 64`);
      const modeKeys: string[] = [];
      if (d.modes !== undefined) {
        for (const [i, m] of list(d, 'modes', p, e, 1, 6).entries()) {
          allowKeys(m, ['key', 'label'], `${p}.modes[${i}]`, e);
          needStr(m, 'key', `${p}.modes[${i}]`, e, 40);
          needStr(m, 'label', `${p}.modes[${i}]`, e, 40);
          modeKeys.push(String(m.key));
        }
      }
      const seen = new Set<string>();
      for (const [i, f] of list(d, 'fields', p, e, 1, 40).entries()) {
        const fp = `${p}.fields[${i}]`;
        allowKeys(f, ['key', 'name', 'bits', 'desc', 'label', 'value', 'values'], fp, e);
        if (!isStr(f.key) || !KEBAB.test(String(f.key))) e.push(`${fp}.key must be kebab-case (lowercase letters, digits, hyphens)`);
        else if (seen.has(String(f.key))) e.push(`${fp}.key "${f.key}" is used twice`);
        else seen.add(String(f.key));
        needStr(f, 'name', fp, e, 80);
        needStr(f, 'desc', fp, e, 300);
        optStr(f, 'label', fp, e, 40);
        if (!(typeof f.bits === 'number' && Number.isInteger(f.bits) && f.bits > 0)) e.push(`${fp}.bits must be a positive whole number`);
        if (f.value !== undefined && typeof f.value !== 'string' && typeof f.value !== 'number')
          e.push(`${fp}.value must be a string or number`);
        if (f.values !== undefined) {
          if (!isObj(f.values)) e.push(`${fp}.values must be an object keyed by mode key`);
          else
            for (const k of Object.keys(f.values)) if (!modeKeys.includes(k)) e.push(`${fp}.values has key "${k}" that is not a mode key`);
        }
      }
      break;
    }
    case 'sequence': {
      allowKeys(d, ['lanes', 'messages'], p, e);
      const keys: string[] = [];
      for (const [i, l] of list(d, 'lanes', p, e, 2, 5).entries()) {
        allowKeys(l, ['key', 'label', 'dashed'], `${p}.lanes[${i}]`, e);
        if (!isStr(l.key) || !KEBAB.test(String(l.key))) e.push(`${p}.lanes[${i}].key must be kebab-case`);
        else if (keys.includes(String(l.key))) e.push(`${p}.lanes[${i}].key "${l.key}" is used twice`);
        else keys.push(String(l.key));
        needStr(l, 'label', `${p}.lanes[${i}]`, e, 40);
        optBool(l, 'dashed', `${p}.lanes[${i}]`, e);
      }
      for (const [i, m] of list(d, 'messages', p, e, 1, 20).entries()) {
        const mp = `${p}.messages[${i}]`;
        allowKeys(m, ['from', 'to', 'label', 'color', 'note'], mp, e);
        for (const k of ['from', 'to'])
          if (!keys.includes(String(m[k]))) e.push(`${mp}.${k} "${m[k]}" is not a lane key (lane keys: ${keys.join(', ') || 'none'})`);
        needStr(m, 'label', mp, e, 120);
        optStr(m, 'note', mp, e, 300);
        if (m.color !== undefined && !SEQUENCE_COLORS.includes(String(m.color)))
          e.push(`${mp}.color must be one of ${SEQUENCE_COLORS.join(', ')}`);
      }
      break;
    }
    case 'compare-table': {
      allowKeys(d, ['columns', 'rows'], p, e);
      const cols = Array.isArray(d.columns) ? d.columns : [];
      if (cols.length < 2 || cols.length > 6 || !cols.every(isStr)) e.push(`${p}.columns must be 2 to 6 non-empty strings`);
      for (const [i, r] of list(d, 'rows', p, e, 1, 20).entries()) {
        allowKeys(r, ['cells', 'self'], `${p}.rows[${i}]`, e);
        if (!Array.isArray(r.cells) || !r.cells.every((c) => typeof c === 'string' || typeof c === 'number'))
          e.push(`${p}.rows[${i}].cells must be an array of strings`);
        else if (r.cells.length !== cols.length)
          e.push(`${p}.rows[${i}].cells has ${r.cells.length} cells but there are ${cols.length} columns`);
        optBool(r, 'self', `${p}.rows[${i}]`, e);
      }
      break;
    }
    case 'contrast': {
      allowKeys(d, ['left', 'right', 'joiner'], p, e);
      optStr(d, 'joiner', p, e, 40);
      for (const side of ['left', 'right']) {
        const s = d[side];
        if (!isObj(s)) {
          e.push(`${p}.${side} must be an object`);
          continue;
        }
        allowKeys(s, ['title', 'from', 'to', 'desc'], `${p}.${side}`, e);
        for (const k of ['title', 'from', 'to', 'desc']) needStr(s, k, `${p}.${side}`, e, 200);
      }
      break;
    }
    case 'key-grid': {
      allowKeys(d, ['items'], p, e);
      for (const [i, it] of list(d, 'items', p, e, 2, 8).entries()) {
        allowKeys(it, ['title', 'text'], `${p}.items[${i}]`, e);
        needStr(it, 'title', `${p}.items[${i}]`, e, 80);
        needStr(it, 'text', `${p}.items[${i}]`, e, 300);
      }
      break;
    }
    case 'layers': {
      allowKeys(d, ['layers'], p, e);
      for (const [i, l] of list(d, 'layers', p, e, 2, 8).entries()) {
        allowKeys(l, ['label', 'detail', 'highlight'], `${p}.layers[${i}]`, e);
        needStr(l, 'label', `${p}.layers[${i}]`, e, 80);
        needStr(l, 'detail', `${p}.layers[${i}]`, e, 200);
        optBool(l, 'highlight', `${p}.layers[${i}]`, e);
      }
      break;
    }
    case 'timeline': {
      allowKeys(d, ['events'], p, e);
      for (const [i, ev] of list(d, 'events', p, e, 2, 10).entries()) {
        const ep = `${p}.events[${i}]`;
        allowKeys(ev, ['year', 'label', 'rfc'], ep, e);
        if (!(typeof ev.year === 'number' && Number.isInteger(ev.year) && ev.year >= 1950 && ev.year <= 2100))
          e.push(`${ep}.year must be a whole year number`);
        needStr(ev, 'label', ep, e, 160);
        if (ev.rfc !== undefined && !(typeof ev.rfc === 'number' && issued(ev.rfc)))
          e.push(`${ep}.rfc ${JSON.stringify(ev.rfc)} is not an issued RFC number`);
      }
      break;
    }
    case 'state-machine': {
      allowKeys(d, ['states', 'transitions'], p, e);
      const keys: string[] = [];
      for (const [i, s] of list(d, 'states', p, e, 2, 20).entries()) {
        allowKeys(s, ['key', 'label', 'initial', 'final'], `${p}.states[${i}]`, e);
        if (!isStr(s.key) || !KEBAB.test(String(s.key))) e.push(`${p}.states[${i}].key must be kebab-case`);
        else if (keys.includes(String(s.key))) e.push(`${p}.states[${i}].key "${s.key}" is used twice`);
        else keys.push(String(s.key));
        needStr(s, 'label', `${p}.states[${i}]`, e, 60);
        optBool(s, 'initial', `${p}.states[${i}]`, e);
        optBool(s, 'final', `${p}.states[${i}]`, e);
      }
      for (const [i, t] of list(d, 'transitions', p, e, 1, 40).entries()) {
        const tp = `${p}.transitions[${i}]`;
        allowKeys(t, ['from', 'to', 'label'], tp, e);
        for (const k of ['from', 'to'])
          if (!keys.includes(String(t[k]))) e.push(`${tp}.${k} "${t[k]}" is not a state key (state keys: ${keys.join(', ')})`);
        needStr(t, 'label', tp, e, 160);
      }
      break;
    }
    case 'tree': {
      allowKeys(d, ['root'], p, e);
      const count = { n: 0 };
      treeCheck(d.root, 1, `${p}.root`, e, count);
      if (count.n > MAX_TREE_NODES) e.push(`${p}.root has ${count.n} nodes (max ${MAX_TREE_NODES})`);
      break;
    }
    case 'opcodes': {
      allowKeys(d, ['items'], p, e);
      for (const [i, it] of list(d, 'items', p, e, 1, 24).entries()) {
        const ip = `${p}.items[${i}]`;
        allowKeys(it, ['code', 'label', 'desc', 'highlight'], ip, e);
        if (!(isStr(it.code) || typeof it.code === 'number')) e.push(`${ip}.code must be a string or number`);
        needStr(it, 'label', ip, e, 80);
        optStr(it, 'desc', ip, e, 300);
        optBool(it, 'highlight', ip, e);
      }
      break;
    }
    case 'code': {
      allowKeys(d, ['title', 'lang', 'code'], p, e);
      optStr(d, 'title', p, e, 80);
      optStr(d, 'lang', p, e, 20);
      needStr(d, 'code', p, e, 3000);
      break;
    }
    default:
      e.push(`${p}: unknown viz type "${type}"`);
  }
  return e;
}
