/** C6 order and names. */
export interface Category {
  key: string;
  name: string;
}
export const CATEGORIES: Category[] = [
  { key: 'core', name: 'Core Protocols' },
  { key: 'dns', name: 'DNS' },
  { key: 'http', name: 'HTTP & Web' },
  { key: 'transport', name: 'Transport' },
  { key: 'security', name: 'Security' },
  { key: 'email', name: 'Email' },
  { key: 'routing', name: 'Routing' },
  { key: 'applications', name: 'Applications' },
  { key: 'infrastructure', name: 'Infrastructure' },
  { key: 'data', name: 'Data & Encoding' },
  { key: 'meta', name: 'Meta & Culture' },
];

const WG: [string, Set<string>][] = [
  ['http', 'httpbis|httpapi|httpauth|hybi|webpush|wpack|masque'],
  ['dns', 'dnsop|dnsext|dnsind|dprive|dnssd|add|dane|namedroppers|regext'],
  ['email', 'drums|emailcore|lemonade|imapext|sieve|dkim|dmarc|smtp|marid|eai|jmap|mailmaint'],
  ['routing', 'idr|ospf|isis|pim|mpls|bess|spring|lsr|rtgwg|sidr|sidrops|grow|babel|manet|roll'],
  ['security', 'tls|oauth|acme|lamps|pkix|ipsecme|ipsec|kitten|curdle|cfrg|saag|secdispatch|cose|jose|suit|rats|emu'],
  ['transport', 'tcpm|tsvwg|quic|tcpinc|ippm|tram|aqm|rmcat|taps'],
  ['data', 'cbor|json|jsonpath|asdf|sedate|netmod'],
].map(([cat, wgs]) => [cat, new Set(wgs.split('|'))] as [string, Set<string>]);

const TITLE: [string, RegExp][] = [
  ['dns', /\bDNS\b|Domain Name/i],
  ['http', /\bHTTP|Hypertext|\bURI\b|\bURL\b|WebSocket/i],
  ['email', /\bmail|SMTP|MIME|IMAP|POP3|message format/i],
  ['transport', /\bTCP\b|\bUDP\b|QUIC|SCTP|transport|congestion/i],
  ['routing', /routing|\bBGP|OSPF|\bRIP\b|IS-IS|MPLS|multicast/i],
  ['security', /security|crypt|\bTLS\b|authenticat|certificate|signature|key exchange|password/i],
  ['data', /encoding|\bASN\.1|JSON|\bXML|Base64|UTF-|character set|CBOR|YANG/i],
  ['core', /\bIPv[46]|Internet Protocol|\bICMP|\bARP\b|address resolution|Ethernet/i],
];

const AREA: Record<string, string> = {
  rtg: 'routing',
  ops: 'infrastructure',
  mgt: 'infrastructure',
  'ops-old': 'infrastructure',
  int: 'core',
  ipng: 'core',
  sec: 'security',
  app: 'applications',
  art: 'applications',
  rai: 'applications',
  tsv: 'transport',
  wit: 'transport',
  gen: 'meta',
  usv: 'meta',
  sub: 'meta',
  osi: 'meta',
};

/** C6: WG map, then title regex, then area map, else 'meta'. */
export function guessCategory(entry: { wg?: string | null; title?: string; area?: string | null }): string {
  const wg = entry.wg ? String(entry.wg).toLowerCase() : null;
  if (wg) for (const [cat, set] of WG) if (set.has(wg)) return cat;
  const title = entry.title || '';
  for (const [cat, re] of TITLE) if (re.test(title)) return cat;
  const area = entry.area ? String(entry.area).toLowerCase() : null;
  if (area && Object.hasOwn(AREA, area)) return AREA[area];
  return 'meta';
}

export function name(key: string): string {
  const c = CATEGORIES.find((x) => x.key === key);
  if (!c) throw new Error(`Unknown category: ${key}`);
  return c.name;
}
