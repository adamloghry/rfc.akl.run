export const REPO = 'https://github.com/adamloghry/rfc.akl.run';

/** Minimal valid content objects, shown verbatim and validated by tests. */
export function starters() {
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
      sections: [
        {
          id: 'overview',
          number: '1',
          title: 'Overview',
          content: '<p>Explain this section of the RFC.</p>',
          eli5: '<p>The same idea, simpler.</p>',
        },
      ],
      viz: [{ type: 'key-grid', anchor: 'overview', position: 'after', data: { items: [{ title: 'Idea', text: 'One sentence.' }] } }],
      provenance,
    },
  };
}

export const SAMPLES: Record<string, any> = {
  packet: {
    type: 'packet',
    title: 'Mini header',
    bytes: 4,
    width: 32,
    fields: [
      { key: 'ver', name: 'Version', bits: 8, desc: 'Protocol version.', value: '1' },
      { key: 'len', name: 'Length', bits: 24, desc: 'Payload length.', value: '0' },
    ],
  },
  sequence: {
    type: 'sequence',
    lanes: [
      { key: 'a', label: 'Client' },
      { key: 'b', label: 'Server' },
    ],
    messages: [
      { from: 'a', to: 'b', label: 'request', color: 'blue' },
      { from: 'b', to: 'a', label: 'reply', color: 'green' },
    ],
  },
  'compare-table': {
    type: 'compare-table',
    columns: ['Option', 'Trade-off'],
    rows: [{ cells: ['Old way', 'Manual'] }, { cells: ['This RFC', 'Automatic'], self: true }],
  },
  contrast: {
    type: 'contrast',
    joiner: 'inverse of',
    left: { title: 'ARP', from: 'IP', to: 'MAC', desc: 'Who has this IP?' },
    right: { title: 'RARP', from: 'MAC', to: 'IP', desc: 'Who has this MAC?' },
  },
  'key-grid': {
    type: 'key-grid',
    items: [
      { title: 'One', text: 'First idea.' },
      { title: 'Two', text: 'Second idea.' },
    ],
  },
  layers: {
    type: 'layers',
    layers: [
      { label: 'Application', detail: 'HTTP' },
      { label: 'Link', detail: 'This RFC', highlight: true },
    ],
  },
  timeline: {
    type: 'timeline',
    events: [
      { year: 1984, label: 'RARP', rfc: 903 },
      { year: 1997, label: 'DHCP', rfc: 2131 },
    ],
  },
  'state-machine': {
    type: 'state-machine',
    states: [
      { key: 'a', label: 'IDLE', initial: true },
      { key: 'b', label: 'DONE', final: true },
    ],
    transitions: [{ from: 'a', to: 'b', label: 'reply received' }],
  },
  tree: { type: 'tree', root: { label: 'Root', children: [{ label: 'Leaf', note: 'note' }] } },
  opcodes: {
    type: 'opcodes',
    items: [
      { code: '1', label: 'Request' },
      { code: '2', label: 'Reply', highlight: true },
    ],
  },
  code: { type: 'code', title: 'example.txt', lang: 'text', code: 'a line of code' },
};

export const SHAPES: Record<string, string> = {
  packet: '{ title, bytes, width: 32, modes?: [{key,label}], fields: [{ key, name, bits, desc, value?, values?: {modeKey: string} }] }',
  'sequence-sim':
    '{ title, nodes: [{key,label,kind,x}], router?, packetFields: [{key,name}], table?, steps: [{ tag, title, eli5, spec, orig, why, packet, highlight, nodes, packetPos, packetLabel, packetColor }], failureSteps?, replacedBy? }',
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

export const pretty = (o: unknown) => JSON.stringify(o, null, 2);
