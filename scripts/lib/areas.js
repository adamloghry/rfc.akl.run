'use strict';
/** C6 order and names. */
const CATEGORIES = [
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

const WG = [
  ['http', 'httpbis|httpapi|httpauth|hybi|webpush|wpack|masque'],
  ['dns', 'dnsop|dnsext|dnsind|dprive|dnssd|add|dane|namedroppers|regext'],
  ['email', 'drums|emailcore|lemonade|imapext|sieve|dkim|dmarc|smtp|marid|eai|jmap|mailmaint'],
  ['routing', 'idr|ospf|isis|pim|mpls|bess|spring|lsr|rtgwg|sidr|sidrops|grow|babel|manet|roll'],
  ['security', 'tls|oauth|acme|lamps|pkix|ipsecme|ipsec|kitten|curdle|cfrg|saag|secdispatch|cose|jose|suit|rats|emu'],
  ['transport', 'tcpm|tsvwg|quic|tcpinc|ippm|tram|aqm|rmcat|taps'],
  ['data', 'cbor|json|jsonpath|asdf|sedate|netmod'],
].map(([cat, wgs]) => [cat, new Set(wgs.split('|'))]);

const TITLE = [
  ['dns', /\bDNS\b|Domain Name/i],
  ['http', /\bHTTP|Hypertext|\bURI\b|\bURL\b|WebSocket/i],
  ['email', /\bmail|SMTP|MIME|IMAP|POP3|message format/i],
  ['transport', /\bTCP\b|\bUDP\b|QUIC|SCTP|transport|congestion/i],
  ['routing', /routing|\bBGP|OSPF|\bRIP\b|IS-IS|MPLS|multicast/i],
  ['security', /security|crypt|\bTLS\b|authenticat|certificate|signature|key exchange|password/i],
  ['data', /encoding|\bASN\.1|JSON|\bXML|Base64|UTF-|character set|CBOR|YANG/i],
  ['core', /\bIPv[46]|Internet Protocol|\bICMP|\bARP\b|address resolution|Ethernet/i],
];

const AREA = {
  rtg: 'routing', ops: 'infrastructure', mgt: 'infrastructure', 'ops-old': 'infrastructure',
  int: 'core', ipng: 'core', sec: 'security', app: 'applications', art: 'applications', rai: 'applications',
  tsv: 'transport', wit: 'transport', gen: 'meta', usv: 'meta', sub: 'meta', osi: 'meta',
};

/** C6: WG map, then title regex, then area map, else 'meta'.
 *  @param {Partial<import('./rfc-index').IndexEntry>} entry @returns {string} category key */
function guessCategory(entry) {
  const wg = entry.wg ? String(entry.wg).toLowerCase() : null;
  if (wg) for (const [cat, set] of WG) if (set.has(wg)) return cat;
  const title = entry.title || '';
  for (const [cat, re] of TITLE) if (re.test(title)) return cat;
  const area = entry.area ? String(entry.area).toLowerCase() : null;
  if (area && Object.prototype.hasOwnProperty.call(AREA, area)) return AREA[area];
  return 'meta';
}

/** @param {string} key @returns {string} display name; throws on unknown key */
function name(key) {
  const c = CATEGORIES.find((x) => x.key === key);
  if (!c) throw new Error(`Unknown category: ${key}`);
  return c.name;
}

module.exports = { CATEGORIES, guessCategory, name };
