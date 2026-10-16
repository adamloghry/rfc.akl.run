import type { RfcRecord, Site } from '../../lib/model';

export const REPO = 'https://github.com/adamloghry/rfc.akl.run';
export const BLOCK = 1000;

export const DESCRIPTIONS: Record<string, string> = {
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

export const strip = (s: unknown) =>
  String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
export const byNum = (a: RfcRecord, b: RfcRecord) => a.number - b.number;
export const byPri = (a: RfcRecord, b: RfcRecord) => b.priority - a.priority || a.number - b.number;
export const pct = (a: number, b: number) => `${b ? ((a / b) * 100).toFixed(1) : '0.0'}%`;

export interface Tally {
  total: number;
  index: number;
  summary: number;
  explainer: number;
  interactive: number;
}
export function tally(list: RfcRecord[]): Tally {
  const t: any = { total: list.length, index: 0, summary: 0, explainer: 0, interactive: 0 };
  for (const r of list) t[r.tier]++;
  return t;
}

export function groups(site: Site): Map<string, RfcRecord[]> {
  const g = new Map<string, RfcRecord[]>(site.categories.map((c) => [c.key, []]));
  for (const r of site.rfcs.values()) (g.get(r.category) ?? (g.get('meta') as RfcRecord[])).push(r);
  return g;
}

export function indexBlocks(list: RfcRecord[]): { sorted: RfcRecord[]; blocks: [number, RfcRecord[]][] } {
  const sorted = [...list].sort(byNum);
  const blocks = new Map<number, RfcRecord[]>();
  for (const r of sorted) {
    const k = Math.floor((r.number - 1) / BLOCK);
    const block = blocks.get(k) ?? [];
    blocks.set(k, block);
    block.push(r);
  }
  return { sorted, blocks: [...blocks] };
}

export const issueUrl = (t: string) => `${REPO}/issues/new?template=${t}`;
