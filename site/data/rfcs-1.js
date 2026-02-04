window.RFC_DATA = window.RFC_DATA || [];
window.RFC_DATA.push(
{
  number: 903,
  title: 'A Reverse Address Resolution Protocol',
  shortTitle: 'RARP',
  authors: ['Ross Finlayson', 'Timothy Mann', 'Jeffrey C. Mogul', 'Marvin Theimer'],
  organization: 'Stanford University',
  date: 'June 1984',
  status: 'Historic',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'How diskless workstations discover their IP address from their hardware address',
    color: 'cyan',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '?', label: 'Diskless Client', detail: 'MAC: 08:00:20:01:AB:C2' },
      bottomNode: { icon: '\u{1F5A7}', label: 'RARP Server', detail: 'IP\u2194MAC Mapping Database' },
      reqLabel: 'RARP Request (Who am I?)',
      repLabel: 'RARP Reply (You are 192.0.2.1)'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The Reverse Address Resolution Protocol (RARP) allows a host to discover its Internet Protocol (IP) address when it only knows its link-layer (hardware) address. This is the inverse of the Address Resolution Protocol (ARP) defined in <strong>RFC 826</strong>, which maps IP addresses to hardware addresses.</p>' +
        '<div class="callout callout-info"><p>RARP was one of the earliest solutions to the bootstrap problem: how does a machine with no persistent storage learn its network-layer identity at boot time?</p></div>' +
        '<p>RARP reuses the ARP packet format with different operation codes, allowing it to ride on top of the existing ARP infrastructure already present in Ethernet hardware and drivers.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Core Problem</div><div class="key-point-text">Diskless workstations know their Ethernet MAC address (burned into ROM) but need an IP address to participate on a TCP/IP network.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Solution</div><div class="key-point-text">Broadcast a RARP request containing the MAC address. A RARP server with a MAC-to-IP database replies with the corresponding IP address.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Relationship to ARP</div><div class="key-point-text">RARP uses the same packet format as ARP but with opcodes 3 (request) and 4 (reply) instead of ARP\'s 1 and 2.</div></div></div>'
    },
    {
      id: 'motivation',
      number: '2',
      title: 'Motivation',
      content: '<p>In the early 1980s, Sun Microsystems and other manufacturers popularized <strong>diskless workstations</strong> \u2014 machines that booted entirely over the network. These machines had no local disk to store configuration, yet they needed an IP address to communicate via TCP/IP.</p>' +
        '<p>The machine\'s Ethernet address is available in hardware ROM, but IP addresses are assigned by network administrators and have no algorithmic relationship to the hardware address. Some mechanism was needed to bridge this gap.</p>' +
        '<div class="callout callout-note"><p>Before RARP, the only alternative was BOOTP or manual configuration via a boot PROM that had the IP address hard-coded. RARP provided a simpler, link-layer solution that required no IP-level infrastructure.</p></div>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Approach</div><div class="comparison-col">Pros</div><div class="comparison-col">Cons</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Hard-coded IP in PROM</div><div class="comparison-col">Simple, no server needed</div><div class="comparison-col">Not scalable, error-prone</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">RARP</div><div class="comparison-col">Centralized database, automatic</div><div class="comparison-col">Requires RARP server on each network</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">BOOTP (later)</div><div class="comparison-col">Routable, provides more info</div><div class="comparison-col">More complex, needs UDP/IP stack</div></div></div>'
    },
    {
      id: 'design',
      number: '3',
      title: 'Design',
      content: '<p>RARP was designed with several key principles in mind:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Reuse ARP Infrastructure</div><div class="key-point-text">By sharing ARP\'s packet format and Ethernet frame type (0x8035), RARP leveraged existing network driver code. The only changes were new opcodes and reversed lookup semantics.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Link-Layer Operation</div><div class="key-point-text">RARP operates entirely at the data link layer. No IP routing is involved, so both client and server must be on the same physical network.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Broadcast Request / Unicast Reply</div><div class="key-point-text">The client broadcasts its request to all stations on the LAN. The server responds with a unicast reply directly to the client\'s hardware address.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Server-Side Database</div><div class="key-point-text">The RARP server maintains a table mapping hardware addresses to IP addresses. On Unix systems, this was typically the /etc/ethers file.</div></div></div>' +
        '<div class="callout callout-warning"><p>RARP cannot cross router boundaries because it uses link-layer broadcasts. Each physical network segment requires its own RARP server. This limitation eventually led to the development of BOOTP and DHCP.</p></div>'
    },
    {
      id: 'packet-format',
      number: '4',
      title: 'Packet Format',
      content: '<p>RARP uses the same packet format as ARP, encapsulated in an Ethernet frame with EtherType <code>0x8035</code>:</p>' +
        '<div class="packet-diagram"><div class="packet-diagram-title">RARP Packet Format (28 bytes for IPv4 over Ethernet)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|         Hardware Type         |         Protocol Type         |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|  HW Addr Len  | Proto Addr Len|           Operation           |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                Sender Hardware Address (bytes 0-3)            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n| Sender HW Addr (bytes 4-5)    |  Sender Protocol Addr (0-1)  |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n| Sender Proto Addr (bytes 2-3) | Target HW Addr (bytes 0-1)   |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                Target Hardware Address (bytes 2-5)            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                Target Protocol Address (bytes 0-3)            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Hardware Type</span><span class="field-detail">Network link protocol type. Ethernet = 1</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Protocol Type</span><span class="field-detail">Internetwork protocol. IPv4 = 0x0800</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">HW Addr Length</span><span class="field-detail">Length of hardware address. Ethernet = 6</span><span class="field-size">1 byte</span></div>' +
        '<div class="field-item"><span class="field-name">Proto Addr Length</span><span class="field-detail">Length of protocol address. IPv4 = 4</span><span class="field-size">1 byte</span></div>' +
        '<div class="field-item"><span class="field-name">Operation</span><span class="field-detail">Identifies the type of ARP/RARP message</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Sender HW Addr</span><span class="field-detail">Hardware address of the sender</span><span class="field-size">6 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Sender Proto Addr</span><span class="field-detail">Protocol address of the sender</span><span class="field-size">4 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Target HW Addr</span><span class="field-detail">Hardware address of the target</span><span class="field-size">6 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Target Proto Addr</span><span class="field-detail">Protocol address of the target</span><span class="field-size">4 bytes</span></div></div>'
    },
    {
      id: 'protocol-operation',
      number: '5',
      title: 'Protocol Operation',
      content: '<p>RARP defines two new operation codes that extend the ARP opcode space:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">1</span><span>ARP Request \u2014 Who has this IP? Tell me your MAC.</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">2</span><span>ARP Reply \u2014 That IP is at this MAC address.</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">3</span><span>RARP Request \u2014 Who has this MAC? Tell me its IP.</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">4</span><span>RARP Reply \u2014 That MAC address maps to this IP.</span></div></div>' +
        '<p>The protocol flow is as follows:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Step 1: Client Broadcasts Request</div><div class="key-point-text">The diskless workstation fills in its own hardware address in both the Sender and Target hardware address fields, sets the operation to 3 (RARP Request), and broadcasts the packet on the local Ethernet.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Step 2: Server Looks Up Address</div><div class="key-point-text">A RARP server on the same network receives the broadcast, looks up the target hardware address in its database (e.g., /etc/ethers), and finds the corresponding IP address.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Step 3: Server Sends Reply</div><div class="key-point-text">The server fills in the Target Protocol Address with the resolved IP, sets the operation to 4 (RARP Reply), and unicasts the packet back to the client\'s hardware address.</div></div></div>' +
        '<div class="callout callout-info"><p>Unlike ARP, where any host can reply, RARP replies come only from designated RARP servers that maintain the address mapping database. Multiple servers may exist for redundancy.</p></div>'
    },
    {
      id: 'implementation',
      number: '6',
      title: 'Implementation',
      content: '<p>Implementing RARP involves several practical considerations:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Server Placement</div><div class="key-point-text">At least one RARP server must exist on each physical network segment. Since RARP is a link-layer protocol, requests do not cross routers. Multiple servers are recommended for fault tolerance.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Address Database</div><div class="key-point-text">The server maintains a file mapping Ethernet addresses to IP addresses. On BSD Unix systems, this is typically /etc/ethers. The system administrator must keep this file up to date.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Retransmission</div><div class="key-point-text">Since RARP uses an unreliable broadcast mechanism, the client should retransmit the request if no reply is received within a timeout period. Exponential backoff is recommended.</div></div></div>' +
        '<div class="code-block"><div class="code-block-title">Example /etc/ethers file</div><pre>08:00:20:01:AB:C2  192.0.2.1    # sparc-ws-01\n08:00:20:01:AB:C3  192.0.2.2    # sparc-ws-02\n08:00:20:01:AB:C4  192.0.2.3    # sparc-ws-03\n08:00:20:01:AB:C5  192.0.2.4    # sparc-ws-04</pre></div>' +
        '<div class="callout callout-warning"><p>RARP has been largely superseded by BOOTP (RFC 951) and DHCP (RFC 2131), which operate at the IP layer, can be routed across networks, and provide additional configuration parameters beyond just the IP address.</p></div>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">EtherType</span><span class="field-table-val">0x8035 (RARP)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Broadcast Address</span><span class="field-table-val">FF:FF:FF:FF:FF:FF</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Min Packet Size</span><span class="field-table-val">28 bytes (Ethernet/IPv4)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Successor Protocols</span><span class="field-table-val">BOOTP, DHCP</span></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Plummer, D., "An Ethernet Address Resolution Protocol", RFC 826, November 1982.' },
    { number: '[2]', text: 'Croft, W. and J. Gilmore, "Bootstrap Protocol (BOOTP)", RFC 951, September 1985.' },
    { number: '[3]', text: 'Droms, R., "Dynamic Host Configuration Protocol", RFC 2131, March 1997.' },
    { number: '[4]', text: 'Postel, J., "Internet Protocol", RFC 791, September 1981.' }
  ]
},
{
  number: 768,
  title: 'User Datagram Protocol',
  shortTitle: 'UDP',
  authors: ['J. Postel'],
  organization: 'ISI',
  date: 'August 1980',
  status: 'Internet Standard',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The simplest transport protocol \u2014 connectionless, fast, and minimal overhead',
    color: 'green',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\u{1F4E4}', label: 'Sender', detail: 'Application Data' },
      bottomNode: { icon: '\u{1F4E5}', label: 'Receiver', detail: 'Port 53 (DNS)' },
      reqLabel: 'UDP Datagram',
      repLabel: 'UDP Datagram'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The User Datagram Protocol (UDP) provides a simple, connectionless transport service for applications that need to send datagrams without the overhead of connection setup, reliability guarantees, or flow control.</p>' +
        '<div class="callout callout-info"><p>UDP is one of the two original transport protocols of the Internet protocol suite, alongside TCP. Where TCP provides reliability, UDP provides simplicity and speed.</p></div>' +
        '<p>UDP adds only a thin layer on top of IP: source and destination port numbers for multiplexing, a length field, and an optional checksum. The entire header is just <strong>8 bytes</strong>.</p>'
    },
    {
      id: 'protocol-format',
      number: '2',
      title: 'Protocol Format',
      content: '<div class="packet-diagram"><div class="packet-diagram-title">UDP Header Format (8 bytes)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|          Source Port          |       Destination Port        |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|            Length             |           Checksum            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                         Data (variable)                       |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Source Port</span><span class="field-detail">Sending port number (optional, may be zero)</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Destination Port</span><span class="field-detail">Receiving port number</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Length</span><span class="field-detail">Length of UDP header + data in bytes (min 8)</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Checksum</span><span class="field-detail">Checksum of pseudo-header, header, and data</span><span class="field-size">2 bytes</span></div></div>'
    },
    {
      id: 'fields',
      number: '3',
      title: 'Fields',
      content: '<p>Each field in the UDP header serves a specific purpose:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Source Port (16 bits)</div><div class="key-point-text">An optional field. When used, it indicates the port of the sending process and may be assumed to be the reply port. If not used, a value of zero is inserted.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Destination Port (16 bits)</div><div class="key-point-text">The port within the destination host to which the datagram is addressed. This field is required and identifies the receiving application.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Length (16 bits)</div><div class="key-point-text">The total length of the UDP datagram (header + data) in octets. The minimum value is 8 (header only, no data). The maximum is 65,535 bytes.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Checksum (16 bits)</div><div class="key-point-text">Covers a pseudo-header (source IP, destination IP, protocol, UDP length), the UDP header, and the data. Optional in IPv4 (zero if not computed), mandatory in IPv6.</div></div></div>'
    },
    {
      id: 'usage',
      number: '4',
      title: 'Usage',
      content: '<p>UDP is the right transport choice when applications value speed and simplicity over guaranteed delivery:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Feature</div><div class="comparison-col">UDP</div><div class="comparison-col">TCP</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Connection Setup</div><div class="comparison-col">None</div><div class="comparison-col">Three-way handshake</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Reliability</div><div class="comparison-col">None (best effort)</div><div class="comparison-col">Guaranteed delivery</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Ordering</div><div class="comparison-col">Not guaranteed</div><div class="comparison-col">Guaranteed (sequence numbers)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Header Size</div><div class="comparison-col">8 bytes</div><div class="comparison-col">20+ bytes</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Flow Control</div><div class="comparison-col">None</div><div class="comparison-col">Sliding window</div></div></div>' +
        '<div class="callout callout-note"><p>Applications using UDP must handle their own reliability if needed (e.g., DNS retransmits queries, QUIC builds reliability on top of UDP).</p></div>'
    },
    {
      id: 'applications',
      number: '5',
      title: 'Applications',
      content: '<p>Many of the Internet\'s most important protocols rely on UDP as their transport:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">53</span><span>DNS \u2014 Domain Name System queries and responses</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">67/68</span><span>DHCP \u2014 Dynamic Host Configuration Protocol</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">123</span><span>NTP \u2014 Network Time Protocol</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">161</span><span>SNMP \u2014 Simple Network Management Protocol</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">443</span><span>QUIC \u2014 Modern transport for HTTP/3</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">5353</span><span>mDNS \u2014 Multicast DNS (zero-config)</span></div></div>' +
        '<div class="callout callout-info"><p>The rise of QUIC (RFC 9000) has given UDP new prominence. QUIC builds a reliable, multiplexed transport on top of UDP, enabling HTTP/3 and demonstrating that UDP serves as an excellent foundation for innovation.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Postel, J., "Internet Protocol", RFC 791, September 1981.' },
    { number: '[2]', text: 'Postel, J., "Transmission Control Protocol", RFC 793, September 1981.' }
  ]
},
{
  number: 791,
  title: 'Internet Protocol',
  shortTitle: 'IPv4',
  authors: ['J. Postel'],
  organization: 'ISI',
  date: 'September 1981',
  status: 'Internet Standard',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The foundational network layer protocol that routes packets across the global Internet',
    color: 'blue',
    animation: 'layers',
    animationData: {
      layers: [
        { name: 'Application', detail: 'HTTP, DNS, SMTP, FTP', highlight: false },
        { name: 'Transport', detail: 'TCP, UDP', highlight: false },
        { name: 'Internet (IP)', detail: 'Addressing, Routing, Fragmentation', highlight: true },
        { name: 'Link', detail: 'Ethernet, Wi-Fi, PPP', highlight: false }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The Internet Protocol (IP) is the principal network-layer protocol of the Internet protocol suite. It provides the addressing and routing mechanism that enables packets to traverse multiple networks from source to destination.</p>' +
        '<div class="callout callout-info"><p>IP is a <strong>connectionless, best-effort</strong> delivery service. It makes no guarantees about packet delivery, ordering, or integrity \u2014 those responsibilities are left to higher-layer protocols like TCP.</p></div>' +
        '<p>Every device on the Internet is identified by at least one IP address. IPv4 uses 32-bit addresses, providing approximately 4.3 billion unique addresses.</p>'
    },
    {
      id: 'overview',
      number: '2',
      title: 'Overview',
      content: '<p>IP performs two fundamental functions:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Addressing</div><div class="key-point-text">Each IP datagram carries a 32-bit source address and a 32-bit destination address. These addresses identify the sending and receiving hosts and enable routers to make forwarding decisions.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Fragmentation and Reassembly</div><div class="key-point-text">When a datagram is too large for a network\'s Maximum Transmission Unit (MTU), IP can fragment it into smaller pieces. The destination host reassembles the fragments into the original datagram.</div></div></div>' +
        '<div class="callout callout-note"><p>IP treats each datagram independently. Two successive datagrams from the same source to the same destination may take entirely different routes through the network.</p></div>'
    },
    {
      id: 'specification',
      number: '3',
      title: 'Specification',
      content: '<p>The IP specification defines the datagram format, addressing conventions, and the rules for fragmentation and reassembly.</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">Protocol Version</span><span class="field-table-val">4 (IPv4)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Address Size</span><span class="field-table-val">32 bits (4 octets)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Max Datagram Size</span><span class="field-table-val">65,535 bytes</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Min Header Size</span><span class="field-table-val">20 bytes (no options)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Max Header Size</span><span class="field-table-val">60 bytes (with options)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Min MTU Required</span><span class="field-table-val">576 bytes</span></div></div>'
    },
    {
      id: 'addressing',
      number: '4',
      title: 'Addressing',
      content: '<p>IPv4 addresses are 32 bits long, typically written in dotted-decimal notation (e.g., <code>192.0.2.1</code>). Originally, addresses were divided into classes:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">A</span><span>1.0.0.0 \u2013 126.255.255.255 (16M hosts/net)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">B</span><span>128.0.0.0 \u2013 191.255.255.255 (65K hosts/net)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">C</span><span>192.0.0.0 \u2013 223.255.255.255 (254 hosts/net)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">D</span><span>224.0.0.0 \u2013 239.255.255.255 (Multicast)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">E</span><span>240.0.0.0 \u2013 255.255.255.255 (Reserved)</span></div></div>' +
        '<div class="callout callout-warning"><p>Classful addressing was wasteful and has been replaced by CIDR (Classless Inter-Domain Routing, RFC 4632) which allows arbitrary prefix lengths, enabling more efficient address allocation.</p></div>'
    },
    {
      id: 'fragmentation',
      number: '5',
      title: 'Fragmentation',
      content: '<p>When an IP datagram exceeds the MTU of the outgoing network, the router fragments the datagram into smaller pieces that fit:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Identification</div><div class="key-point-text">A 16-bit field set by the sender. All fragments of the same datagram carry the same Identification value so the receiver can group them.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Fragment Offset</div><div class="key-point-text">Indicates where in the original datagram this fragment belongs, measured in 8-byte units. This allows the receiver to reassemble fragments in the correct order.</div></div>' +
        '<div class="key-point"><div class="key-point-title">More Fragments (MF) Flag</div><div class="key-point-text">Set to 1 on all fragments except the last one. When a receiver gets a fragment with MF=0, it knows this is the final piece.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Don\'t Fragment (DF) Flag</div><div class="key-point-text">When set, routers must not fragment this datagram. If it exceeds the MTU, the router drops it and sends an ICMP "Fragmentation Needed" message back.</div></div></div>'
    },
    {
      id: 'header-format',
      number: '6',
      title: 'Header Format',
      content: '<div class="packet-diagram"><div class="packet-diagram-title">IPv4 Header Format (20-60 bytes)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|Version|  IHL  |    DSCP   |ECN|         Total Length          |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|         Identification        |Flags|     Fragment Offset     |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|  Time to Live |    Protocol   |        Header Checksum        |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                       Source Address                          |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                    Destination Address                         |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                    Options (variable, optional)                |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Version</span><span class="field-detail">IP version number (4 for IPv4)</span><span class="field-size">4 bits</span></div>' +
        '<div class="field-item"><span class="field-name">IHL</span><span class="field-detail">Internet Header Length in 32-bit words</span><span class="field-size">4 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Total Length</span><span class="field-detail">Entire datagram size in bytes</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">TTL</span><span class="field-detail">Hop limit; decremented by each router</span><span class="field-size">8 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Protocol</span><span class="field-detail">Next-layer protocol (6=TCP, 17=UDP, 1=ICMP)</span><span class="field-size">8 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Header Checksum</span><span class="field-detail">Error detection for the header only</span><span class="field-size">16 bits</span></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Postel, J., "Internet Control Message Protocol", RFC 792, September 1981.' },
    { number: '[2]', text: 'Postel, J., "Transmission Control Protocol", RFC 793, September 1981.' },
    { number: '[3]', text: 'Deering, S. and R. Hinden, "Internet Protocol, Version 6 (IPv6) Specification", RFC 2460, December 1998.' }
  ]
},
{
  number: 792,
  title: 'Internet Control Message Protocol',
  shortTitle: 'ICMP',
  authors: ['J. Postel'],
  organization: 'ISI',
  date: 'September 1981',
  status: 'Internet Standard',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The error-reporting and diagnostic protocol that keeps the Internet running',
    color: 'orange',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\u{1F4BB}', label: 'Source Host', detail: '192.0.2.1' },
      bottomNode: { icon: '\u{1F5A5}', label: 'Destination', detail: '198.51.100.1' },
      reqLabel: 'Echo Request (ping)',
      repLabel: 'Echo Reply (pong)'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The Internet Control Message Protocol (ICMP) is used by network devices to send error messages and operational information. It is an integral part of the Internet Protocol suite, operating at the network layer alongside IP.</p>' +
        '<div class="callout callout-info"><p>ICMP messages are encapsulated inside IP datagrams (protocol number 1). Though ICMP uses IP for delivery, it is considered part of the IP layer, not a transport protocol.</p></div>' +
        '<p>ICMP serves two primary purposes: <strong>error reporting</strong> (e.g., destination unreachable) and <strong>diagnostics</strong> (e.g., ping and traceroute).</p>'
    },
    {
      id: 'message-types',
      number: '2',
      title: 'Message Types',
      content: '<p>ICMP messages are identified by a <strong>Type</strong> field and further refined by a <strong>Code</strong> field:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">0</span><span>Echo Reply \u2014 Response to a ping request</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">3</span><span>Destination Unreachable \u2014 Packet could not be delivered</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">5</span><span>Redirect \u2014 Better route available</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">8</span><span>Echo Request \u2014 Ping request</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">11</span><span>Time Exceeded \u2014 TTL expired in transit</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">12</span><span>Parameter Problem \u2014 Bad IP header</span></div></div>' +
        '<div class="packet-diagram"><div class="packet-diagram-title">ICMP Header Format</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|     Type      |     Code      |          Checksum             |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                   Type-specific Data (variable)               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>'
    },
    {
      id: 'echo',
      number: '3',
      title: 'Echo Request/Reply',
      content: '<p>The Echo Request (Type 8) and Echo Reply (Type 0) messages are the basis of the <code>ping</code> utility, one of the most widely used network diagnostic tools.</p>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Type</span><span class="field-detail">8 for request, 0 for reply</span><span class="field-size">1 byte</span></div>' +
        '<div class="field-item"><span class="field-name">Code</span><span class="field-detail">Always 0</span><span class="field-size">1 byte</span></div>' +
        '<div class="field-item"><span class="field-name">Identifier</span><span class="field-detail">Used to match requests and replies</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Sequence Number</span><span class="field-detail">Incremented for each request sent</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Data</span><span class="field-detail">Arbitrary payload echoed back in the reply</span><span class="field-size">Variable</span></div></div>' +
        '<div class="code-block"><div class="code-block-title">Ping Example</div><pre>$ ping 198.51.100.1\nPING 198.51.100.1: 56 data bytes\n64 bytes from 198.51.100.1: icmp_seq=0 ttl=64 time=1.234 ms\n64 bytes from 198.51.100.1: icmp_seq=1 ttl=64 time=1.156 ms\n64 bytes from 198.51.100.1: icmp_seq=2 ttl=64 time=1.089 ms</pre></div>'
    },
    {
      id: 'error-reporting',
      number: '4',
      title: 'Error Reporting',
      content: '<p>When a router or destination host encounters a problem delivering a packet, it generates an ICMP error message and sends it back to the source.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Destination Unreachable (Type 3)</div><div class="key-point-text">Sent when a packet cannot reach its destination. Code values distinguish: 0=Network Unreachable, 1=Host Unreachable, 3=Port Unreachable, 4=Fragmentation Needed but DF set.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Time Exceeded (Type 11)</div><div class="key-point-text">Sent when a packet\'s TTL reaches zero (Code 0) or when fragment reassembly times out (Code 1). This is the basis of the traceroute utility.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Redirect (Type 5)</div><div class="key-point-text">Sent by a router to inform a host that a better next-hop router exists for a particular destination.</div></div></div>' +
        '<div class="callout callout-warning"><p>ICMP error messages must never be generated in response to other ICMP error messages, to prevent infinite loops. They also must not be sent for broadcast/multicast packets.</p></div>'
    },
    {
      id: 'usage',
      number: '5',
      title: 'Usage',
      content: '<p>ICMP is essential to several widely-used network diagnostic tools:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Tool</div><div class="comparison-col">ICMP Types Used</div><div class="comparison-col">Purpose</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">ping</div><div class="comparison-col">Type 8 / Type 0</div><div class="comparison-col">Test reachability and measure RTT</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">traceroute</div><div class="comparison-col">Type 11 / Type 3</div><div class="comparison-col">Map the path packets take</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Path MTU Discovery</div><div class="comparison-col">Type 3, Code 4</div><div class="comparison-col">Find largest packet size for a path</div></div></div>' +
        '<div class="callout callout-note"><p>Many firewalls filter ICMP traffic for security reasons. While blocking unnecessary types is reasonable, blocking all ICMP can break Path MTU Discovery and make debugging difficult.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Postel, J., "Internet Protocol", RFC 791, September 1981.' },
    { number: '[2]', text: 'Braden, R., "Requirements for Internet Hosts -- Communication Layers", RFC 1122, October 1989.' }
  ]
},
{
  number: 793,
  title: 'Transmission Control Protocol',
  shortTitle: 'TCP',
  authors: ['J. Postel'],
  organization: 'ISI',
  date: 'September 1981',
  status: 'Internet Standard',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Reliable, ordered, and connection-oriented byte stream delivery over IP',
    color: 'purple',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client',
      rightLabel: 'Server',
      steps: [
        { label: 'SYN seq=x', from: 'left', description: 'Client initiates connection' },
        { label: 'SYN-ACK seq=y ack=x+1', from: 'right', description: 'Server acknowledges and synchronizes' },
        { label: 'ACK ack=y+1', from: 'left', description: 'Client confirms connection established' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The Transmission Control Protocol (TCP) is a connection-oriented, reliable transport protocol that provides a full-duplex byte stream service between applications. It is the workhorse of the Internet, carrying the vast majority of all Internet traffic.</p>' +
        '<div class="callout callout-info"><p>TCP guarantees that data arrives complete, in order, and without corruption. If packets are lost, TCP automatically retransmits them. If they arrive out of order, TCP resequences them.</p></div>'
    },
    {
      id: 'philosophy',
      number: '2',
      title: 'Philosophy',
      content: '<p>TCP implements the <strong>end-to-end principle</strong>: reliability is provided at the endpoints, not in the network itself. The network (IP) provides best-effort delivery, and TCP adds reliability on top.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Reliable Delivery</div><div class="key-point-text">Every byte sent is acknowledged. Lost data is retransmitted. Duplicate data is discarded. Applications see a clean, reliable byte stream.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Flow Control</div><div class="key-point-text">The receiver advertises a window size indicating how much data it can buffer. The sender never overwhelms the receiver.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Congestion Control</div><div class="key-point-text">TCP adapts its sending rate to avoid overwhelming the network. Algorithms like slow start and congestion avoidance dynamically adjust throughput.</div></div></div>'
    },
    {
      id: 'concepts',
      number: '3',
      title: 'Concepts',
      content: '<p>TCP introduces several fundamental concepts:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">Connection</span><span class="field-table-val">A pair of endpoints (IP:port) forming a reliable communication channel</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Segment</span><span class="field-table-val">A unit of data sent by TCP, containing a header and optional payload</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Sequence Number</span><span class="field-table-val">Identifies each byte in the stream; used for ordering and duplicate detection</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Acknowledgment</span><span class="field-table-val">Confirms receipt of data up to a given sequence number</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Window</span><span class="field-table-val">The amount of data the receiver is willing to accept</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Socket</span><span class="field-table-val">An IP address + port number pair identifying one end of a connection</span></div></div>'
    },
    {
      id: 'header-format',
      number: '4',
      title: 'Header Format',
      content: '<div class="packet-diagram"><div class="packet-diagram-title">TCP Header Format (20-60 bytes)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|          Source Port          |       Destination Port        |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                        Sequence Number                        |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                    Acknowledgment Number                      |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n| Offset|  Res  |C|E|U|A|P|R|S|F|            Window             |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|           Checksum            |         Urgent Pointer        |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                    Options (variable, optional)                |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Source / Dest Port</span><span class="field-detail">Identify the sending and receiving applications</span><span class="field-size">16 bits each</span></div>' +
        '<div class="field-item"><span class="field-name">Sequence Number</span><span class="field-detail">Position of the first data byte in this segment</span><span class="field-size">32 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Acknowledgment Number</span><span class="field-detail">Next sequence number the sender expects to receive</span><span class="field-size">32 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Flags</span><span class="field-detail">SYN, ACK, FIN, RST, PSH, URG, ECE, CWR</span><span class="field-size">8 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Window</span><span class="field-detail">Receiver\'s available buffer space in bytes</span><span class="field-size">16 bits</span></div></div>'
    },
    {
      id: 'connection-management',
      number: '5',
      title: 'Connection Management',
      content: '<p>TCP uses a <strong>three-way handshake</strong> to establish connections and a <strong>four-way handshake</strong> to close them:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Opening: Three-Way Handshake</div><div class="key-point-text">1. Client sends SYN with initial sequence number x. 2. Server responds with SYN-ACK, its own sequence number y, and acknowledgment x+1. 3. Client sends ACK with acknowledgment y+1. Connection is now established.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Closing: Four-Way Handshake</div><div class="key-point-text">1. Initiator sends FIN. 2. Receiver acknowledges with ACK. 3. Receiver sends its own FIN. 4. Initiator acknowledges with ACK. Both directions are now closed.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Reset</div><div class="key-point-text">The RST flag immediately aborts a connection without the graceful close procedure. Used when an error condition is detected or a connection is refused.</div></div></div>' +
        '<div class="callout callout-note"><p>The SYN and FIN flags each consume one sequence number, even though they carry no data. This ensures they are reliably delivered through the same acknowledgment mechanism as data.</p></div>'
    },
    {
      id: 'data-transfer',
      number: '6',
      title: 'Data Transfer',
      content: '<p>Once a connection is established, TCP provides reliable bidirectional data transfer using sequence numbers and acknowledgments.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Sliding Window</div><div class="key-point-text">TCP uses a sliding window mechanism for flow control. The sender can transmit up to the window size without waiting for acknowledgments, enabling efficient use of the network.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Retransmission</div><div class="key-point-text">If an acknowledgment is not received within a timeout period (RTO), TCP retransmits the unacknowledged data. The RTO is dynamically computed based on measured round-trip times.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Cumulative ACKs</div><div class="key-point-text">Each ACK confirms receipt of all bytes up to the acknowledgment number. This allows a single ACK to cover multiple segments received.</div></div></div>'
    },
    {
      id: 'reliability',
      number: '7',
      title: 'Reliability',
      content: '<p>TCP achieves reliable delivery through several cooperating mechanisms:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Mechanism</div><div class="comparison-col">Purpose</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Checksums</div><div class="comparison-col">Detect corrupted segments</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Sequence Numbers</div><div class="comparison-col">Order segments and detect duplicates</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Acknowledgments</div><div class="comparison-col">Confirm data receipt</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Retransmission Timer</div><div class="comparison-col">Detect and recover from loss</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Flow Control (Window)</div><div class="comparison-col">Prevent receiver buffer overflow</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Congestion Control</div><div class="comparison-col">Prevent network overload</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Postel, J., "Internet Protocol", RFC 791, September 1981.' },
    { number: '[2]', text: 'Postel, J., "User Datagram Protocol", RFC 768, August 1980.' },
    { number: '[3]', text: 'Allman, M., Paxson, V., and E. Blanton, "TCP Congestion Control", RFC 5681, September 2009.' }
  ]
},
{
  number: 826,
  title: 'An Ethernet Address Resolution Protocol',
  shortTitle: 'ARP',
  authors: ['David C. Plummer'],
  organization: 'MIT',
  date: 'November 1982',
  status: 'Internet Standard',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Mapping IP addresses to hardware MAC addresses on local area networks',
    color: 'yellow',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\u{1F4BB}', label: 'Host A', detail: 'IP: 192.0.2.1 \u2192 MAC: ?' },
      bottomNode: { icon: '\u{1F5A5}', label: 'Host B', detail: 'IP: 192.0.2.2, MAC: 08:00:20:xx' },
      reqLabel: 'ARP Request (broadcast)',
      repLabel: 'ARP Reply (unicast)'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The Address Resolution Protocol (ARP) is used to discover the link-layer (MAC) address associated with a given network-layer (IP) address on a local area network. ARP is essential for IP communication on Ethernet networks.</p>' +
        '<div class="callout callout-info"><p>When a host wants to send an IP packet to another host on the same LAN, it needs the destination\'s MAC address to frame the Ethernet packet. ARP provides the mechanism to learn this mapping dynamically.</p></div>'
    },
    {
      id: 'problem-statement',
      number: '2',
      title: 'Problem Statement',
      content: '<p>Ethernet frames require a 48-bit destination MAC address, but higher-layer protocols like IP use 32-bit logical addresses. There is no algorithmic way to derive one from the other.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">The Gap</div><div class="key-point-text">IP addresses are assigned by administrators and have no relationship to the hardware. A host knowing only the destination IP address cannot construct an Ethernet frame without first learning the destination MAC address.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Dynamic Resolution</div><div class="key-point-text">ARP allows hosts to dynamically discover MAC addresses at runtime, rather than requiring static tables that would be impossible to maintain on large networks.</div></div></div>'
    },
    {
      id: 'protocol-design',
      number: '3',
      title: 'Protocol Design',
      content: '<p>ARP uses a simple request/reply mechanism:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Broadcast Request</div><div class="key-point-text">When a host needs a MAC address, it broadcasts an ARP request to all stations on the LAN: "Who has IP address X? Tell me your MAC address."</div></div>' +
        '<div class="key-point"><div class="key-point-title">Unicast Reply</div><div class="key-point-text">The host with the requested IP address responds with a unicast ARP reply directly to the requester: "IP X is at MAC address YY:YY:YY:YY:YY:YY."</div></div>' +
        '<div class="key-point"><div class="key-point-title">ARP Cache</div><div class="key-point-text">Hosts maintain an ARP cache to store recently resolved mappings. This avoids broadcasting for every packet. Cache entries typically expire after a timeout (often 20 minutes).</div></div>' +
        '<div class="key-point"><div class="key-point-title">Gratuitous ARP</div><div class="key-point-text">A host may broadcast an ARP request for its own IP address. This updates other hosts\' caches and detects IP address conflicts on the network.</div></div></div>'
    },
    {
      id: 'packet-format',
      number: '4',
      title: 'Packet Format',
      content: '<div class="packet-diagram"><div class="packet-diagram-title">ARP Packet Format (28 bytes for IPv4/Ethernet)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|         Hardware Type         |         Protocol Type         |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|  HW Addr Len  | Proto Addr Len|           Operation           |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                Sender Hardware Address (bytes 0-3)            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n| Sender HW Addr (bytes 4-5)    |  Sender Protocol Addr (0-1)  |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n| Sender Proto Addr (bytes 2-3) | Target HW Addr (bytes 0-1)   |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                Target Hardware Address (bytes 2-5)            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                Target Protocol Address (bytes 0-3)            |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Hardware Type</span><span class="field-detail">Link-layer protocol (1 = Ethernet)</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Protocol Type</span><span class="field-detail">Network-layer protocol (0x0800 = IPv4)</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Operation</span><span class="field-detail">1 = ARP Request, 2 = ARP Reply</span><span class="field-size">2 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Sender HW Addr</span><span class="field-detail">MAC address of the sender</span><span class="field-size">6 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Sender Proto Addr</span><span class="field-detail">IP address of the sender</span><span class="field-size">4 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Target HW Addr</span><span class="field-detail">MAC address of the target (zero in requests)</span><span class="field-size">6 bytes</span></div>' +
        '<div class="field-item"><span class="field-name">Target Proto Addr</span><span class="field-detail">IP address being resolved</span><span class="field-size">4 bytes</span></div></div>'
    },
    {
      id: 'implementation',
      number: '5',
      title: 'Implementation',
      content: '<p>ARP implementation involves cache management and careful handling of edge cases:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">EtherType</span><span class="field-table-val">0x0806 (ARP)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Cache Timeout</span><span class="field-table-val">Typically 20 minutes</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Retry Interval</span><span class="field-table-val">1 second between retransmissions</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Max Retries</span><span class="field-table-val">Typically 3-5 attempts</span></div></div>' +
        '<div class="callout callout-warning"><p><strong>ARP Spoofing</strong> is a well-known attack where a malicious host sends forged ARP replies to associate its MAC address with another host\'s IP address. This enables man-in-the-middle attacks. Defenses include static ARP entries, Dynamic ARP Inspection (DAI), and 802.1X authentication.</p></div>' +
        '<div class="code-block"><div class="code-block-title">Viewing the ARP Cache</div><pre>$ arp -a\ngateway (192.0.2.1) at 00:11:22:33:44:55 [ether] on eth0\nserver  (192.0.2.2) at 08:00:20:01:AB:C2 [ether] on eth0</pre></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Finlayson, R., Mann, T., Mogul, J., and M. Theimer, "A Reverse Address Resolution Protocol", RFC 903, June 1984.' },
    { number: '[2]', text: 'Postel, J., "Internet Protocol", RFC 791, September 1981.' }
  ]
},
{
  number: 1034,
  title: 'Domain Names - Concepts and Facilities',
  shortTitle: 'DNS Concepts',
  authors: ['P. Mockapetris'],
  organization: 'ISI',
  date: 'November 1987',
  status: 'Internet Standard',
  category: 'dns',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The hierarchical naming system that maps human-readable names to IP addresses',
    color: 'green',
    animation: 'tree',
    animationData: {
      root: {
        label: '.',
        children: [
          { label: 'com', children: [{ label: 'example', children: [{ label: 'www' }, { label: 'mail' }] }] },
          { label: 'org', children: [{ label: 'ietf', children: [{ label: 'tools' }] }] },
          { label: 'net', children: [{ label: 'cdn', children: [{ label: 'edge' }] }] }
        ]
      }
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The Domain Name System (DNS) is a distributed, hierarchical naming system that translates human-readable domain names (like <code>www.example.com</code>) into IP addresses (like <code>93.184.216.34</code>) and other resource records.</p>' +
        '<div class="callout callout-info"><p>RFC 1034 defines the concepts behind DNS, while its companion RFC 1035 details the implementation. Together, they form the foundation of the Internet\'s naming infrastructure.</p></div>' +
        '<p>Before DNS, host name-to-address mappings were maintained in a single <code>HOSTS.TXT</code> file distributed to every machine. As the Internet grew, this approach became completely unmanageable.</p>'
    },
    {
      id: 'domain-name-space',
      number: '2',
      title: 'Domain Name Space',
      content: '<p>The domain name space is a tree structure where each node has a label up to 63 characters long. A domain name is the sequence of labels from a node to the root, separated by dots.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Root Domain</div><div class="key-point-text">The root of the tree is represented by an empty label (or a trailing dot). The root zone is managed by IANA and served by 13 root server clusters (a.root-servers.net through m.root-servers.net).</div></div>' +
        '<div class="key-point"><div class="key-point-title">Top-Level Domains (TLDs)</div><div class="key-point-text">Direct children of the root include generic TLDs (.com, .org, .net) and country-code TLDs (.uk, .de, .jp). Each TLD is managed by a designated registry.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Zones and Delegation</div><div class="key-point-text">The name space is divided into zones, each managed by a particular authority. A zone can delegate subdomains to other name servers, creating a distributed administration model.</div></div></div>' +
        '<div class="callout callout-note"><p>A fully-qualified domain name (FQDN) includes the trailing dot representing the root: <code>www.example.com.</code> \u2014 though the trailing dot is usually omitted in everyday use.</p></div>'
    },
    {
      id: 'name-servers',
      number: '3',
      title: 'Name Servers',
      content: '<p>Name servers store DNS data and respond to queries. They are organized hierarchically, matching the structure of the domain name space.</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Server Type</div><div class="comparison-col">Role</div><div class="comparison-col">Example</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Root Server</div><div class="comparison-col">Knows TLD authoritative servers</div><div class="comparison-col">a.root-servers.net</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">TLD Server</div><div class="comparison-col">Knows domain authoritative servers</div><div class="comparison-col">a.gtld-servers.net</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Authoritative</div><div class="comparison-col">Holds actual DNS records for a zone</div><div class="comparison-col">ns1.example.com</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Recursive Resolver</div><div class="comparison-col">Resolves queries on behalf of clients</div><div class="comparison-col">8.8.8.8 (Google)</div></div></div>' +
        '<div class="callout callout-info"><p>Each zone must have at least two authoritative name servers for redundancy. The primary server holds the master copy of zone data; secondary servers receive copies via zone transfers.</p></div>'
    },
    {
      id: 'resolvers',
      number: '4',
      title: 'Resolvers',
      content: '<p>Resolvers are the client side of DNS, responsible for translating application queries into the protocol messages needed to find answers.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Stub Resolver</div><div class="key-point-text">A minimal resolver built into the operating system. It sends recursive queries to a configured DNS server and relies on that server to do the full resolution.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Recursive Resolver</div><div class="key-point-text">A full-service resolver that follows the chain of delegations from root to authoritative server. It caches results to speed up future queries.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Iterative vs. Recursive</div><div class="key-point-text">In iterative resolution, a server returns a referral to the next server to ask. In recursive resolution, the server takes full responsibility for finding the answer on behalf of the client.</div></div></div>'
    },
    {
      id: 'caching',
      number: '5',
      title: 'Caching',
      content: '<p>Caching is fundamental to DNS performance. Without caching, every DNS lookup would require traversing the hierarchy from root servers.</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">TTL (Time to Live)</span><span class="field-table-val">Each record has a TTL specifying how long it may be cached (in seconds)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Positive Caching</span><span class="field-table-val">Successful lookups are cached for the duration of the TTL</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Negative Caching</span><span class="field-table-val">NXDOMAIN (name not found) results are also cached (RFC 2308)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Cache Poisoning</span><span class="field-table-val">An attack where forged responses inject false entries into the cache</span></div></div>' +
        '<div class="callout callout-warning"><p>Setting TTL values involves a trade-off: low TTLs allow faster propagation of changes but increase query load on authoritative servers. High TTLs reduce load but make changes slow to propagate.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Mockapetris, P., "Domain Names - Implementation and Specification", RFC 1035, November 1987.' },
    { number: '[2]', text: 'Elz, R. and R. Bush, "Clarifications to the DNS Specification", RFC 2181, July 1997.' }
  ]
},
{
  number: 1035,
  title: 'Domain Names - Implementation and Specification',
  shortTitle: 'DNS Implementation',
  authors: ['P. Mockapetris'],
  organization: 'ISI',
  date: 'November 1987',
  status: 'Internet Standard',
  category: 'dns',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The wire format, resource records, and transport details that make DNS work',
    color: 'green',
    animation: 'data-format',
    animationData: {
      lines: [
        '+--+--+--+--+--+--+--+--+--+--+--+',
        '|         Header (12 bytes)        |',
        '+--+--+--+--+--+--+--+--+--+--+--+',
        '|         Question Section         |',
        '+--+--+--+--+--+--+--+--+--+--+--+',
        '|         Answer Section           |',
        '+--+--+--+--+--+--+--+--+--+--+--+',
        '|       Authority Section          |',
        '+--+--+--+--+--+--+--+--+--+--+--+',
        '|       Additional Section         |',
        '+--+--+--+--+--+--+--+--+--+--+--+'
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>RFC 1035 specifies the implementation details of the Domain Name System, including the wire format of DNS messages, resource record types, name compression, and transport protocols.</p>' +
        '<div class="callout callout-info"><p>This RFC is the companion to RFC 1034, which describes DNS concepts. RFC 1035 provides the bits-on-the-wire specification that every DNS implementation must follow.</p></div>'
    },
    {
      id: 'message-format',
      number: '2',
      title: 'Message Format',
      content: '<p>All DNS communications use a single message format for both queries and responses:</p>' +
        '<div class="packet-diagram"><div class="packet-diagram-title">DNS Message Header (12 bytes)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|              ID               |QR| Opcode|AA|TC|RD|RA| Z|RCODE|\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|           QDCOUNT             |           ANCOUNT             |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|           NSCOUNT             |           ARCOUNT             |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">ID</span><span class="field-detail">16-bit identifier to match queries and responses</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">QR</span><span class="field-detail">0 = Query, 1 = Response</span><span class="field-size">1 bit</span></div>' +
        '<div class="field-item"><span class="field-name">AA</span><span class="field-detail">Authoritative Answer flag</span><span class="field-size">1 bit</span></div>' +
        '<div class="field-item"><span class="field-name">TC</span><span class="field-detail">Truncation flag (message was truncated)</span><span class="field-size">1 bit</span></div>' +
        '<div class="field-item"><span class="field-name">RD</span><span class="field-detail">Recursion Desired</span><span class="field-size">1 bit</span></div>' +
        '<div class="field-item"><span class="field-name">RCODE</span><span class="field-detail">Response code (0=OK, 3=NXDOMAIN)</span><span class="field-size">4 bits</span></div></div>'
    },
    {
      id: 'resource-records',
      number: '3',
      title: 'Resource Records',
      content: '<p>Resource records (RRs) are the fundamental data elements of DNS. Each RR has a standard format:</p>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">NAME</span><span class="field-detail">Domain name this record belongs to</span><span class="field-size">Variable</span></div>' +
        '<div class="field-item"><span class="field-name">TYPE</span><span class="field-detail">Record type (A, NS, CNAME, MX, etc.)</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">CLASS</span><span class="field-detail">Protocol class (IN = Internet)</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">TTL</span><span class="field-detail">Time to live in seconds</span><span class="field-size">32 bits</span></div>' +
        '<div class="field-item"><span class="field-name">RDLENGTH</span><span class="field-detail">Length of the RDATA field</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">RDATA</span><span class="field-detail">Record-type-specific data</span><span class="field-size">Variable</span></div></div>' +
        '<p>The most important record types defined in this RFC:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">A</span><span>Address record \u2014 maps a name to an IPv4 address</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">NS</span><span>Name Server \u2014 delegates a zone to an authoritative server</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">CNAME</span><span>Canonical Name \u2014 an alias that points to another name</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">SOA</span><span>Start of Authority \u2014 zone metadata (serial, refresh, retry)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">MX</span><span>Mail Exchange \u2014 specifies mail servers for a domain</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">PTR</span><span>Pointer \u2014 reverse DNS lookup (IP to name)</span></div></div>'
    },
    {
      id: 'name-compression',
      number: '4',
      title: 'Name Compression',
      content: '<p>DNS messages use a compression scheme to reduce the size of domain names. Since many names in a message share common suffixes (e.g., <code>.example.com</code>), compression avoids repeating them.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Pointer Mechanism</div><div class="key-point-text">Instead of repeating a name suffix, a 2-byte pointer indicates an offset within the message where the suffix was previously encoded. The high two bits of the pointer are set to 11, distinguishing it from a label length byte.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Savings</div><div class="key-point-text">Compression is especially effective in responses with multiple records for the same domain. A typical DNS response may be 30-50% smaller with compression enabled.</div></div></div>' +
        '<div class="code-block"><div class="code-block-title">Compression Example</div><pre>Offset 0x0C: 07 example 03 com 00     (full name)\nOffset 0x20: 03 www C0 0C              (www + pointer to offset 0x0C)\nOffset 0x28: 04 mail C0 0C             (mail + pointer to offset 0x0C)</pre></div>'
    },
    {
      id: 'transport',
      number: '5',
      title: 'Transport',
      content: '<p>DNS uses both UDP and TCP for transport, each serving different purposes:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Transport</div><div class="comparison-col">Port</div><div class="comparison-col">Usage</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">UDP</div><div class="comparison-col">53</div><div class="comparison-col">Standard queries (messages up to 512 bytes, or larger with EDNS0)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">TCP</div><div class="comparison-col">53</div><div class="comparison-col">Zone transfers (AXFR/IXFR) and responses that exceed UDP size limits</div></div></div>' +
        '<div class="callout callout-note"><p>The original 512-byte UDP limit was lifted by EDNS0 (RFC 6891), which allows larger UDP messages (typically up to 4096 bytes). Modern DNS also supports DNS over HTTPS (DoH, RFC 8484) and DNS over TLS (DoT, RFC 7858) for privacy.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Mockapetris, P., "Domain Names - Concepts and Facilities", RFC 1034, November 1987.' },
    { number: '[2]', text: 'Damas, J., Graff, M., and P. Vixie, "Extension Mechanisms for DNS (EDNS(0))", RFC 6891, April 2013.' }
  ]
},
{
  number: 2782,
  title: 'A DNS RR for specifying the location of services (DNS SRV)',
  shortTitle: 'DNS SRV',
  authors: ['A. Gulbrandsen', 'P. Vixie', 'L. Esibov'],
  organization: null,
  date: 'February 2000',
  status: 'Proposed Standard',
  category: 'dns',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Locating network services by name, protocol, and domain using DNS',
    color: 'blue',
    animation: 'data-format',
    animationData: {
      lines: [
        '_sip._tcp.example.com. 86400 IN SRV 10 60 5060 sip1.example.com.',
        '_sip._tcp.example.com. 86400 IN SRV 10 20 5060 sip2.example.com.',
        '_sip._tcp.example.com. 86400 IN SRV 20  0 5060 backup.example.com.',
        '',
        'Priority 10: sip1 (weight 60), sip2 (weight 20)',
        'Priority 20: backup (fallback)'
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The SRV resource record allows administrators to specify the location of servers for a particular service and protocol using DNS. Instead of hard-coding server hostnames, clients can look up SRV records to discover which servers provide a service.</p>' +
        '<div class="callout callout-info"><p>SRV records add load balancing and failover capabilities to DNS. By specifying priority and weight values, administrators can control how clients select among multiple servers.</p></div>'
    },
    {
      id: 'format',
      number: '2',
      title: 'Format',
      content: '<p>An SRV record has the following name format and data fields:</p>' +
        '<div class="code-block"><div class="code-block-title">SRV Record Name Format</div><pre>_service._proto.name.  TTL  class  SRV  priority  weight  port  target\n\nExample:\n_http._tcp.example.com. 3600 IN SRV 10 60 80 www1.example.com.\n_http._tcp.example.com. 3600 IN SRV 10 40 80 www2.example.com.\n_http._tcp.example.com. 3600 IN SRV 20  0 80 backup.example.com.</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">_service</span><span class="field-detail">Symbolic name of the service (e.g., _http, _sip, _ldap)</span><span class="field-size">Label</span></div>' +
        '<div class="field-item"><span class="field-name">_proto</span><span class="field-detail">Transport protocol: _tcp or _udp</span><span class="field-size">Label</span></div>' +
        '<div class="field-item"><span class="field-name">Priority</span><span class="field-detail">Lower values are preferred; clients try lower priority first</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Weight</span><span class="field-detail">Relative weight for load balancing among same-priority servers</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Port</span><span class="field-detail">TCP or UDP port number for the service</span><span class="field-size">16 bits</span></div>' +
        '<div class="field-item"><span class="field-name">Target</span><span class="field-detail">Hostname of the server providing the service</span><span class="field-size">Domain name</span></div></div>'
    },
    {
      id: 'usage',
      number: '3',
      title: 'Usage',
      content: '<p>SRV records are widely used by modern protocols for service discovery:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">_sip._tcp</span><span>SIP \u2014 Voice over IP signaling</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">_xmpp._tcp</span><span>XMPP \u2014 Jabber instant messaging</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">_ldap._tcp</span><span>LDAP \u2014 Directory services</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">_kerberos._tcp</span><span>Kerberos \u2014 Authentication services</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">_minecraft._tcp</span><span>Minecraft \u2014 Game server discovery</span></div></div>' +
        '<div class="callout callout-note"><p>A target of "." (the root domain) means the service is explicitly not available at this domain. This is useful for declaring that a specific service is not offered.</p></div>'
    },
    {
      id: 'selection-algorithm',
      number: '4',
      title: 'Selection Algorithm',
      content: '<p>Clients use a two-level selection process to choose a server from SRV records:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Step 1: Sort by Priority</div><div class="key-point-text">Group records by priority value. Always try the lowest-priority group first. Only move to the next priority group if all servers in the current group are unreachable.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Step 2: Weighted Selection</div><div class="key-point-text">Within each priority group, select servers based on their weight. A server with weight 60 should receive roughly three times as many connections as a server with weight 20.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Weight Zero</div><div class="key-point-text">A weight of 0 indicates a server should be used only when no other servers in its priority group are available. Useful for last-resort backup servers.</div></div></div>' +
        '<div class="callout callout-info"><p>The weighted random selection algorithm ensures proportional distribution: compute the running sum of weights, pick a random number in [0, total), and select the server whose running sum first exceeds the random number.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Mockapetris, P., "Domain Names - Concepts and Facilities", RFC 1034, November 1987.' },
    { number: '[2]', text: 'Mockapetris, P., "Domain Names - Implementation and Specification", RFC 1035, November 1987.' }
  ]
},
{
  number: 6762,
  title: 'Multicast DNS',
  shortTitle: 'mDNS',
  authors: ['S. Cheshire', 'M. Krochmal'],
  organization: 'Apple Inc.',
  date: 'February 2013',
  status: 'Proposed Standard',
  category: 'dns',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Zero-configuration DNS resolution on local networks using multicast',
    color: 'purple',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\u{1F4BB}', label: 'Client', detail: 'Looking for printer.local' },
      bottomNode: { icon: '\u{1F5A8}', label: 'Printer', detail: 'myprinter.local \u2192 192.168.1.50' },
      reqLabel: 'mDNS Query (multicast)',
      repLabel: 'mDNS Response (multicast)'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>Multicast DNS (mDNS) enables DNS-like name resolution on local networks without a dedicated DNS server. Devices query and respond using IP multicast, making it possible to discover services and resolve names in a zero-configuration environment.</p>' +
        '<div class="callout callout-info"><p>mDNS is the technology behind Apple\'s Bonjour, Linux\'s Avahi, and similar zero-config networking implementations. It enables devices to automatically discover printers, file shares, and other services on the local network.</p></div>'
    },
    {
      id: 'overview',
      number: '2',
      title: 'Overview',
      content: '<p>mDNS uses the same DNS message format (RFC 1035) but sends queries and responses to a well-known multicast address instead of a unicast DNS server:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">IPv4 Multicast Address</span><span class="field-table-val">224.0.0.251</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">IPv6 Multicast Address</span><span class="field-table-val">ff02::fb</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">UDP Port</span><span class="field-table-val">5353</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Domain</span><span class="field-table-val">.local</span></div></div>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">No Server Required</div><div class="key-point-text">Every device on the network acts as both client and server. Any device can claim a name and respond to queries for that name.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Link-Local Scope</div><div class="key-point-text">mDNS queries use a TTL of 255, which means they do not leave the local network segment. This is by design \u2014 mDNS is intended for local service discovery.</div></div></div>'
    },
    {
      id: 'local-domain',
      number: '3',
      title: '.local Domain',
      content: '<p>mDNS uses the <code>.local</code> pseudo-top-level domain. Any DNS query for a name ending in <code>.local</code> is resolved via multicast rather than conventional unicast DNS.</p>' +
        '<div class="code-block"><div class="code-block-title">mDNS Name Examples</div><pre>mycomputer.local.        A      192.168.1.100\nmyprinter.local.         A      192.168.1.50\nnas-backup.local.        A      192.168.1.200\n_http._tcp.local.        PTR    My Web Server._http._tcp.local.\n_printer._tcp.local.     PTR    Office Printer._printer._tcp.local.</pre></div>' +
        '<div class="callout callout-warning"><p>The .local domain should not be used in unicast DNS. Conflicts between mDNS and unicast DNS for .local names can cause resolution failures, particularly in enterprise environments using .local for Active Directory domains.</p></div>'
    },
    {
      id: 'record-types',
      number: '4',
      title: 'Record Types',
      content: '<p>mDNS supports all standard DNS record types. The most commonly used types in mDNS are:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">A</span><span>IPv4 address for a .local hostname</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">AAAA</span><span>IPv6 address for a .local hostname</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">PTR</span><span>Service instance enumeration (browsing)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">SRV</span><span>Service instance location (host and port)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">TXT</span><span>Service metadata (key-value pairs)</span></div></div>'
    },
    {
      id: 'conflict-resolution',
      number: '5',
      title: 'Conflict Resolution',
      content: '<p>When a device joins the network or claims a new name, it must verify that the name is not already in use:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Probing</div><div class="key-point-text">Before claiming a name, the device sends three probe queries at 250ms intervals, asking if anyone else owns that name. If no conflict is detected, the name is claimed.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Announcing</div><div class="key-point-text">After successfully probing, the device announces its records by multicasting them to all peers. This populates other devices\' caches.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Conflict Handling</div><div class="key-point-text">If a conflict is detected (two devices claiming the same name), the device appends a number and tries again: mycomputer.local becomes mycomputer-2.local.</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Cheshire, S. and M. Krochmal, "DNS-Based Service Discovery", RFC 6763, February 2013.' },
    { number: '[2]', text: 'Mockapetris, P., "Domain Names - Implementation and Specification", RFC 1035, November 1987.' }
  ]
},
{
  number: 1945,
  title: 'Hypertext Transfer Protocol -- HTTP/1.0',
  shortTitle: 'HTTP/1.0',
  authors: ['T. Berners-Lee', 'R. Fielding', 'H. Frystyk'],
  organization: null,
  date: 'May 1996',
  status: 'Informational',
  category: 'http',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The original request/response protocol that launched the World Wide Web',
    color: 'orange',
    animation: 'request-response',
    animationData: {
      request: { method: 'GET', path: '/index.html', headers: ['Host: www.example.com', 'User-Agent: CERN-LineMode/2.15'] },
      response: { status: '200 OK', headers: ['Content-Type: text/html', 'Content-Length: 1234'], body: '<html>Hello World</html>' }
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>HTTP/1.0 is the first widely-deployed version of the Hypertext Transfer Protocol. It defines the basic request/response model that underlies all communication on the World Wide Web.</p>' +
        '<div class="callout callout-info"><p>HTTP was invented by Tim Berners-Lee at CERN in 1989 as part of his proposal for a distributed hypertext system. HTTP/1.0 was the first version to be formally documented, codifying practices already in widespread use.</p></div>'
    },
    {
      id: 'overview',
      number: '2',
      title: 'Overview',
      content: '<p>HTTP is a stateless, request/response protocol. A client sends a request message to a server, and the server returns a response message.</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Stateless</div><div class="key-point-text">Each request is independent. The server retains no memory of previous requests from the same client. State management (sessions, cookies) must be built on top.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Text-Based</div><div class="key-point-text">HTTP/1.0 messages are human-readable text. Request and response headers are ASCII text lines terminated by CRLF.</div></div>' +
        '<div class="key-point"><div class="key-point-title">One Request Per Connection</div><div class="key-point-text">In HTTP/1.0, each request opens a new TCP connection, sends the request, receives the response, and closes the connection. This is simple but inefficient.</div></div></div>'
    },
    {
      id: 'request',
      number: '3',
      title: 'Request',
      content: '<p>An HTTP request consists of a request line, headers, and an optional body:</p>' +
        '<div class="code-block"><div class="code-block-title">HTTP/1.0 Request Format</div><pre>GET /index.html HTTP/1.0\r\nHost: www.example.com\r\nUser-Agent: Mozilla/4.0\r\nAccept: text/html\r\n\r\n</pre></div>' +
        '<div class="field-list"><div class="field-item"><span class="field-name">Method</span><span class="field-detail">The action to perform (GET, POST, HEAD)</span><span class="field-size">Token</span></div>' +
        '<div class="field-item"><span class="field-name">Request-URI</span><span class="field-detail">The resource being requested</span><span class="field-size">URI</span></div>' +
        '<div class="field-item"><span class="field-name">HTTP-Version</span><span class="field-detail">Always "HTTP/1.0"</span><span class="field-size">String</span></div></div>'
    },
    {
      id: 'response',
      number: '4',
      title: 'Response',
      content: '<p>An HTTP response consists of a status line, headers, and an optional body:</p>' +
        '<div class="code-block"><div class="code-block-title">HTTP/1.0 Response Format</div><pre>HTTP/1.0 200 OK\r\nContent-Type: text/html\r\nContent-Length: 1234\r\n\r\n&lt;html&gt;...&lt;/html&gt;</pre></div>'
    },
    {
      id: 'methods',
      number: '5',
      title: 'Methods',
      content: '<p>HTTP/1.0 defines three methods:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">GET</span><span>Retrieve a resource. The most common method. Must be safe and idempotent.</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">HEAD</span><span>Same as GET but returns only headers, not the body. Used for checking if a resource exists.</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">POST</span><span>Submit data to be processed (e.g., form submission). May create or modify resources.</span></div></div>'
    },
    {
      id: 'status-codes',
      number: '6',
      title: 'Status Codes',
      content: '<p>HTTP status codes are three-digit numbers grouped by category:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">1xx</span><span>Informational \u2014 Request received, continuing process</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">2xx</span><span>Success \u2014 Request received, understood, and accepted</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">3xx</span><span>Redirection \u2014 Further action needed to complete request</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">4xx</span><span>Client Error \u2014 Request contains bad syntax or cannot be fulfilled</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">5xx</span><span>Server Error \u2014 Server failed to fulfill a valid request</span></div></div>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">200 OK</span><span class="field-table-val">The request has succeeded</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">301 Moved Permanently</span><span class="field-table-val">Resource has been permanently moved</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">304 Not Modified</span><span class="field-table-val">Resource has not changed since last request</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">400 Bad Request</span><span class="field-table-val">Server cannot process the request due to client error</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">404 Not Found</span><span class="field-table-val">The requested resource could not be found</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">500 Internal Server Error</span><span class="field-table-val">Unexpected server-side error</span></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Fielding, R., et al., "Hypertext Transfer Protocol -- HTTP/1.1", RFC 2616, June 1999.' },
    { number: '[2]', text: 'Berners-Lee, T., "Universal Resource Identifiers in WWW", RFC 1630, June 1994.' }
  ]
},
{
  number: 2616,
  title: 'Hypertext Transfer Protocol -- HTTP/1.1',
  shortTitle: 'HTTP/1.1',
  authors: ['R. Fielding', 'J. Gettys', 'J. Mogul', 'H. Frystyk', 'L. Masinter', 'P. Leach', 'T. Berners-Lee'],
  organization: null,
  date: 'June 1999',
  status: 'Internet Standard',
  category: 'http',
  featured: true,
  obsoletedBy: 'RFC 7230-7235',
  obsoletes: null,
  hero: {
    subtitle: 'The workhorse of the Web \u2014 persistent connections, chunked transfer, and content negotiation',
    color: 'orange',
    animation: 'request-response',
    animationData: {
      request: { method: 'GET', path: '/api/data', headers: ['Host: api.example.com', 'Connection: keep-alive', 'Accept-Encoding: gzip'] },
      response: { status: '200 OK', headers: ['Transfer-Encoding: chunked', 'Content-Type: application/json', 'Cache-Control: max-age=3600'], body: '{"items": [...]}' }
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>HTTP/1.1 is the most widely deployed version of HTTP and the workhorse of the modern Web. It introduces persistent connections, chunked transfer encoding, and many other improvements over HTTP/1.0.</p>' +
        '<div class="callout callout-warning"><p>RFC 2616 has been obsoleted by RFCs 7230-7235, which reorganize and clarify the specification without changing the protocol. The core protocol remains HTTP/1.1.</p></div>'
    },
    {
      id: 'connections',
      number: '2',
      title: 'Connections',
      content: '<p>The most significant improvement in HTTP/1.1 is <strong>persistent connections</strong>:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Feature</div><div class="comparison-col">HTTP/1.0</div><div class="comparison-col">HTTP/1.1</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Connection Lifetime</div><div class="comparison-col">One request per connection</div><div class="comparison-col">Multiple requests per connection</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Default Behavior</div><div class="comparison-col">Close after response</div><div class="comparison-col">Keep-alive (persistent)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Pipelining</div><div class="comparison-col">Not supported</div><div class="comparison-col">Supported (multiple requests without waiting)</div></div></div>' +
        '<div class="callout callout-note"><p>HTTP pipelining allows sending multiple requests without waiting for responses. However, it suffered from head-of-line blocking: a slow response blocks all subsequent responses. This limitation motivated HTTP/2.</p></div>'
    },
    {
      id: 'request',
      number: '3',
      title: 'Request',
      content: '<p>HTTP/1.1 requires the <code>Host</code> header in every request, enabling virtual hosting (multiple websites on a single IP address):</p>' +
        '<div class="code-block"><div class="code-block-title">HTTP/1.1 Request</div><pre>GET /index.html HTTP/1.1\r\nHost: www.example.com\r\nAccept: text/html, application/xhtml+xml\r\nAccept-Language: en-US,en;q=0.9\r\nAccept-Encoding: gzip, deflate\r\nConnection: keep-alive\r\n\r\n</pre></div>'
    },
    {
      id: 'response',
      number: '4',
      title: 'Response',
      content: '<p>Responses may use chunked transfer encoding, allowing the server to send data in pieces without knowing the total size in advance:</p>' +
        '<div class="code-block"><div class="code-block-title">Chunked Transfer Encoding</div><pre>HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nContent-Type: text/html\r\n\r\n1a\r\n&lt;html&gt;&lt;body&gt;Hello \r\n12\r\nWorld!&lt;/body&gt;&lt;/html&gt;\r\n0\r\n\r\n</pre></div>' +
        '<div class="callout callout-info"><p>Each chunk starts with its size in hexadecimal followed by CRLF, then the data, then another CRLF. A chunk of size 0 signals the end of the message body.</p></div>'
    },
    {
      id: 'methods',
      number: '5',
      title: 'Methods',
      content: '<p>HTTP/1.1 defines several additional methods beyond HTTP/1.0:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">GET</span><span>Retrieve a resource</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">HEAD</span><span>Retrieve headers only</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">POST</span><span>Submit data for processing</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">PUT</span><span>Replace the target resource entirely</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">DELETE</span><span>Remove the target resource</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">OPTIONS</span><span>Describe communication options for the target</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">TRACE</span><span>Loop-back test along the path to the target</span></div></div>'
    },
    {
      id: 'caching',
      number: '6',
      title: 'Caching',
      content: '<p>HTTP/1.1 introduces a comprehensive caching model using the <code>Cache-Control</code> header:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">no-cache</span><span class="field-table-val">Must revalidate with origin server before use</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">no-store</span><span class="field-table-val">Do not store any part of the request or response</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">max-age=N</span><span class="field-table-val">Response is fresh for N seconds</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">public</span><span class="field-table-val">Response may be cached by any cache</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">private</span><span class="field-table-val">Response is intended for a single user only</span></div></div>'
    },
    {
      id: 'content-negotiation',
      number: '7',
      title: 'Content Negotiation',
      content: '<p>HTTP/1.1 allows clients and servers to negotiate the best representation of a resource using Accept headers:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Accept</div><div class="key-point-text">Specifies preferred media types: <code>Accept: text/html, application/json;q=0.9</code></div></div>' +
        '<div class="key-point"><div class="key-point-title">Accept-Encoding</div><div class="key-point-text">Specifies preferred content encodings: <code>Accept-Encoding: gzip, deflate, br</code></div></div>' +
        '<div class="key-point"><div class="key-point-title">Accept-Language</div><div class="key-point-text">Specifies preferred languages: <code>Accept-Language: en-US, fr;q=0.5</code></div></div></div>' +
        '<div class="callout callout-note"><p>The quality factor (q) ranges from 0 to 1, with 1 being most preferred. If omitted, it defaults to 1. The server selects the best available representation based on these preferences.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Fielding, R. and J. Reschke, "Hypertext Transfer Protocol (HTTP/1.1): Message Syntax and Routing", RFC 7230, June 2014.' },
    { number: '[2]', text: 'Berners-Lee, T., Fielding, R., and H. Frystyk, "Hypertext Transfer Protocol -- HTTP/1.0", RFC 1945, May 1996.' }
  ]
},
{
  number: 7540,
  title: 'Hypertext Transfer Protocol Version 2 (HTTP/2)',
  shortTitle: 'HTTP/2',
  authors: ['M. Belshe', 'R. Peon', 'M. Thomson'],
  organization: null,
  date: 'May 2015',
  status: 'Proposed Standard',
  category: 'http',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Binary framing, multiplexing, and header compression for a faster Web',
    color: 'blue',
    animation: 'layers',
    animationData: {
      layers: [
        { name: 'HTTP Semantics', detail: 'GET, POST, headers, status codes', highlight: false },
        { name: 'Binary Framing Layer', detail: 'Frames, streams, multiplexing', highlight: true },
        { name: 'HPACK Compression', detail: 'Header table, Huffman coding', highlight: true },
        { name: 'TLS 1.2+', detail: 'Encryption (effectively required)', highlight: false },
        { name: 'TCP', detail: 'Reliable transport', highlight: false }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>HTTP/2 is a major revision of the HTTP protocol that dramatically improves performance while maintaining full backward compatibility with HTTP/1.1 semantics. The same methods, status codes, and headers are used; only the transport mechanism changes.</p>' +
        '<div class="callout callout-info"><p>HTTP/2 evolved from Google\'s experimental SPDY protocol. It addresses HTTP/1.1\'s head-of-line blocking problem by introducing binary framing and multiplexed streams.</p></div>'
    },
    {
      id: 'overview',
      number: '2',
      title: 'Overview',
      content: '<p>HTTP/2 replaces HTTP/1.1\'s text-based protocol with a binary framing layer that enables significant performance improvements:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Binary Protocol</div><div class="key-point-text">Unlike HTTP/1.1\'s text-based format, HTTP/2 uses a compact binary framing. This is more efficient to parse and less error-prone, though no longer human-readable on the wire.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Single TCP Connection</div><div class="key-point-text">HTTP/2 uses a single TCP connection per origin, eliminating the overhead of multiple connections while achieving better throughput through multiplexing.</div></div></div>'
    },
    {
      id: 'streams-multiplexing',
      number: '3',
      title: 'Streams and Multiplexing',
      content: '<p>Multiplexing is the core innovation of HTTP/2. Multiple requests and responses can be in flight simultaneously on a single connection:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Streams</div><div class="key-point-text">Each request/response pair occupies an independent stream identified by a unique integer. Streams are logically independent, so a slow response on one stream does not block others at the HTTP layer.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Frames</div><div class="key-point-text">Streams are composed of frames \u2014 the smallest unit of communication. Frame types include HEADERS, DATA, SETTINGS, PUSH_PROMISE, PING, and others.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Stream Priority</div><div class="key-point-text">Clients can assign priority to streams, indicating which resources are most important. Servers use this to allocate bandwidth between competing streams.</div></div></div>' +
        '<div class="callout callout-warning"><p>While HTTP/2 eliminates HTTP-level head-of-line blocking, TCP-level head-of-line blocking remains. A single lost TCP packet blocks all multiplexed streams. This motivated the development of HTTP/3 over QUIC.</p></div>'
    },
    {
      id: 'frame-format',
      number: '4',
      title: 'Frame Format',
      content: '<div class="packet-diagram"><div class="packet-diagram-title">HTTP/2 Frame Format (9-byte header)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                    Length (24 bits)            |  Type (8)     |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|  Flags (8)    |R|          Stream Identifier (31 bits)        |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                      Frame Payload (variable)                 |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">0x0</span><span>DATA \u2014 Carries request/response body data</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x1</span><span>HEADERS \u2014 Carries HTTP header fields</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x2</span><span>PRIORITY \u2014 Stream priority information</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x3</span><span>RST_STREAM \u2014 Terminate a single stream</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x4</span><span>SETTINGS \u2014 Connection configuration parameters</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x5</span><span>PUSH_PROMISE \u2014 Server push notification</span></div></div>'
    },
    {
      id: 'hpack',
      number: '5',
      title: 'HPACK',
      content: '<p>HPACK is the header compression algorithm used by HTTP/2, defined in RFC 7541. It dramatically reduces header overhead:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Static Table</div><div class="key-point-text">A predefined table of 61 common header field/value pairs (e.g., :method: GET, :status: 200). These can be referenced by a single index byte.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Dynamic Table</div><div class="key-point-text">A connection-specific table built up during the session. Previously sent headers are added to this table and can be referenced by index in subsequent requests.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Huffman Coding</div><div class="key-point-text">String literals can be Huffman-encoded using a static Huffman code optimized for HTTP header values, typically achieving 30% compression.</div></div></div>' +
        '<div class="callout callout-info"><p>HPACK is particularly effective for HTTP because headers are highly repetitive across requests. After the first request, subsequent requests often require only a few bytes of header data.</p></div>'
    },
    {
      id: 'server-push',
      number: '6',
      title: 'Server Push',
      content: '<p>HTTP/2 allows servers to proactively send resources to the client before they are requested:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">PUSH_PROMISE</div><div class="key-point-text">The server sends a PUSH_PROMISE frame indicating it will push a resource. The client can reject the push with RST_STREAM if it already has the resource cached.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Use Case</div><div class="key-point-text">When a client requests an HTML page, the server can proactively push the CSS and JavaScript files it knows will be needed, saving a round trip.</div></div></div>' +
        '<div class="callout callout-note"><p>Server push has seen limited adoption in practice. Many CDNs and browsers have found that other optimization techniques (preload hints, early hints) are more effective and easier to manage.</p></div>'
    },
    {
      id: 'flow-control',
      number: '7',
      title: 'Flow Control',
      content: '<p>HTTP/2 implements its own flow control mechanism at the stream and connection level, independent of TCP flow control:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">Initial Window Size</span><span class="field-table-val">65,535 bytes (can be changed via SETTINGS)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Scope</span><span class="field-table-val">Per-stream and per-connection</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">WINDOW_UPDATE</span><span class="field-table-val">Frame type used to increase the flow control window</span></div></div>' +
        '<p>Flow control ensures that a single stream cannot monopolize the connection and that receivers are not overwhelmed with data they cannot process.</p>'
    }
  ],
  references: [
    { number: '[1]', text: 'Peon, R. and H. Ruellan, "HPACK: Header Compression for HTTP/2", RFC 7541, May 2015.' },
    { number: '[2]', text: 'Fielding, R., et al., "Hypertext Transfer Protocol -- HTTP/1.1", RFC 2616, June 1999.' }
  ]
},
{
  number: 9110,
  title: 'HTTP Semantics',
  shortTitle: 'HTTP Semantics',
  authors: ['R. Fielding', 'M. Nottingham', 'J. Reschke'],
  organization: null,
  date: 'June 2022',
  status: 'Internet Standard',
  category: 'http',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The unified specification of HTTP semantics for all protocol versions',
    color: 'purple',
    animation: 'request-response',
    animationData: {
      request: { method: 'PUT', path: '/api/resource/42', headers: ['Content-Type: application/json', 'If-Match: "abc123"'] },
      response: { status: '200 OK', headers: ['ETag: "def456"', 'Content-Type: application/json'], body: '{"id": 42, "status": "updated"}' }
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>RFC 9110 defines the semantics of HTTP that are shared across all versions of the protocol (HTTP/1.1, HTTP/2, HTTP/3). It replaces the semantics portions of RFC 7230-7235, providing a single authoritative reference.</p>' +
        '<div class="callout callout-info"><p>By separating semantics from wire format, RFC 9110 makes it clear that GET, POST, 200 OK, and Content-Type mean the same thing regardless of whether the message travels over HTTP/1.1, HTTP/2, or HTTP/3.</p></div>'
    },
    {
      id: 'resources',
      number: '2',
      title: 'Resources',
      content: '<p>HTTP is a protocol for interacting with <strong>resources</strong>, which are identified by URIs:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Resource</div><div class="key-point-text">Any information that can be named by a URI. A resource may be a document, an image, a service endpoint, or any abstract concept.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Representation</div><div class="key-point-text">The current or intended state of a resource, encoded for transfer. A resource may have multiple representations (HTML, JSON, XML) selected via content negotiation.</div></div>' +
        '<div class="key-point"><div class="key-point-title">URI</div><div class="key-point-text">A Uniform Resource Identifier provides the address and name for a resource: <code>https://example.com/api/items/42</code></div></div></div>'
    },
    {
      id: 'methods',
      number: '3',
      title: 'Methods',
      content: '<p>HTTP methods indicate the desired action to be performed on a resource:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">GET</span><span>Retrieve a representation of the target resource</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">HEAD</span><span>Same as GET but without the response body</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">POST</span><span>Process the enclosed representation</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">PUT</span><span>Replace the target resource</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">DELETE</span><span>Remove the target resource</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">PATCH</span><span>Apply partial modifications</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">OPTIONS</span><span>Describe communication options</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">CONNECT</span><span>Establish a tunnel to the server</span></div></div>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Method</div><div class="comparison-col">Safe</div><div class="comparison-col">Idempotent</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">GET / HEAD</div><div class="comparison-col">Yes</div><div class="comparison-col">Yes</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">PUT / DELETE</div><div class="comparison-col">No</div><div class="comparison-col">Yes</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">POST / PATCH</div><div class="comparison-col">No</div><div class="comparison-col">No</div></div></div>'
    },
    {
      id: 'status-codes',
      number: '4',
      title: 'Status Codes',
      content: '<p>HTTP status codes communicate the result of the server\'s attempt to satisfy the request:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">200 OK</span><span class="field-table-val">The request succeeded</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">201 Created</span><span class="field-table-val">A new resource was created</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">204 No Content</span><span class="field-table-val">Successful but no body to return</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">301 Moved Permanently</span><span class="field-table-val">Resource has a new permanent URI</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">304 Not Modified</span><span class="field-table-val">Conditional request; cached version is current</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">400 Bad Request</span><span class="field-table-val">Malformed request syntax</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">401 Unauthorized</span><span class="field-table-val">Authentication required</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">403 Forbidden</span><span class="field-table-val">Server refuses to authorize the request</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">404 Not Found</span><span class="field-table-val">Resource not found</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">500 Internal Server Error</span><span class="field-table-val">Unexpected server error</span></div></div>'
    },
    {
      id: 'content',
      number: '5',
      title: 'Content',
      content: '<p>HTTP messages carry content (previously called "entity body") that represents the state of a resource:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Content-Type</div><div class="key-point-text">Indicates the media type of the content: <code>Content-Type: application/json; charset=utf-8</code></div></div>' +
        '<div class="key-point"><div class="key-point-title">Content-Length</div><div class="key-point-text">The size of the content in bytes. Required when the message body has a fixed, known length.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Content-Encoding</div><div class="key-point-text">Compression applied to the content: <code>Content-Encoding: gzip</code>. Applied before transfer encoding.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Content-Language</div><div class="key-point-text">The natural language(s) of the intended audience: <code>Content-Language: en-US</code></div></div></div>'
    },
    {
      id: 'conditional-requests',
      number: '6',
      title: 'Conditional Requests',
      content: '<p>Conditional requests allow clients to make requests that only succeed if certain conditions are met, enabling efficient caching and safe concurrent updates:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">If-Match</span><span class="field-table-val">Proceed only if the resource\'s ETag matches (for safe updates)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">If-None-Match</span><span class="field-table-val">Proceed only if the resource\'s ETag does NOT match (for caching)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">If-Modified-Since</span><span class="field-table-val">Proceed only if the resource changed after a given date</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">If-Unmodified-Since</span><span class="field-table-val">Proceed only if the resource has NOT changed since a date</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">ETag</span><span class="field-table-val">An opaque validator for a specific version of a resource</span></div></div>' +
        '<div class="callout callout-info"><p>ETags enable optimistic concurrency control: a client can PUT an update with If-Match to ensure it doesn\'t overwrite changes made by another client since the resource was last fetched.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Fielding, R., Nottingham, M., and J. Reschke, "HTTP/1.1", RFC 9112, June 2022.' },
    { number: '[2]', text: 'Thomson, M. and C. Benfield, "HTTP/2", RFC 9113, June 2022.' },
    { number: '[3]', text: 'Bishop, M., "HTTP/3", RFC 9114, June 2022.' }
  ]
},
{
  number: 9114,
  title: 'HTTP/3',
  shortTitle: 'HTTP/3',
  authors: ['M. Bishop'],
  organization: null,
  date: 'June 2022',
  status: 'Proposed Standard',
  category: 'http',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'HTTP over QUIC \u2014 eliminating head-of-line blocking with UDP-based transport',
    color: 'cyan',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client',
      rightLabel: 'Server',
      steps: [
        { label: 'QUIC Initial + TLS ClientHello', from: 'left', description: 'Combined transport and crypto handshake' },
        { label: 'QUIC Handshake + TLS ServerHello', from: 'right', description: 'Server responds with crypto material' },
        { label: 'QUIC 1-RTT Data + HTTP/3 Request', from: 'left', description: 'First HTTP request in just 1 round trip' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>HTTP/3 is the third major version of HTTP. It uses QUIC (RFC 9000) as its transport protocol instead of TCP, fundamentally changing how HTTP data moves across the network.</p>' +
        '<div class="callout callout-info"><p>HTTP/3 addresses the last major performance bottleneck of HTTP/2: TCP-level head-of-line blocking. Since QUIC provides independent streams at the transport layer, a lost packet only affects the stream it belongs to.</p></div>'
    },
    {
      id: 'quic-transport',
      number: '2',
      title: 'QUIC Transport',
      content: '<p>HTTP/3 relies entirely on QUIC for transport, which provides:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Stream Multiplexing</div><div class="key-point-text">QUIC natively supports multiplexed streams, so HTTP/3 does not need to implement its own multiplexing layer. Each HTTP request/response uses an independent QUIC stream.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Built-in Encryption</div><div class="key-point-text">QUIC integrates TLS 1.3, so every HTTP/3 connection is encrypted by default. There is no unencrypted mode.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Connection Migration</div><div class="key-point-text">QUIC connections survive IP address changes (e.g., switching from Wi-Fi to cellular), since connections are identified by connection IDs rather than IP/port tuples.</div></div></div>'
    },
    {
      id: 'connection-setup',
      number: '3',
      title: 'Connection Setup',
      content: '<p>HTTP/3 connection setup is significantly faster than HTTP/1.1 or HTTP/2 over TCP+TLS:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Protocol Stack</div><div class="comparison-col">Round Trips to First Data</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">HTTP/1.1 over TCP + TLS 1.2</div><div class="comparison-col">3 RTT (TCP + TLS + Request)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">HTTP/2 over TCP + TLS 1.3</div><div class="comparison-col">2 RTT (TCP + TLS/Request)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">HTTP/3 over QUIC</div><div class="comparison-col">1 RTT (QUIC handshake + Request)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">HTTP/3 over QUIC (0-RTT)</div><div class="comparison-col">0 RTT (resumed connection)</div></div></div>' +
        '<div class="callout callout-warning"><p>0-RTT data is vulnerable to replay attacks. Servers must ensure that 0-RTT requests are idempotent (e.g., GET requests) and implement replay protection for sensitive operations.</p></div>'
    },
    {
      id: 'http-framing',
      number: '4',
      title: 'HTTP Framing',
      content: '<p>HTTP/3 uses a simpler framing layer than HTTP/2, since QUIC handles stream management:</p>' +
        '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">0x0</span><span>DATA \u2014 Request/response body data</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x1</span><span>HEADERS \u2014 Compressed header fields (QPACK)</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x3</span><span>CANCEL_PUSH \u2014 Cancel a server push</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x4</span><span>SETTINGS \u2014 Connection configuration</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x5</span><span>PUSH_PROMISE \u2014 Server push announcement</span></div>' +
        '<div class="opcode-card"><span class="opcode-highlight">0x7</span><span>GOAWAY \u2014 Graceful connection shutdown</span></div></div>' +
        '<div class="callout callout-note"><p>HTTP/3 uses QPACK instead of HPACK for header compression. QPACK is designed for QUIC\'s out-of-order delivery model, avoiding the head-of-line blocking that HPACK would cause on QUIC streams.</p></div>'
    },
    {
      id: 'request-response',
      number: '5',
      title: 'Request/Response',
      content: '<p>HTTP/3 requests and responses use the same semantics as all other HTTP versions (RFC 9110). The differences are in how they are transported:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">One Stream Per Request</div><div class="key-point-text">Each request/response pair uses a single bidirectional QUIC stream. Streams are fully independent \u2014 there is no ordering between different requests.</div></div>' +
        '<div class="key-point"><div class="key-point-title">No Head-of-Line Blocking</div><div class="key-point-text">If a packet carrying data for Stream A is lost, only Stream A is blocked while awaiting retransmission. Streams B and C continue unimpeded.</div></div></div>'
    },
    {
      id: 'server-push',
      number: '6',
      title: 'Server Push',
      content: '<p>HTTP/3 retains server push from HTTP/2, with modifications for the QUIC transport:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Push Streams</div><div class="key-point-text">Server push responses are sent on unidirectional QUIC streams, prefixed with a push ID that correlates to a PUSH_PROMISE sent on the request stream.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Client Control</div><div class="key-point-text">Clients can set MAX_PUSH_ID to 0 to disable server push entirely, or use CANCEL_PUSH to reject individual push promises before the data is sent.</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Iyengar, J. and M. Thomson, "QUIC: A UDP-Based Multiplexed and Secure Transport", RFC 9000, May 2021.' },
    { number: '[2]', text: 'Fielding, R., Nottingham, M., and J. Reschke, "HTTP Semantics", RFC 9110, June 2022.' },
    { number: '[3]', text: 'Krasic, C., Bishop, M., and A. Frindell, "QPACK: Field Compression for HTTP/3", RFC 9204, June 2022.' }
  ]
},
{
  number: 9000,
  title: 'QUIC: A UDP-Based Multiplexed and Secure Transport',
  shortTitle: 'QUIC',
  authors: ['J. Iyengar', 'M. Thomson'],
  organization: null,
  date: 'May 2021',
  status: 'Proposed Standard',
  category: 'transport',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'A modern UDP-based transport with built-in encryption, multiplexing, and connection migration',
    color: 'cyan',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client',
      rightLabel: 'Server',
      steps: [
        { label: 'Initial: ClientHello + QUIC Transport Params', from: 'left', description: 'Combined transport and TLS 1.3 handshake' },
        { label: 'Initial: ServerHello + Handshake + 1-RTT', from: 'right', description: 'Server completes crypto handshake' },
        { label: 'Handshake Complete + Application Data', from: 'left', description: 'Connection established after 1 RTT' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>QUIC is a general-purpose transport protocol built on UDP that provides reliable, multiplexed, and encrypted communication. It was designed by Google and standardized by the IETF as a modern alternative to TCP+TLS.</p>' +
        '<div class="callout callout-info"><p>QUIC combines the roles of TCP, TLS, and parts of HTTP/2 into a single protocol. By running over UDP, it can be deployed and iterated on without waiting for changes to operating system TCP stacks.</p></div>'
    },
    {
      id: 'overview',
      number: '2',
      title: 'Overview',
      content: '<p>QUIC addresses several fundamental limitations of TCP:</p>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Challenge</div><div class="comparison-col">TCP Approach</div><div class="comparison-col">QUIC Approach</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Handshake Latency</div><div class="comparison-col">TCP (1 RTT) + TLS (1-2 RTT)</div><div class="comparison-col">Combined 1-RTT handshake (0-RTT for resumption)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Head-of-Line Blocking</div><div class="comparison-col">Lost packet blocks all data</div><div class="comparison-col">Only the affected stream is blocked</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Connection Migration</div><div class="comparison-col">Connection drops on IP change</div><div class="comparison-col">Connection IDs survive IP changes</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Encryption</div><div class="comparison-col">Optional (TLS is a separate layer)</div><div class="comparison-col">Mandatory (TLS 1.3 built-in)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Ossification</div><div class="comparison-col">Middleboxes inspect TCP headers</div><div class="comparison-col">Nearly all headers are encrypted</div></div></div>'
    },
    {
      id: 'connections',
      number: '3',
      title: 'Connections',
      content: '<p>QUIC connections are identified by Connection IDs rather than the traditional 4-tuple (src IP, src port, dst IP, dst port):</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Connection IDs</div><div class="key-point-text">Each endpoint chooses its own connection ID. Packets carry the destination\'s connection ID, allowing the receiver to identify the connection even if the sender\'s IP address changes.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Handshake</div><div class="key-point-text">QUIC combines transport and cryptographic handshakes into a single round trip. The Initial packet contains a TLS 1.3 ClientHello, and the server responds with its crypto material.</div></div>' +
        '<div class="key-point"><div class="key-point-title">0-RTT Resumption</div><div class="key-point-text">When reconnecting to a previously visited server, QUIC can send application data immediately using cached session keys, achieving zero round-trip connection establishment.</div></div></div>'
    },
    {
      id: 'streams',
      number: '4',
      title: 'Streams',
      content: '<p>QUIC streams are lightweight, ordered byte streams multiplexed within a single connection:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">Bidirectional Streams</span><span class="field-table-val">Data flows in both directions; used for request/response pairs</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Unidirectional Streams</span><span class="field-table-val">Data flows in one direction; used for server push and control channels</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Client-Initiated</span><span class="field-table-val">Even-numbered stream IDs (0, 4, 8, ...)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Server-Initiated</span><span class="field-table-val">Odd-numbered stream IDs (1, 5, 9, ...)</span></div></div>' +
        '<div class="callout callout-info"><p>Streams are extremely cheap to create \u2014 no handshake is needed. A new stream is opened simply by sending a frame with a new stream ID. This makes QUIC ideal for protocols with many concurrent exchanges.</p></div>'
    },
    {
      id: 'flow-control',
      number: '5',
      title: 'Flow Control',
      content: '<p>QUIC provides flow control at both the stream and connection level:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Stream-Level</div><div class="key-point-text">Each stream has an independent flow control window. The receiver advertises how much data it is willing to accept for each stream via MAX_STREAM_DATA frames.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Connection-Level</div><div class="key-point-text">A connection-wide limit caps the total amount of data across all streams. Advertised via MAX_DATA frames. This prevents the aggregate of all streams from overwhelming the receiver.</div></div></div>'
    },
    {
      id: 'loss-detection',
      number: '6',
      title: 'Loss Detection',
      content: '<p>QUIC uses modern loss detection and congestion control algorithms:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Packet Numbers</div><div class="key-point-text">QUIC packet numbers are strictly increasing and never reused, even for retransmissions. This eliminates the retransmission ambiguity problem that plagues TCP.</div></div>' +
        '<div class="key-point"><div class="key-point-title">ACK Frames</div><div class="key-point-text">QUIC ACKs report ranges of received packets (similar to TCP SACK) and include precise timestamps, enabling accurate RTT measurement.</div></div></div>' +
        '<div class="callout callout-note"><p>QUIC\'s loss recovery is specified separately in RFC 9002. It uses algorithms based on TCP\'s best practices but with improvements enabled by QUIC\'s cleaner design.</p></div>'
    },
    {
      id: 'migration',
      number: '7',
      title: 'Migration',
      content: '<p>QUIC supports connection migration, allowing a connection to survive changes in the client\'s network address:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">How It Works</div><div class="key-point-text">When a client\'s IP address changes (e.g., switching from Wi-Fi to cellular), it simply starts sending packets from the new address with the same connection ID. The server recognizes the connection and continues.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Path Validation</div><div class="key-point-text">After migration, the server validates the new path by sending a PATH_CHALLENGE frame. The client must respond with PATH_RESPONSE to prove it controls the new address.</div></div></div>' +
        '<div class="callout callout-info"><p>Connection migration is invaluable for mobile devices that frequently switch between Wi-Fi and cellular networks. With TCP, every network switch causes a connection reset and must be re-established from scratch.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Iyengar, J. and I. Swett, "QUIC Loss Detection and Congestion Control", RFC 9002, May 2021.' },
    { number: '[2]', text: 'Thomson, M., "Using TLS to Secure QUIC", RFC 9001, May 2021.' },
    { number: '[3]', text: 'Bishop, M., "HTTP/3", RFC 9114, June 2022.' }
  ]
},
{
  number: 1122,
  title: 'Requirements for Internet Hosts -- Communication Layers',
  shortTitle: 'Host Requirements',
  authors: ['R. Braden'],
  organization: 'ISI',
  date: 'October 1989',
  status: 'Internet Standard',
  category: 'core',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The definitive requirements specification for Internet host software implementations',
    color: 'red',
    animation: 'layers',
    animationData: {
      layers: [
        { name: 'Application Layer', detail: 'Telnet, FTP, SMTP, DNS', highlight: false },
        { name: 'Transport Layer', detail: 'TCP, UDP requirements', highlight: true },
        { name: 'Internet Layer', detail: 'IP, ICMP, IGMP requirements', highlight: true },
        { name: 'Link Layer', detail: 'ARP, RARP, Ethernet', highlight: true }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>RFC 1122 defines the requirements for the software of Internet hosts on the communication protocol layers: link layer, IP layer, and transport layer. It is a cornerstone document that established the conventions for how Internet standards express requirements.</p>' +
        '<div class="callout callout-info"><p>This RFC introduced the now-ubiquitous MUST, SHOULD, MAY, MUST NOT, and SHOULD NOT requirement levels that were later formalized in RFC 2119. These terms have become the standard language for all Internet specifications.</p></div>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">MUST / MUST NOT</div><div class="key-point-text">Absolute requirement. An implementation that does not satisfy a MUST requirement is non-conformant.</div></div>' +
        '<div class="key-point"><div class="key-point-title">SHOULD / SHOULD NOT</div><div class="key-point-text">Strong recommendation. There may be valid reasons to deviate, but the implications must be understood.</div></div>' +
        '<div class="key-point"><div class="key-point-title">MAY</div><div class="key-point-text">Truly optional. An implementation may include or omit this feature.</div></div></div>'
    },
    {
      id: 'link-layer',
      number: '2',
      title: 'Link Layer',
      content: '<p>The link layer requirements cover how hosts interface with the physical network:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">ARP Implementation</div><div class="key-point-text">Hosts MUST implement ARP for address resolution on broadcast networks. The ARP cache SHOULD include a mechanism for flushing stale entries and MUST support dynamic updates.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Trailer Encapsulation</div><div class="key-point-text">Hosts MUST NOT send trailer-encapsulated packets unless the recipient has negotiated trailer use. This deprecated feature moved protocol headers after the data in Ethernet frames.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Maximum Transmission Unit</div><div class="key-point-text">The link layer MUST provide a way for the IP layer to determine the MTU of the link. Ethernet has a standard MTU of 1500 bytes.</div></div></div>'
    },
    {
      id: 'ip-layer',
      number: '3',
      title: 'IP Layer',
      content: '<p>IP layer requirements cover addressing, routing, fragmentation, and ICMP handling:</p>' +
        '<div class="field-table"><div class="field-table-row"><span class="field-table-name">Reassembly</span><span class="field-table-val">MUST be able to reassemble fragments up to 576 bytes; SHOULD handle larger</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">TTL</span><span class="field-table-val">MUST set the TTL to a reasonable value (default suggested: 64)</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Source Route</span><span class="field-table-val">MUST be able to receive and forward source-routed packets</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">ICMP</span><span class="field-table-val">MUST support generating and processing ICMP error and info messages</span></div>' +
        '<div class="field-table-row"><span class="field-table-name">Broadcast</span><span class="field-table-val">MUST recognize and handle limited and directed broadcasts</span></div></div>' +
        '<div class="callout callout-note"><p>The "Robustness Principle" (Postel\'s Law) is emphasized: "Be liberal in what you accept, and conservative in what you send." This principle has guided Internet protocol design for decades.</p></div>'
    },
    {
      id: 'transport-layer',
      number: '4',
      title: 'Transport Layer',
      content: '<p>Transport layer requirements cover both TCP and UDP:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">TCP Requirements</div><div class="key-point-text">Hosts MUST implement TCP. TCP MUST implement: urgent data, Nagle algorithm (SHOULD be enabled by default), delayed ACKs (no more than 500ms), Karn\'s algorithm for RTT estimation, and congestion avoidance.</div></div>' +
        '<div class="key-point"><div class="key-point-title">UDP Requirements</div><div class="key-point-text">Hosts MUST implement UDP. Applications SHOULD verify the UDP checksum on received datagrams. The UDP checksum MUST be computed on transmitted datagrams when possible.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Port Assignment</div><div class="key-point-text">Well-known ports (0-1023) are reserved for standard services. Hosts MUST support ephemeral ports for client connections, typically in the range 49152-65535.</div></div></div>' +
        '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">TCP Feature</div><div class="comparison-col">Requirement Level</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Delayed ACKs</div><div class="comparison-col">SHOULD (max 500ms delay)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Nagle Algorithm</div><div class="comparison-col">MUST implement, SHOULD enable by default</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Keep-Alive</div><div class="comparison-col">MAY implement (default OFF, interval >= 2 hours)</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">Urgent Data</div><div class="comparison-col">MUST implement</div></div>' +
        '<div class="comparison-row"><div class="comparison-col">RST on Closed Port</div><div class="comparison-col">MUST send RST</div></div></div>'
    },
    {
      id: 'application-layer',
      number: '5',
      title: 'Application Layer',
      content: '<p>While RFC 1122 focuses on communication layers, it includes guidance for how applications interact with the transport layer:</p>' +
        '<div class="key-points"><div class="key-point"><div class="key-point-title">Interface Requirements</div><div class="key-point-text">The host MUST provide a programming interface (API) that allows applications to: open/close connections, send/receive data, set TTL and TOS values, and be notified of errors.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Error Reporting</div><div class="key-point-text">Transport and IP layer errors (ICMP messages, connection resets) SHOULD be reported to the application. The application should be able to handle these errors gracefully.</div></div>' +
        '<div class="key-point"><div class="key-point-title">Multihoming</div><div class="key-point-text">A host with multiple IP addresses MUST allow applications to specify which source address to use for outgoing connections.</div></div></div>' +
        '<div class="callout callout-warning"><p>RFC 1122 is complemented by RFC 1123 (Host Requirements - Application and Support), which covers application-layer protocols such as Telnet, FTP, SMTP, and DNS.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Braden, R., "Requirements for Internet Hosts -- Application and Support", RFC 1123, October 1989.' },
    { number: '[2]', text: 'Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", RFC 2119, March 1997.' },
    { number: '[3]', text: 'Postel, J., "Internet Protocol", RFC 791, September 1981.' }
  ]
}
);
