window.RFC_DATA = window.RFC_DATA || [];
window.RFC_DATA.push(

{
  "number": 951,
  "title": "Bootstrap Protocol (BOOTP)",
  "shortTitle": "BOOTP",
  "authors": [
    "B. Croft",
    "J. Gilmore"
  ],
  "organization": "Stanford University / Sun Microsystems",
  "date": "September 1985",
  "status": "Internet Standard",
  "category": "infrastructure",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Bootstrap Protocol for automatic IP configuration of diskless workstations",
    "color": "yellow",
    "animation": "packet-flow",
    "animationData": {
      "topNode": {
        "icon": "?",
        "label": "Client",
        "detail": "Diskless workstation"
      },
      "bottomNode": {
        "icon": "S",
        "label": "BOOTP Server",
        "detail": "Configuration provider"
      },
      "reqLabel": "BOOTREQUEST",
      "repLabel": "BOOTREPLY"
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>The Bootstrap Protocol (BOOTP) was designed to allow diskless client machines to discover their own IP address, the address of a server host, and the name of a file to be loaded into memory and executed. It provides a foundation for automatic network configuration that preceded DHCP.</p><div class=\"callout callout-info\"><p>BOOTP was the successor to RARP (Reverse ARP) and provided significantly more configuration information. It was eventually superseded by DHCP (RFC 2131), which added dynamic address allocation.</p></div><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Purpose</div><div class=\"key-point-text\">Allow diskless clients to obtain IP configuration at boot time without manual intervention.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Transport</div><div class=\"key-point-text\">Uses UDP with well-known ports: server port 67, client port 68.</div></div></div>"
    },
    {
      "id": "protocol-overview",
      "number": "2",
      "title": "Protocol Overview",
      "content": "<p>BOOTP uses a single packet exchange model. The client broadcasts a BOOTREQUEST message, and the server responds with a BOOTREPLY containing the client's assigned IP address and boot parameters.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Feature</div><div class=\"comparison-col\">RARP</div><div class=\"comparison-col\">BOOTP</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Protocol</div><div class=\"comparison-col\">Link layer</div><div class=\"comparison-col\">UDP/IP</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Info Provided</div><div class=\"comparison-col\">IP only</div><div class=\"comparison-col\">IP + gateway + boot file</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Router Traversal</div><div class=\"comparison-col\">No</div><div class=\"comparison-col\">Yes (relay agents)</div></div></div><p>The client identifies itself using its hardware address. The server maintains a static table mapping hardware addresses to IP assignments, ensuring consistent address allocation.</p>"
    },
    {
      "id": "packet-format",
      "number": "3",
      "title": "Packet Format",
      "content": "<p>The BOOTP packet is carried in the data portion of a UDP datagram. It uses a fixed-format header followed by a vendor-specific area.</p><div class=\"packet-diagram\"><div class=\"packet-diagram-title\">BOOTP Packet Format</div><pre class=\"packet-ascii\"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|      op       |     htype     |      hlen     |      hops     |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                            xid                                |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|           secs                |           flags               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                          ciaddr                               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                          yiaddr                               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                          siaddr                               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                          giaddr                               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">op</span><span class=\"field-detail\">Message opcode: 1 = BOOTREQUEST, 2 = BOOTREPLY</span><span class=\"field-size\">8 bits</span></div><div class=\"field-item\"><span class=\"field-name\">htype</span><span class=\"field-detail\">Hardware address type (1 = Ethernet)</span><span class=\"field-size\">8 bits</span></div><div class=\"field-item\"><span class=\"field-name\">xid</span><span class=\"field-detail\">Transaction ID for matching requests/replies</span><span class=\"field-size\">32 bits</span></div><div class=\"field-item\"><span class=\"field-name\">yiaddr</span><span class=\"field-detail\">Your (client) IP address assigned by server</span><span class=\"field-size\">32 bits</span></div><div class=\"field-item\"><span class=\"field-name\">siaddr</span><span class=\"field-detail\">Server IP address</span><span class=\"field-size\">32 bits</span></div><div class=\"field-item\"><span class=\"field-name\">giaddr</span><span class=\"field-detail\">Gateway (relay agent) IP address</span><span class=\"field-size\">32 bits</span></div></div>"
    },
    {
      "id": "relay-agents",
      "number": "4",
      "title": "Relay Agents",
      "content": "<p>A key advantage of BOOTP over RARP is the ability to operate across network boundaries using relay agents (also known as BOOTP forwarders). This allows a single centralized BOOTP server to serve multiple network segments.</p><div class=\"callout callout-note\"><p>Relay agents listen on the BOOTP client port (68) and forward requests to servers on remote networks. The <code>giaddr</code> field is filled in by the relay agent with the address of the interface on which the request was received, allowing the server to determine the correct subnet for address allocation.</p></div><p>The relay agent process works as follows:</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Step 1</div><div class=\"key-point-text\">Client broadcasts BOOTREQUEST on local subnet.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Step 2</div><div class=\"key-point-text\">Relay agent receives broadcast and inserts its address in giaddr field.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Step 3</div><div class=\"key-point-text\">Relay agent unicasts the request to the configured BOOTP server.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Step 4</div><div class=\"key-point-text\">Server sends BOOTREPLY to the relay agent, which forwards it to the client.</div></div></div>"
    },
    {
      "id": "vendor-extensions",
      "number": "5",
      "title": "Vendor Extensions",
      "content": "<p>BOOTP includes a 64-byte vendor-specific area that can carry additional configuration parameters. This extensibility mechanism was later formalized as BOOTP options and became the foundation for DHCP options.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Subnet Mask</span><span class=\"field-table-val\">Tag 1 - Client subnet mask</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Default Gateway</span><span class=\"field-table-val\">Tag 3 - Router address for the client</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">DNS Server</span><span class=\"field-table-val\">Tag 6 - Domain name server address</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Hostname</span><span class=\"field-table-val\">Tag 12 - Client hostname</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Domain Name</span><span class=\"field-table-val\">Tag 15 - Domain name for client resolution</span></div></div><div class=\"callout callout-warning\"><p>The original 64-byte vendor area was often too small for complex configurations. RFC 1084 and later RFC 1533 expanded the vendor extensions, ultimately evolving into the comprehensive DHCP option space.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Finlayson, R., \"Bootstrap Loading using TFTP\", RFC 906, June 1984."
    },
    {
      "number": "[2]",
      "text": "Postel, J., \"Reverse Address Resolution Protocol\", RFC 903, June 1984."
    },
    {
      "number": "[3]",
      "text": "Droms, R., \"Dynamic Host Configuration Protocol\", RFC 2131, March 1997."
    }
  ]
},

{
  "number": 1918,
  "title": "Address Allocation for Private Internets",
  "shortTitle": "Private Address Space",
  "authors": [
    "Y. Rekhter",
    "B. Moskowitz",
    "D. Karrenberg",
    "G. J. de Groot",
    "E. Lear"
  ],
  "organization": "Cisco Systems / Chrysler Corp. / RIPE NCC",
  "date": "February 1996",
  "status": "Best Current Practice",
  "category": "infrastructure",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Defining the three private IPv4 address ranges used worldwide",
    "color": "green",
    "animation": "layers",
    "animationData": {
      "layers": [
        {
          "name": "10.0.0.0/8",
          "detail": "Class A - 16,777,216 addresses",
          "highlight": true
        },
        {
          "name": "172.16.0.0/12",
          "detail": "Class B - 1,048,576 addresses",
          "highlight": true
        },
        {
          "name": "192.168.0.0/16",
          "detail": "Class C - 65,536 addresses",
          "highlight": true
        },
        {
          "name": "NAT Gateway",
          "detail": "Address translation boundary",
          "highlight": false
        },
        {
          "name": "Public Internet",
          "detail": "Globally routable addresses",
          "highlight": false
        }
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>RFC 1918 addresses one of the most pressing challenges of the early Internet: IPv4 address exhaustion. By reserving three blocks of the IP address space for private networks, this document enabled organizations to use IP internally without consuming globally unique addresses.</p><div class=\"callout callout-info\"><p>The private address ranges defined in this RFC are the foundation of virtually every home and enterprise network in the world. Combined with Network Address Translation (NAT), they have extended the life of IPv4 far beyond original predictions.</p></div>"
    },
    {
      "id": "private-ranges",
      "number": "2",
      "title": "Private Address Ranges",
      "content": "<p>The Internet Assigned Numbers Authority (IANA) has reserved the following three blocks of the IP address space for private internets:</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">10.0.0.0/8</span><span class=\"field-detail\">10.0.0.0 - 10.255.255.255 (Class A)</span><span class=\"field-size\">16,777,216 hosts</span></div><div class=\"field-item\"><span class=\"field-name\">172.16.0.0/12</span><span class=\"field-detail\">172.16.0.0 - 172.31.255.255 (Class B)</span><span class=\"field-size\">1,048,576 hosts</span></div><div class=\"field-item\"><span class=\"field-name\">192.168.0.0/16</span><span class=\"field-detail\">192.168.0.0 - 192.168.255.255 (Class C)</span><span class=\"field-size\">65,536 hosts</span></div></div><div class=\"callout callout-note\"><p>An enterprise that decides to use IP addresses from these ranges can do so without coordination with IANA or any Internet registry. These addresses are guaranteed to never be assigned as globally unique addresses.</p></div>"
    },
    {
      "id": "motivation",
      "number": "3",
      "title": "Motivation",
      "content": "<p>Many enterprises need network connectivity for internal communications but do not require full external Internet access from every host. Using private addresses for such hosts conserves globally unique addresses.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Address Conservation</div><div class=\"key-point-text\">The IPv4 address space is limited to approximately 4.3 billion addresses. Private addressing dramatically reduces demand for globally unique allocations.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Network Isolation</div><div class=\"key-point-text\">Hosts using private addresses cannot be directly reached from the public Internet, providing a natural layer of security through obscurity.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Flexible Allocation</div><div class=\"key-point-text\">Organizations can freely assign and restructure private addresses without external coordination, simplifying network management.</div></div></div>"
    },
    {
      "id": "routing-considerations",
      "number": "4",
      "title": "Routing Considerations",
      "content": "<p>Internet routers MUST NOT forward traffic with source or destination addresses in the private ranges. These addresses are non-routable by definition on the public Internet.</p><div class=\"callout callout-warning\"><p>ISPs and backbone operators SHOULD filter private addresses at their borders. Leaking private address routes into the global routing table causes black-holing of traffic and routing instability.</p></div><p>For hosts that need connectivity beyond their private network, Network Address Translation (NAT) or application-layer gateways must be deployed at the boundary between the private network and the public Internet.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Approach</div><div class=\"comparison-col\">Pros</div><div class=\"comparison-col\">Cons</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">NAT</div><div class=\"comparison-col\">Transparent to most apps</div><div class=\"comparison-col\">Breaks end-to-end principle</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Proxy/ALG</div><div class=\"comparison-col\">Application-aware</div><div class=\"comparison-col\">Must support each protocol</div></div></div>"
    },
    {
      "id": "dns-issues",
      "number": "5",
      "title": "DNS Issues",
      "content": "<p>Private addresses create challenges for DNS. Private network information (such as address-to-name mappings) should not leak into the public DNS infrastructure.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Split DNS</div><div class=\"key-point-text\">Organizations commonly deploy split DNS, where internal resolvers return private addresses for internal queries while external DNS shows only public addresses.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Reverse DNS</div><div class=\"key-point-text\">Reverse lookups for private addresses (e.g., 10.in-addr.arpa) should be handled locally and never forwarded to the public DNS hierarchy.</div></div></div><div class=\"callout callout-note\"><p>RFC 6303 later formalized the requirement for DNS servers to handle reverse zones for private addresses locally, preventing unnecessary queries to the root and authoritative servers.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Rekhter, Y., et al., \"Address Allocation for Private Internets\", RFC 1597, March 1994."
    },
    {
      "number": "[2]",
      "text": "Egevang, K. and P. Francis, \"The IP Network Address Translator (NAT)\", RFC 1631, May 1994."
    },
    {
      "number": "[3]",
      "text": "Hubbard, K., et al., \"Internet Registry IP Allocation Guidelines\", RFC 2050, November 1996."
    }
  ]
},

{
  "number": 2460,
  "title": "Internet Protocol, Version 6 (IPv6) Specification",
  "shortTitle": "IPv6",
  "authors": [
    "S. Deering",
    "R. Hinden"
  ],
  "organization": "Cisco Systems / Nokia",
  "date": "December 1998",
  "status": "Internet Standard",
  "category": "infrastructure",
  "featured": true,
  "obsoletedBy": "RFC 8200",
  "obsoletes": null,
  "hero": {
    "subtitle": "The next generation Internet Protocol with 128-bit addressing",
    "color": "cyan",
    "animation": "layers",
    "animationData": {
      "layers": [
        {
          "name": "Version",
          "detail": "4 bits (value: 6)",
          "highlight": true
        },
        {
          "name": "Traffic Class",
          "detail": "8 bits",
          "highlight": false
        },
        {
          "name": "Flow Label",
          "detail": "20 bits",
          "highlight": true
        },
        {
          "name": "Payload Length",
          "detail": "16 bits",
          "highlight": false
        },
        {
          "name": "Next Header",
          "detail": "8 bits",
          "highlight": true
        },
        {
          "name": "Hop Limit",
          "detail": "8 bits",
          "highlight": false
        },
        {
          "name": "Source Address",
          "detail": "128 bits",
          "highlight": true
        },
        {
          "name": "Destination Address",
          "detail": "128 bits",
          "highlight": true
        }
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>IPv6 is the successor to IPv4, designed to address the exhaustion of IPv4 addresses and to incorporate improvements based on decades of operational experience with IPv4. The most visible change is the increase from 32-bit to 128-bit addresses, providing a virtually unlimited address space.</p><div class=\"callout callout-info\"><p>With 2^128 possible addresses (approximately 3.4 x 10^38), IPv6 provides enough addresses for every grain of sand on Earth to have a trillion addresses each. This effectively eliminates address scarcity as a design constraint.</p></div>"
    },
    {
      "id": "terminology",
      "number": "2",
      "title": "Terminology",
      "content": "<div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Node</span><span class=\"field-table-val\">A device that implements IPv6</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Router</span><span class=\"field-table-val\">A node that forwards IPv6 packets not explicitly addressed to itself</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Host</span><span class=\"field-table-val\">Any node that is not a router</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Link</span><span class=\"field-table-val\">A communication facility over which nodes can communicate at the link layer</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">MTU</span><span class=\"field-table-val\">Maximum Transmission Unit - largest packet size (in octets) on a link</span></div></div>"
    },
    {
      "id": "header-format",
      "number": "3",
      "title": "Header Format",
      "content": "<p>The IPv6 header is a streamlined, fixed 40-byte structure. Unlike IPv4, there are no header checksums (delegated to upper layers) and no fragmentation fields in the base header.</p><div class=\"packet-diagram\"><div class=\"packet-diagram-title\">IPv6 Header Format</div><pre class=\"packet-ascii\"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|Version| Traffic Class |           Flow Label                  |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|         Payload Length        |  Next Header  |   Hop Limit   |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                                                               |\n+                                                               +\n|                         Source Address                        |\n+                          (128 bits)                           +\n|                                                               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                                                               |\n+                                                               +\n|                      Destination Address                      |\n+                          (128 bits)                           +\n|                                                               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Feature</div><div class=\"comparison-col\">IPv4</div><div class=\"comparison-col\">IPv6</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Header Size</div><div class=\"comparison-col\">20-60 bytes (variable)</div><div class=\"comparison-col\">40 bytes (fixed)</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Address Size</div><div class=\"comparison-col\">32 bits</div><div class=\"comparison-col\">128 bits</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Checksum</div><div class=\"comparison-col\">Yes</div><div class=\"comparison-col\">No (removed)</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Fragmentation</div><div class=\"comparison-col\">Routers may fragment</div><div class=\"comparison-col\">Source only</div></div></div>"
    },
    {
      "id": "extension-headers",
      "number": "4",
      "title": "Extension Headers",
      "content": "<p>IPv6 replaces IPv4's variable-length options with a daisy-chain of extension headers. Each header contains a Next Header field identifying the type of the following header.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">Hop-by-Hop Options</span><span class=\"field-detail\">Processed by every node along the path</span><span class=\"field-size\">NH: 0</span></div><div class=\"field-item\"><span class=\"field-name\">Routing</span><span class=\"field-detail\">Source routing and segment routing</span><span class=\"field-size\">NH: 43</span></div><div class=\"field-item\"><span class=\"field-name\">Fragment</span><span class=\"field-detail\">Fragmentation and reassembly (source only)</span><span class=\"field-size\">NH: 44</span></div><div class=\"field-item\"><span class=\"field-name\">Destination Options</span><span class=\"field-detail\">Options processed only by destination</span><span class=\"field-size\">NH: 60</span></div><div class=\"field-item\"><span class=\"field-name\">Authentication</span><span class=\"field-detail\">IPsec authentication header</span><span class=\"field-size\">NH: 51</span></div><div class=\"field-item\"><span class=\"field-name\">ESP</span><span class=\"field-detail\">IPsec encapsulating security payload</span><span class=\"field-size\">NH: 50</span></div></div><div class=\"callout callout-warning\"><p>Extension headers MUST be processed in the order they appear. A critical design principle is that only the Hop-by-Hop Options header is examined by every router; all other extension headers are only processed by the destination node.</p></div>"
    },
    {
      "id": "flow-labels",
      "number": "5",
      "title": "Flow Labels",
      "content": "<p>The 20-bit Flow Label field in the IPv6 header enables efficient handling of real-time traffic flows. Routers can use the combination of source address and flow label to identify packets belonging to the same flow without inspecting transport-layer headers.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Flow Identification</div><div class=\"key-point-text\">A flow is a sequence of packets sent from a source to a destination for which the source desires special handling by intervening routers.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Non-zero Values</div><div class=\"key-point-text\">A source MUST set the flow label to a pseudo-random non-zero value for each new flow requiring special treatment.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Router Processing</div><div class=\"key-point-text\">Routers that do not support flow label processing MUST ignore this field and forward the packet normally.</div></div></div>"
    },
    {
      "id": "address-architecture",
      "number": "6",
      "title": "Address Architecture",
      "content": "<p>IPv6 addresses are 128 bits long, written as eight groups of four hexadecimal digits separated by colons. The address architecture defines three types of addresses:</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Unicast</span><span class=\"field-table-val\">Identifies a single interface; packets delivered to that interface</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Multicast</span><span class=\"field-table-val\">Identifies a group of interfaces; packets delivered to all members</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Anycast</span><span class=\"field-table-val\">Identifies a group; packets delivered to the nearest member</span></div></div><div class=\"code-block\"><div class=\"code-block-title\">IPv6 Address Examples</div><pre>Full form:    2001:0db8:85a3:0000:0000:8a2e:0370:7334\nCompressed:   2001:db8:85a3::8a2e:370:7334\nLoopback:     ::1\nLink-local:   fe80::1</pre></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Deering, S. and R. Hinden, \"Internet Protocol, Version 6 (IPv6) Specification\", RFC 8200, July 2017."
    },
    {
      "number": "[2]",
      "text": "Hinden, R. and S. Deering, \"IP Version 6 Addressing Architecture\", RFC 4291, February 2006."
    },
    {
      "number": "[3]",
      "text": "Thomson, S. and T. Narten, \"IPv6 Stateless Address Autoconfiguration\", RFC 2462, December 1998."
    }
  ]
},

{
  "number": 4291,
  "title": "IP Version 6 Addressing Architecture",
  "shortTitle": "IPv6 Addressing",
  "authors": [
    "R. Hinden",
    "S. Deering"
  ],
  "organization": "Nokia / Cisco Systems",
  "date": "February 2006",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Defining unicast, multicast, and anycast address types for IPv6",
    "color": "blue",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        "fe80::1%eth0",
        "::ffff:192.0.2.1",
        "ff02::1"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>This document defines the addressing architecture of the IP Version 6 (IPv6) protocol. It includes the IPv6 address format, the various types of addresses, and the rules for text representation of addresses.</p><div class=\"callout callout-info\"><p>IPv6 addresses are 128 bits long. The address space is divided into multiple types based on the high-order bits, providing a structured and extensible addressing hierarchy.</p></div>"
    },
    {
      "id": "address-types",
      "number": "2",
      "title": "Address Types",
      "content": "<p>IPv6 defines three types of addresses. Unlike IPv4, there is no broadcast address in IPv6; its function is superseded by multicast.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Unicast</div><div class=\"key-point-text\">An identifier for a single interface. A packet sent to a unicast address is delivered to the interface identified by that address.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Anycast</div><div class=\"key-point-text\">An identifier for a set of interfaces (typically on different nodes). A packet sent to an anycast address is delivered to the nearest interface, as determined by routing protocol metrics.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Multicast</div><div class=\"key-point-text\">An identifier for a set of interfaces. A packet sent to a multicast address is delivered to all interfaces identified by that address.</div></div></div>"
    },
    {
      "id": "text-representation",
      "number": "3",
      "title": "Text Representation",
      "content": "<p>IPv6 addresses are written as eight groups of four hexadecimal digits separated by colons. Several compression rules simplify the notation:</p><div class=\"code-block\"><div class=\"code-block-title\">Address Compression Rules</div><pre>Full form:       2001:0db8:0000:0000:0000:0000:0000:0001\nLeading zeros:   2001:db8:0:0:0:0:0:1\nConsecutive ::   2001:db8::1\n\nIPv4-mapped:     ::ffff:192.168.1.1\nLoopback:        ::1\nUnspecified:     ::</pre></div><div class=\"callout callout-note\"><p>The :: notation can only be used once in an address to avoid ambiguity. For example, 2001:db8::1::2 is invalid because the parser cannot determine how many zero groups each :: represents.</p></div>"
    },
    {
      "id": "unicast-addresses",
      "number": "4",
      "title": "Unicast Addresses",
      "content": "<p>IPv6 unicast addresses come in several forms, each serving a different purpose in the network architecture.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">Global Unicast</span><span class=\"field-detail\">2000::/3 - Globally routable, equivalent to IPv4 public addresses</span><span class=\"field-size\">Prefix: 001</span></div><div class=\"field-item\"><span class=\"field-name\">Link-Local</span><span class=\"field-detail\">fe80::/10 - Valid only on a single link, auto-configured</span><span class=\"field-size\">Prefix: 1111 1110 10</span></div><div class=\"field-item\"><span class=\"field-name\">Unique Local</span><span class=\"field-detail\">fc00::/7 - Private addresses, similar to RFC 1918</span><span class=\"field-size\">Prefix: 1111 110</span></div><div class=\"field-item\"><span class=\"field-name\">Loopback</span><span class=\"field-detail\">::1 - Equivalent to IPv4 127.0.0.1</span><span class=\"field-size\">128 bits</span></div><div class=\"field-item\"><span class=\"field-name\">Unspecified</span><span class=\"field-detail\">:: - Indicates absence of an address</span><span class=\"field-size\">128 bits</span></div></div>"
    },
    {
      "id": "multicast-addresses",
      "number": "5",
      "title": "Multicast Addresses",
      "content": "<p>Multicast addresses have the prefix ff00::/8. The flags and scope fields allow fine-grained control over multicast behavior.</p><div class=\"packet-diagram\"><div class=\"packet-diagram-title\">Multicast Address Format</div><pre class=\"packet-ascii\">|   8    |  4 |  4 |                  112 bits                  |\n+--------+----+----+---------------------------------------------+\n|11111111|flgs|scop|                  group ID                   |\n+--------+----+----+---------------------------------------------+</pre></div><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">ff02::1</span><span class=\"field-table-val\">All nodes on the local link</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">ff02::2</span><span class=\"field-table-val\">All routers on the local link</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">ff02::1:ff00:0/104</span><span class=\"field-table-val\">Solicited-node multicast</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">ff05::2</span><span class=\"field-table-val\">All routers in the site</span></div></div>"
    },
    {
      "id": "required-addresses",
      "number": "6",
      "title": "Required Addresses",
      "content": "<p>Every IPv6 node must recognize certain addresses to participate in the network.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Node Type</div><div class=\"comparison-col\">Required Addresses</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Host</div><div class=\"comparison-col\">Link-local for each interface, loopback (::1), all-nodes multicast (ff02::1), solicited-node multicast for each unicast/anycast address</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Router</div><div class=\"comparison-col\">All host-required addresses plus all-routers multicast (ff02::2) and subnet-router anycast for each interface</div></div></div><div class=\"callout callout-note\"><p>Link-local addresses are mandatory for every IPv6 interface and are automatically configured from the interface identifier, making basic connectivity possible without any manual configuration or DHCP.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Deering, S. and R. Hinden, \"Internet Protocol, Version 6 (IPv6) Specification\", RFC 2460, December 1998."
    },
    {
      "number": "[2]",
      "text": "Hinden, R. and S. Deering, \"IPv6 Multicast Address Assignments\", RFC 2375, July 1998."
    },
    {
      "number": "[3]",
      "text": "Draves, R., \"Default Address Selection for IPv6\", RFC 3484, February 2003."
    }
  ]
},

{
  "number": 2328,
  "title": "OSPF Version 2",
  "shortTitle": "OSPF v2",
  "authors": [
    "J. Moy"
  ],
  "organization": "Ascend Communications",
  "date": "April 1998",
  "status": "Internet Standard",
  "category": "routing",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Open Shortest Path First - the dominant interior gateway routing protocol",
    "color": "green",
    "animation": "tree",
    "animationData": {
      "root": {
        "label": "Backbone\nArea 0",
        "children": [
          {
            "label": "Area 1\nStub",
            "children": [
              {
                "label": "Router A",
                "children": []
              },
              {
                "label": "Router B",
                "children": []
              }
            ]
          },
          {
            "label": "Area 2\nNSSA",
            "children": [
              {
                "label": "Router C",
                "children": []
              },
              {
                "label": "Router D",
                "children": []
              }
            ]
          }
        ]
      }
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>OSPF (Open Shortest Path First) is a link-state routing protocol designed for IP networks. It is an Interior Gateway Protocol (IGP) that distributes routing information between routers within a single Autonomous System (AS).</p><div class=\"callout callout-info\"><p>OSPF is the most widely deployed IGP in enterprise networks. It uses Dijkstra's Shortest Path First algorithm to compute the best path to each destination, hence its name.</p></div><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Link-State Protocol</div><div class=\"key-point-text\">Each router maintains a complete topological database of the network and independently calculates routing tables.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Convergence</div><div class=\"key-point-text\">OSPF converges rapidly after network changes through immediate flooding of Link State Advertisements (LSAs).</div></div><div class=\"key-point\"><div class=\"key-point-title\">Hierarchical Design</div><div class=\"key-point-text\">Networks can be divided into areas to reduce routing overhead and contain LSA flooding.</div></div></div>"
    },
    {
      "id": "protocol-overview",
      "number": "2",
      "title": "Protocol Overview",
      "content": "<p>OSPF operates by flooding link-state advertisements (LSAs) throughout the routing domain. Each router constructs a link-state database (LSDB) representing the complete network topology, then runs the SPF algorithm to build a shortest-path tree rooted at itself.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Feature</div><div class=\"comparison-col\">OSPF</div><div class=\"comparison-col\">RIP</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Algorithm</div><div class=\"comparison-col\">Dijkstra (link-state)</div><div class=\"comparison-col\">Bellman-Ford (distance-vector)</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Metric</div><div class=\"comparison-col\">Cost (bandwidth-based)</div><div class=\"comparison-col\">Hop count (max 15)</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Convergence</div><div class=\"comparison-col\">Fast (seconds)</div><div class=\"comparison-col\">Slow (minutes)</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Scalability</div><div class=\"comparison-col\">Excellent (hierarchical)</div><div class=\"comparison-col\">Limited (flat)</div></div></div>"
    },
    {
      "id": "areas",
      "number": "3",
      "title": "Areas",
      "content": "<p>OSPF uses a two-level hierarchy with a backbone area (Area 0) and non-backbone areas. All inter-area traffic must transit the backbone, providing a hub-and-spoke topology that simplifies routing.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Area 0 (Backbone)</span><span class=\"field-table-val\">Central area through which all inter-area traffic flows</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Standard Area</span><span class=\"field-table-val\">Accepts all LSA types; full routing information</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Stub Area</span><span class=\"field-table-val\">No external routes; uses default route to exit the area</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Totally Stubby</span><span class=\"field-table-val\">No external or inter-area routes; only a default route</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">NSSA</span><span class=\"field-table-val\">Not-So-Stubby Area: allows limited external route injection via Type 7 LSA</span></div></div><div class=\"callout callout-note\"><p>Area Border Routers (ABRs) connect areas to the backbone and summarize routing information between them, reducing the size of each area's link-state database.</p></div>"
    },
    {
      "id": "lsa-types",
      "number": "4",
      "title": "LSA Types",
      "content": "<p>Link State Advertisements are the fundamental units of information in OSPF. Each LSA type serves a specific purpose in the routing topology.</p><div class=\"opcode-grid\"><div class=\"opcode-card\"><span class=\"opcode-highlight\">Type 1</span><span>Router LSA - Describes a router's links within an area</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">Type 2</span><span>Network LSA - Generated by DR for multi-access segments</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">Type 3</span><span>Summary LSA - Inter-area route advertisements by ABRs</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">Type 4</span><span>ASBR Summary - Describes route to an ASBR</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">Type 5</span><span>AS External LSA - External routes redistributed into OSPF</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">Type 7</span><span>NSSA External - External routes in NSSA areas</span></div></div>"
    },
    {
      "id": "spf-algorithm",
      "number": "5",
      "title": "SPF Algorithm",
      "content": "<p>The Shortest Path First algorithm (Dijkstra's algorithm) is the core computation of OSPF. Each router independently runs SPF to build a shortest-path tree rooted at itself, then derives its routing table from this tree.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Step 1: Initialize</div><div class=\"key-point-text\">Place the root (self) on the candidate list with cost 0. All other nodes start at infinity.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Step 2: Select Best</div><div class=\"key-point-text\">Move the candidate with lowest cost to the SPF tree. This node's shortest path is now known.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Step 3: Update Neighbors</div><div class=\"key-point-text\">For each neighbor of the newly added node, update its cost if the path through this node is shorter.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Step 4: Repeat</div><div class=\"key-point-text\">Continue until all reachable nodes are on the SPF tree. The routing table is derived from the tree.</div></div></div>"
    },
    {
      "id": "neighbor-discovery",
      "number": "6",
      "title": "Neighbor Discovery",
      "content": "<p>OSPF routers discover neighbors by exchanging Hello packets at regular intervals. The Hello protocol establishes and maintains neighbor relationships and elects Designated Routers on multi-access networks.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">Hello Interval</span><span class=\"field-detail\">Time between Hello packets (typically 10 seconds)</span><span class=\"field-size\">Configurable</span></div><div class=\"field-item\"><span class=\"field-name\">Dead Interval</span><span class=\"field-detail\">Time to declare a neighbor down (typically 40 seconds)</span><span class=\"field-size\">4x Hello</span></div><div class=\"field-item\"><span class=\"field-name\">DR Election</span><span class=\"field-detail\">Router with highest priority (or Router ID) becomes DR</span><span class=\"field-size\">Per segment</span></div><div class=\"field-item\"><span class=\"field-name\">BDR</span><span class=\"field-detail\">Backup Designated Router provides redundancy</span><span class=\"field-size\">Per segment</span></div></div><div class=\"callout callout-warning\"><p>Neighbors must agree on Hello interval, Dead interval, area ID, and authentication to form an adjacency. Mismatched parameters are a common cause of OSPF adjacency failures.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Moy, J., \"OSPF Version 2\", RFC 2178, July 1997."
    },
    {
      "number": "[2]",
      "text": "Coltun, R., \"The OSPF Opaque LSA Option\", RFC 2370, July 1998."
    },
    {
      "number": "[3]",
      "text": "Dijkstra, E.W., \"A Note on Two Problems in Connexion with Graphs\", 1959."
    }
  ]
},

{
  "number": 4271,
  "title": "A Border Gateway Protocol 4 (BGP-4)",
  "shortTitle": "BGP-4",
  "authors": [
    "Y. Rekhter",
    "T. Li",
    "S. Hares"
  ],
  "organization": "Juniper / Redback / Nexthop",
  "date": "January 2006",
  "status": "Internet Standard",
  "category": "routing",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The routing protocol that holds the Internet together",
    "color": "red",
    "animation": "packet-flow",
    "animationData": {
      "topNode": {
        "icon": "A",
        "label": "AS 64501",
        "detail": "eBGP peer"
      },
      "bottomNode": {
        "icon": "B",
        "label": "AS 64502",
        "detail": "eBGP peer"
      },
      "reqLabel": "UPDATE",
      "repLabel": "KEEPALIVE"
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>BGP-4 is the de facto standard exterior gateway protocol of the Internet. It enables autonomous systems (ASes) to exchange reachability information for IP prefixes, forming the global Internet routing table.</p><div class=\"callout callout-info\"><p>BGP is fundamentally a policy-based routing protocol. Unlike IGPs that optimize for shortest path, BGP allows network operators to implement complex routing policies based on business relationships, peering agreements, and traffic engineering goals.</p></div><p>BGP uses TCP (port 179) as its transport, ensuring reliable delivery of routing updates. The protocol is incremental - after the initial exchange of the full routing table, only changes are propagated.</p>"
    },
    {
      "id": "protocol-overview",
      "number": "2",
      "title": "Protocol Overview",
      "content": "<p>BGP is a path-vector protocol. Each route advertisement carries the complete AS path it has traversed, enabling loop detection and policy-based route selection.</p><div class=\"opcode-grid\"><div class=\"opcode-card\"><span class=\"opcode-highlight\">OPEN</span><span>Establishes BGP session, exchanges capabilities</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">UPDATE</span><span>Advertises new routes or withdraws previously announced routes</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">KEEPALIVE</span><span>Maintains session liveness (sent every 60 seconds by default)</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">NOTIFICATION</span><span>Reports errors and terminates the session</span></div></div>"
    },
    {
      "id": "path-attributes",
      "number": "3",
      "title": "Path Attributes",
      "content": "<p>Each BGP UPDATE message carries a set of path attributes that describe the properties of the advertised routes. These attributes drive the route selection process.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">AS_PATH</span><span class=\"field-detail\">Ordered list of ASes the route has traversed (loop detection)</span><span class=\"field-size\">Well-known mandatory</span></div><div class=\"field-item\"><span class=\"field-name\">NEXT_HOP</span><span class=\"field-detail\">IP address of the next-hop router for the advertised prefix</span><span class=\"field-size\">Well-known mandatory</span></div><div class=\"field-item\"><span class=\"field-name\">LOCAL_PREF</span><span class=\"field-detail\">Preference value within an AS (higher = preferred)</span><span class=\"field-size\">Well-known discretionary</span></div><div class=\"field-item\"><span class=\"field-name\">MED</span><span class=\"field-detail\">Multi-Exit Discriminator - suggests preferred entry point (lower = preferred)</span><span class=\"field-size\">Optional non-transitive</span></div><div class=\"field-item\"><span class=\"field-name\">COMMUNITY</span><span class=\"field-detail\">Tags for implementing routing policies (e.g., no-export)</span><span class=\"field-size\">Optional transitive</span></div><div class=\"field-item\"><span class=\"field-name\">ORIGIN</span><span class=\"field-detail\">Origin of the route: IGP, EGP, or Incomplete</span><span class=\"field-size\">Well-known mandatory</span></div></div>"
    },
    {
      "id": "decision-process",
      "number": "4",
      "title": "Decision Process",
      "content": "<p>When multiple paths exist to the same destination, BGP uses a well-defined decision process to select the best path. Attributes are compared in strict order of priority.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">1. Highest LOCAL_PREF</div><div class=\"key-point-text\">Prefer routes with the highest local preference value (iBGP only).</div></div><div class=\"key-point\"><div class=\"key-point-title\">2. Shortest AS_PATH</div><div class=\"key-point-text\">Prefer routes that traverse the fewest autonomous systems.</div></div><div class=\"key-point\"><div class=\"key-point-title\">3. Lowest ORIGIN</div><div class=\"key-point-text\">Prefer IGP over EGP over Incomplete origin types.</div></div><div class=\"key-point\"><div class=\"key-point-title\">4. Lowest MED</div><div class=\"key-point-text\">Prefer the path with the lowest multi-exit discriminator (same neighbor AS).</div></div><div class=\"key-point\"><div class=\"key-point-title\">5. eBGP over iBGP</div><div class=\"key-point-text\">Prefer externally learned routes over internally learned ones.</div></div><div class=\"key-point\"><div class=\"key-point-title\">6. Lowest IGP Cost</div><div class=\"key-point-text\">Prefer the path with the lowest IGP metric to the next hop (hot potato routing).</div></div></div>"
    },
    {
      "id": "update-message",
      "number": "5",
      "title": "UPDATE Message",
      "content": "<p>The UPDATE message is the core of BGP routing information exchange. Each message can simultaneously withdraw previously advertised routes and advertise new ones.</p><div class=\"packet-diagram\"><div class=\"packet-diagram-title\">BGP UPDATE Message</div><pre class=\"packet-ascii\">+-----------------------------------------------------+\n|   Withdrawn Routes Length (2 octets)                |\n+-----------------------------------------------------+\n|   Withdrawn Routes (variable)                       |\n+-----------------------------------------------------+\n|   Total Path Attribute Length (2 octets)             |\n+-----------------------------------------------------+\n|   Path Attributes (variable)                        |\n+-----------------------------------------------------+\n|   Network Layer Reachability Information (variable)  |\n+-----------------------------------------------------+</pre></div><div class=\"callout callout-note\"><p>NLRI (Network Layer Reachability Information) encodes IP prefixes using a length-prefix pair, allowing efficient representation of routes ranging from /0 (default) to /32 (host routes).</p></div>"
    },
    {
      "id": "finite-state-machine",
      "number": "6",
      "title": "Finite State Machine",
      "content": "<p>The BGP Finite State Machine (FSM) defines the lifecycle of a BGP session, from initial connection to established state and error handling.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Idle</span><span class=\"field-table-val\">Initial state; no connection attempt in progress</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Connect</span><span class=\"field-table-val\">TCP connection in progress to the peer</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Active</span><span class=\"field-table-val\">Listening for TCP connection from the peer</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">OpenSent</span><span class=\"field-table-val\">OPEN message sent; awaiting peer OPEN</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">OpenConfirm</span><span class=\"field-table-val\">OPEN received; awaiting KEEPALIVE</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Established</span><span class=\"field-table-val\">Session is up; UPDATE messages can be exchanged</span></div></div><div class=\"callout callout-warning\"><p>A BGP session stuck in the Active state usually indicates a connectivity problem or misconfiguration. This is one of the most common troubleshooting scenarios in BGP operations.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Rekhter, Y. and T. Li, \"A Border Gateway Protocol 4 (BGP-4)\", RFC 1771, March 1995."
    },
    {
      "number": "[2]",
      "text": "Chen, E. and J. Yuan, \"BGP Route Reflection\", RFC 4456, April 2006."
    },
    {
      "number": "[3]",
      "text": "Hawkinson, J. and T. Bates, \"Guidelines for creation of an AS\", RFC 1930, March 1996."
    }
  ]
},

{
  "number": 1951,
  "title": "DEFLATE Compressed Data Format Specification version 1.3",
  "shortTitle": "DEFLATE",
  "authors": [
    "P. Deutsch"
  ],
  "organization": "Aladdin Enterprises",
  "date": "May 1996",
  "status": "Informational",
  "category": "data",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The compression algorithm behind gzip, zlib, and PNG",
    "color": "blue",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "Input bytes stream",
        "LZ77: (length, distance) pairs",
        "Huffman coding: variable bits",
        "Compressed bitstream output"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>DEFLATE is a lossless data compression algorithm that combines LZ77 (dictionary-based compression) with Huffman coding (entropy coding). It is one of the most widely used compression formats in computing.</p><div class=\"callout callout-info\"><p>DEFLATE is used in gzip, zlib, ZIP archives, PNG images, HTTP content-encoding, and countless other formats. Its combination of good compression ratio and fast decompression makes it ubiquitous.</p></div><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">LZ77</div><div class=\"key-point-text\">Replaces repeated sequences with back-references to earlier occurrences, expressed as (length, distance) pairs.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Huffman Coding</div><div class=\"key-point-text\">Assigns shorter bit codes to more frequent symbols, reducing the average number of bits per symbol.</div></div></div>"
    },
    {
      "id": "compression-algorithm",
      "number": "2",
      "title": "Compression Algorithm",
      "content": "<p>The DEFLATE compressor divides input into blocks. Each block is compressed independently using LZ77 followed by Huffman coding. The compressor can choose the best block boundaries and coding method for each block.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Stage</div><div class=\"comparison-col\">Input</div><div class=\"comparison-col\">Output</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">LZ77</div><div class=\"comparison-col\">Raw bytes</div><div class=\"comparison-col\">Literals + (length, distance) pairs</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Huffman</div><div class=\"comparison-col\">LZ77 output symbols</div><div class=\"comparison-col\">Variable-length bit codes</div></div></div><p>The compressor maintains a sliding window of 32,768 bytes of recently processed data. When a match of 3 or more bytes is found within this window, the compressor emits a (length, distance) back-reference instead of the literal bytes.</p>"
    },
    {
      "id": "huffman-coding",
      "number": "3",
      "title": "Huffman Coding",
      "content": "<p>DEFLATE uses prefix-free Huffman codes to encode the output of the LZ77 stage. The alphabet consists of 286 literal/length codes and 30 distance codes.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">0-255</span><span class=\"field-detail\">Literal byte values (output directly)</span><span class=\"field-size\">256 codes</span></div><div class=\"field-item\"><span class=\"field-name\">256</span><span class=\"field-detail\">End of block marker</span><span class=\"field-size\">1 code</span></div><div class=\"field-item\"><span class=\"field-name\">257-285</span><span class=\"field-detail\">Length codes (3-258 bytes), paired with extra bits</span><span class=\"field-size\">29 codes</span></div></div><div class=\"callout callout-note\"><p>DEFLATE supports three block types: uncompressed (stored), fixed Huffman codes (predefined tables), and dynamic Huffman codes (custom tables included in the block). The compressor selects the type that produces the smallest output for each block.</p></div>"
    },
    {
      "id": "lz77",
      "number": "4",
      "title": "LZ77 Compression",
      "content": "<p>The LZ77 algorithm maintains a sliding window over the input stream. As each position is processed, the algorithm searches for the longest match within the window.</p><div class=\"code-block\"><div class=\"code-block-title\">LZ77 Compression Example</div><pre>Input:  \"ABCABCABC\"\n\nPosition 0: A (literal)\nPosition 1: B (literal)\nPosition 2: C (literal)\nPosition 3: Match at distance=3, length=6\n\nOutput: A B C (3,6)\nSaved:  3 bytes instead of 6 = 50% reduction</pre></div><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Window Size</span><span class=\"field-table-val\">32,768 bytes (32 KB)</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Min Match</span><span class=\"field-table-val\">3 bytes</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Max Match</span><span class=\"field-table-val\">258 bytes</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Max Distance</span><span class=\"field-table-val\">32,768 bytes</span></div></div>"
    },
    {
      "id": "block-format",
      "number": "5",
      "title": "Block Format",
      "content": "<p>Each DEFLATE block begins with a 3-bit header: 1 bit indicating whether this is the final block, and 2 bits indicating the block type.</p><div class=\"opcode-grid\"><div class=\"opcode-card\"><span class=\"opcode-highlight\">00</span><span>No compression (stored) - data is stored verbatim</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">01</span><span>Fixed Huffman codes - uses predefined code tables</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">10</span><span>Dynamic Huffman codes - custom tables in block header</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">11</span><span>Reserved (error)</span></div></div><div class=\"callout callout-warning\"><p>The decompressor MUST be able to handle any of the three valid block types in any order within a single compressed stream. A well-designed compressor will choose the block type that yields the best compression for each segment of input data.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Ziv, J. and A. Lempel, \"A Universal Algorithm for Sequential Data Compression\", IEEE Transactions on Information Theory, 1977."
    },
    {
      "number": "[2]",
      "text": "Huffman, D., \"A Method for the Construction of Minimum-Redundancy Codes\", Proceedings of the IRE, 1952."
    },
    {
      "number": "[3]",
      "text": "Deutsch, P., \"GZIP file format specification version 4.3\", RFC 1952, May 1996."
    }
  ]
},

{
  "number": 3986,
  "title": "Uniform Resource Identifier (URI): Generic Syntax",
  "shortTitle": "URI Syntax",
  "authors": [
    "T. Berners-Lee",
    "R. Fielding",
    "L. Masinter"
  ],
  "organization": "W3C / Day Software / Adobe Systems",
  "date": "January 2005",
  "status": "Internet Standard",
  "category": "data",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The universal syntax for identifying resources on the Internet",
    "color": "purple",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "scheme://authority/path?query#fragment",
        "https://user:pass@host:443/path",
        "?key=value&key2=value2",
        "#section-id"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>A Uniform Resource Identifier (URI) provides a simple and extensible means for identifying a resource. This specification defines the generic URI syntax and the process for resolving URI references.</p><div class=\"callout callout-info\"><p>URIs are the foundation of the Web. Every URL you type in a browser, every API endpoint, and every resource link follows this specification. Understanding URI syntax is essential for web development and Internet protocols.</p></div>"
    },
    {
      "id": "characters",
      "number": "2",
      "title": "Characters",
      "content": "<p>URIs are composed of a limited set of characters. Characters outside this set must be percent-encoded.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Unreserved</span><span class=\"field-table-val\">A-Z a-z 0-9 - . _ ~</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Reserved (gen-delims)</span><span class=\"field-table-val\">: / ? # [ ] @</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Reserved (sub-delims)</span><span class=\"field-table-val\">! $ & ' ( ) * + , ; =</span></div></div><div class=\"code-block\"><div class=\"code-block-title\">Percent-Encoding Examples</div><pre>Space       -> %20\nForward /   -> %2F (in path segments)\nQuestion ?  -> %3F (in path)\nAmpersand & -> %26 (in query values)\nUTF-8 char  -> %E2%9C%93 (checkmark)</pre></div>"
    },
    {
      "id": "syntax-components",
      "number": "3",
      "title": "Syntax Components",
      "content": "<p>The generic URI syntax consists of a hierarchical sequence of five components:</p><div class=\"code-block\"><div class=\"code-block-title\">URI Component Breakdown</div><pre>         foo://example.com:8042/over/there?name=ferret#nose\n         \\_/   \\______________/\\_________/ \\_________/ \\__/\n          |           |            |            |        |\n       scheme     authority       path        query   fragment</pre></div><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">scheme</span><span class=\"field-detail\">Identifies the protocol (http, https, ftp, mailto, etc.)</span><span class=\"field-size\">Required</span></div><div class=\"field-item\"><span class=\"field-name\">authority</span><span class=\"field-detail\">[userinfo@]host[:port] - identifies the server</span><span class=\"field-size\">Optional</span></div><div class=\"field-item\"><span class=\"field-name\">path</span><span class=\"field-detail\">Hierarchical path to the resource</span><span class=\"field-size\">Required (may be empty)</span></div><div class=\"field-item\"><span class=\"field-name\">query</span><span class=\"field-detail\">Non-hierarchical key-value parameters</span><span class=\"field-size\">Optional</span></div><div class=\"field-item\"><span class=\"field-name\">fragment</span><span class=\"field-detail\">Secondary resource identifier (client-side only)</span><span class=\"field-size\">Optional</span></div></div>"
    },
    {
      "id": "resolution",
      "number": "4",
      "title": "Reference Resolution",
      "content": "<p>Relative references allow URIs to be expressed relative to a base URI. The resolution algorithm transforms a relative reference into its target URI.</p><div class=\"code-block\"><div class=\"code-block-title\">Reference Resolution Examples</div><pre>Base URI: http://a/b/c/d;p?q\n\n\"g:h\"       -> g:h            (different scheme)\n\"g\"         -> http://a/b/c/g  (relative path)\n\"./g\"       -> http://a/b/c/g  (same as above)\n\"../g\"      -> http://a/b/g    (parent directory)\n\"//g\"       -> http://g        (network-path)\n\"?y\"        -> http://a/b/c/d;p?y  (query override)\n\"#s\"        -> http://a/b/c/d;p?q#s (fragment only)</pre></div><div class=\"callout callout-note\"><p>Relative references are heavily used in HTML (links, images, stylesheets) and HTTP (Location header redirects). The resolution algorithm must handle edge cases like empty paths, double dots, and scheme-relative references.</p></div>"
    },
    {
      "id": "normalization",
      "number": "5",
      "title": "Normalization",
      "content": "<p>URI normalization converts URIs into a canonical form, enabling comparison of URIs that may be syntactically different but semantically equivalent.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Case Normalization</div><div class=\"key-point-text\">Scheme and host are case-insensitive and should be lowercased. Percent-encoding hex digits should be uppercased (e.g., %2f -> %2F).</div></div><div class=\"key-point\"><div class=\"key-point-title\">Percent-Encoding Normalization</div><div class=\"key-point-text\">Unreserved characters that are percent-encoded should be decoded (e.g., %41 -> A).</div></div><div class=\"key-point\"><div class=\"key-point-title\">Path Segment Normalization</div><div class=\"key-point-text\">Dot segments (. and ..) in the path should be resolved and removed.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Port Normalization</div><div class=\"key-point-text\">Default ports should be removed (e.g., http://example.com:80/ -> http://example.com/).</div></div></div>"
    },
    {
      "id": "uri-vs-url-vs-urn",
      "number": "6",
      "title": "URI, URL, and URN",
      "content": "<p>The terms URI, URL, and URN are often confused. This specification clarifies their relationship.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Term</div><div class=\"comparison-col\">Description</div><div class=\"comparison-col\">Example</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">URI</div><div class=\"comparison-col\">Generic identifier for any resource</div><div class=\"comparison-col\">Any URL or URN</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">URL</div><div class=\"comparison-col\">URI that provides location/access mechanism</div><div class=\"comparison-col\">https://example.com/page</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">URN</div><div class=\"comparison-col\">URI that provides persistent name</div><div class=\"comparison-col\">urn:isbn:0451450523</div></div></div><div class=\"callout callout-note\"><p>In practice, the terms URI and URL are often used interchangeably. The distinction matters primarily in formal specifications. All URLs are URIs, and all URNs are URIs, but not all URIs are URLs or URNs.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Berners-Lee, T., \"Universal Resource Identifiers in WWW\", RFC 1630, June 1994."
    },
    {
      "number": "[2]",
      "text": "Fielding, R., \"Relative Uniform Resource Locators\", RFC 1808, June 1995."
    },
    {
      "number": "[3]",
      "text": "Moats, R., \"URN Syntax\", RFC 2141, May 1997."
    }
  ]
},

{
  "number": 4648,
  "title": "The Base16, Base32, and Base64 Data Encodings",
  "shortTitle": "Base Encodings",
  "authors": [
    "S. Josefsson"
  ],
  "organization": "SJD",
  "date": "October 2006",
  "status": "Proposed Standard",
  "category": "data",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Encoding binary data as printable ASCII text",
    "color": "orange",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "Input:  M  a  n",
        "ASCII:  77 97 110",
        "Binary: 010011 010110 000101 101110",
        "Base64: T    W    F    u"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>Base encodings convert arbitrary binary data into text using a restricted alphabet of printable ASCII characters. This is essential for transporting binary data through text-only channels such as email, URLs, and JSON.</p><div class=\"callout callout-info\"><p>Base64 is by far the most commonly used encoding. You encounter it in email attachments (MIME), data URIs, JSON Web Tokens (JWT), HTTP Basic authentication, and embedded images in CSS/HTML.</p></div>"
    },
    {
      "id": "base64",
      "number": "2",
      "title": "Base64 Encoding",
      "content": "<p>Base64 encoding groups input bytes into 24-bit blocks (3 bytes), then splits each block into four 6-bit groups. Each 6-bit value indexes into the Base64 alphabet to produce a printable character.</p><div class=\"code-block\"><div class=\"code-block-title\">Base64 Alphabet</div><pre>Value  Char   Value  Char   Value  Char   Value  Char\n  0    A       16    Q       32    g       48    w\n  1    B       17    R       33    h       49    x\n  2    C       18    S       34    i       50    y\n  3    D       19    T       35    j       51    z\n  4    E       20    U       36    k       52    0\n  5    F       21    V       37    l       53    1\n  ...  ...     ...   ...     ...   ...     ...   ...\n 25    Z       41    p       51    z       63    /\n                                        (pad)   =</pre></div><div class=\"code-block\"><div class=\"code-block-title\">Encoding Example: \"Man\"</div><pre>Text:    M           a           n\nASCII:   77          97          110\nBinary:  01001101    01100001    01101110\n\n6-bit:   010011  010110  000101  101110\nValue:   19      22      5       46\nBase64:  T       W       F       u\n\nResult: \"Man\" -> \"TWFu\"</pre></div>"
    },
    {
      "id": "base32",
      "number": "3",
      "title": "Base32 Encoding",
      "content": "<p>Base32 uses a 32-character alphabet (A-Z and 2-7) and groups data into 5-bit chunks. It is less space-efficient than Base64 but uses only uppercase letters and digits, making it suitable for case-insensitive contexts.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Property</div><div class=\"comparison-col\">Base64</div><div class=\"comparison-col\">Base32</div><div class=\"comparison-col\">Base16</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Bits per char</div><div class=\"comparison-col\">6</div><div class=\"comparison-col\">5</div><div class=\"comparison-col\">4</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Expansion ratio</div><div class=\"comparison-col\">4:3 (33%)</div><div class=\"comparison-col\">8:5 (60%)</div><div class=\"comparison-col\">2:1 (100%)</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Alphabet size</div><div class=\"comparison-col\">64</div><div class=\"comparison-col\">32</div><div class=\"comparison-col\">16</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Case sensitive</div><div class=\"comparison-col\">Yes</div><div class=\"comparison-col\">No</div><div class=\"comparison-col\">No</div></div></div>"
    },
    {
      "id": "base16",
      "number": "4",
      "title": "Base16 (Hex) Encoding",
      "content": "<p>Base16 uses the hexadecimal digits 0-9 and A-F. Each byte is represented by exactly two hex characters. While it doubles the data size, it provides direct byte-level inspection.</p><div class=\"code-block\"><div class=\"code-block-title\">Base16 Examples</div><pre>\"Hello\" -> 48656C6C6F\n\"Man\"   -> 4D616E\n\\x00    -> 00\n\\xff    -> FF</pre></div><div class=\"callout callout-note\"><p>Base16 is commonly used for displaying cryptographic hashes (SHA-256, MD5), MAC addresses (00:1A:2B:3C:4D:5E), and debugging binary protocols. It is case-insensitive per this specification.</p></div>"
    },
    {
      "id": "padding",
      "number": "5",
      "title": "Padding",
      "content": "<p>When the input length is not evenly divisible by the group size, padding characters (=) are appended to the output.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Base64, 0 remaining</span><span class=\"field-table-val\">No padding needed</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Base64, 1 remaining</span><span class=\"field-table-val\">Two = characters appended</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Base64, 2 remaining</span><span class=\"field-table-val\">One = character appended</span></div></div><div class=\"code-block\"><div class=\"code-block-title\">Padding Examples</div><pre>\"Man\"    -> \"TWFu\"     (3 bytes = no padding)\n\"Ma\"     -> \"TWE=\"     (2 bytes = 1 pad)\n\"M\"      -> \"TQ==\"     (1 byte  = 2 pads)</pre></div>"
    },
    {
      "id": "url-safe",
      "number": "6",
      "title": "URL-Safe Base64 Variant",
      "content": "<p>The standard Base64 alphabet includes + and / which have special meaning in URLs. The URL-safe variant (base64url) replaces these characters.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">+ replaced by -</span><span class=\"field-detail\">Plus sign is replaced with hyphen/minus</span><span class=\"field-size\">Index 62</span></div><div class=\"field-item\"><span class=\"field-name\">/ replaced by _</span><span class=\"field-detail\">Forward slash is replaced with underscore</span><span class=\"field-size\">Index 63</span></div></div><div class=\"callout callout-info\"><p>The base64url encoding is required by several modern standards including JSON Web Tokens (JWT/JWS/JWE), OAuth 2.0 PKCE, and data URIs. Padding may be omitted in contexts where the data length is known.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Freed, N. and N. Borenstein, \"MIME Part One\", RFC 2045, November 1996."
    },
    {
      "number": "[2]",
      "text": "Jones, M., \"JSON Web Signature (JWS)\", RFC 7515, May 2015."
    },
    {
      "number": "[3]",
      "text": "Myers, J., \"SASL PLAIN Mechanism\", RFC 2595, June 1999."
    }
  ]
},

{
  "number": 8259,
  "title": "The JavaScript Object Notation (JSON) Data Interchange Format",
  "shortTitle": "JSON",
  "authors": [
    "T. Bray"
  ],
  "organization": "Textuality",
  "date": "December 2017",
  "status": "Internet Standard",
  "category": "data",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The lightweight data interchange format that powers the modern web",
    "color": "yellow",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "{ \"key\": \"value\" }",
        "[ 1, 2, 3 ]",
        "\"string\"",
        "true / false / null"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>JSON (JavaScript Object Notation) is a lightweight, text-based data interchange format derived from the JavaScript programming language. Despite its origins, JSON is language-independent and is supported natively by virtually every programming language.</p><div class=\"callout callout-info\"><p>JSON has become the dominant data format for web APIs, configuration files, and data storage. Its simplicity and readability make it the preferred choice over XML for most modern applications.</p></div>"
    },
    {
      "id": "json-grammar",
      "number": "2",
      "title": "JSON Grammar",
      "content": "<p>A JSON text is a serialized value. The grammar is extremely simple, consisting of just six structural characters and three literal names.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">{ }</span><span class=\"field-table-val\">Begin and end object</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">[ ]</span><span class=\"field-table-val\">Begin and end array</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">:</span><span class=\"field-table-val\">Name/value separator (in objects)</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">,</span><span class=\"field-table-val\">Value separator (between elements)</span></div></div><div class=\"callout callout-note\"><p>JSON text MUST be encoded in UTF-8. Implementations MUST NOT add a byte order mark (BOM). The encoding was a subject of debate across earlier JSON RFCs but was definitively settled as UTF-8 only in this specification.</p></div>"
    },
    {
      "id": "values",
      "number": "3",
      "title": "Values",
      "content": "<p>A JSON value MUST be one of exactly seven types. No other value types are permitted.</p><div class=\"opcode-grid\"><div class=\"opcode-card\"><span class=\"opcode-highlight\">object</span><span>Unordered collection of name/value pairs: {\"key\": \"value\"}</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">array</span><span>Ordered sequence of values: [1, \"two\", true]</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">string</span><span>Sequence of Unicode characters: \"hello world\"</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">number</span><span>Integer or floating-point: 42, 3.14, -1, 2.5e10</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">true</span><span>Boolean true literal</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">false</span><span>Boolean false literal</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">null</span><span>Represents empty/absent value</span></div></div>"
    },
    {
      "id": "objects",
      "number": "4",
      "title": "Objects",
      "content": "<p>An object is an unordered collection of zero or more name/value pairs, where names are strings. Object names SHOULD be unique within an object.</p><div class=\"code-block\"><div class=\"code-block-title\">JSON Object Example</div><pre>{\n  \"name\": \"RFC 8259\",\n  \"title\": \"JSON Data Interchange Format\",\n  \"year\": 2017,\n  \"authors\": [\"T. Bray\"],\n  \"isStandard\": true,\n  \"obsoletedBy\": null\n}</pre></div><div class=\"callout callout-warning\"><p>While the specification says names SHOULD be unique, behavior with duplicate names is undefined. Different parsers may take the first value, last value, or reject the document entirely. Implementations SHOULD NOT produce objects with duplicate names.</p></div>"
    },
    {
      "id": "arrays",
      "number": "5",
      "title": "Arrays",
      "content": "<p>An array is an ordered sequence of zero or more values. Array elements do not need to be of the same type.</p><div class=\"code-block\"><div class=\"code-block-title\">JSON Array Examples</div><pre>// Homogeneous array\n[1, 2, 3, 4, 5]\n\n// Heterogeneous array\n[\"hello\", 42, true, null, {\"key\": \"val\"}]\n\n// Nested arrays\n[[1, 2], [3, 4], [5, 6]]\n\n// Empty array\n[]</pre></div>"
    },
    {
      "id": "strings",
      "number": "6",
      "title": "Strings",
      "content": "<p>A string is a sequence of zero or more Unicode characters, wrapped in double quotes. Several characters must be escaped using a backslash.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">\\\"</span><span class=\"field-detail\">Quotation mark</span><span class=\"field-size\">U+0022</span></div><div class=\"field-item\"><span class=\"field-name\">\\\\</span><span class=\"field-detail\">Reverse solidus (backslash)</span><span class=\"field-size\">U+005C</span></div><div class=\"field-item\"><span class=\"field-name\">\\n</span><span class=\"field-detail\">Newline (line feed)</span><span class=\"field-size\">U+000A</span></div><div class=\"field-item\"><span class=\"field-name\">\\t</span><span class=\"field-detail\">Horizontal tab</span><span class=\"field-size\">U+0009</span></div><div class=\"field-item\"><span class=\"field-name\">\\uXXXX</span><span class=\"field-detail\">Unicode escape sequence</span><span class=\"field-size\">Any BMP char</span></div></div><div class=\"callout callout-note\"><p>JSON strings MUST use double quotes. Single quotes are not valid JSON. Characters outside the Basic Multilingual Plane (like emoji) must be encoded as a UTF-16 surrogate pair using two \\uXXXX escapes.</p></div>"
    },
    {
      "id": "numbers",
      "number": "7",
      "title": "Numbers",
      "content": "<p>JSON numbers follow a decimal format. Leading zeros are not permitted (except in 0.x notation), and special values like NaN and Infinity are not valid JSON.</p><div class=\"code-block\"><div class=\"code-block-title\">Valid JSON Numbers</div><pre>42          // integer\n-17         // negative\n3.14159     // decimal\n2.998e8     // scientific notation\n-1.6e-19    // negative with exponent\n0           // zero</pre></div><div class=\"callout callout-warning\"><p>JSON does not distinguish between integers and floating-point numbers. Implementations that use IEEE 754 double-precision (like JavaScript) can only represent integers exactly up to 2^53. For larger numbers, use strings instead.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Bray, T., \"The JavaScript Object Notation (JSON) Data Interchange Format\", RFC 7159, March 2014."
    },
    {
      "number": "[2]",
      "text": "Crockford, D., \"The application/json Media Type for JavaScript Object Notation (JSON)\", RFC 4627, July 2006."
    },
    {
      "number": "[3]",
      "text": "ECMA International, \"Standard ECMA-404: The JSON Data Interchange Syntax\", 2nd Edition, December 2017."
    }
  ]
},

{
  "number": 1149,
  "title": "A Standard for the Transmission of IP Datagrams on Avian Carriers",
  "shortTitle": "IP over Avian Carriers",
  "authors": [
    "D. Waitzman"
  ],
  "organization": "BBN STC",
  "date": "April 1 1990",
  "status": "Experimental",
  "category": "meta",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The legendary April Fools' RFC - IP datagrams carried by homing pigeons",
    "color": "pink",
    "animation": "packet-flow",
    "animationData": {
      "topNode": {
        "icon": "A",
        "label": "Source",
        "detail": "Sender rooftop"
      },
      "bottomNode": {
        "icon": "B",
        "label": "Destination",
        "detail": "Receiver rooftop"
      },
      "reqLabel": "Carrier Pigeon",
      "repLabel": "Return Pigeon"
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>Published on April 1st, 1990, RFC 1149 is one of the most beloved documents in Internet history. It specifies a method for transmitting IP datagrams using homing pigeons as the physical carrier medium.</p><div class=\"callout callout-info\"><p>While written as humor, RFC 1149 is a legitimate document in the RFC series. It was even implemented and tested on April 28, 2001, by the Bergen Linux User Group in Norway, achieving a 55% packet loss rate and round-trip times of 3000-6000 seconds.</p></div>"
    },
    {
      "id": "overview",
      "number": "2",
      "title": "Overview",
      "content": "<p>Avian carriers can provide high delay, low throughput, and low altitude service. The connection topology is limited to a single point-to-point path for each carrier, used with standard carriers, but many carriers can be used without significant interference with each other, outside of early spring.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Bandwidth</div><div class=\"key-point-text\">Depends on the weight capacity of the carrier and the storage medium. A pigeon carrying a microSD card could theoretically transfer terabytes per trip.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Latency</div><div class=\"key-point-text\">Homing pigeon speed averages 50 mph (80 km/h), giving a latency measured in hours for typical distances.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Packet Loss</div><div class=\"key-point-text\">Susceptible to hawks, cats, weather, and other environmental factors. The Bergen test recorded 55% packet loss.</div></div></div>"
    },
    {
      "id": "frame-format",
      "number": "3",
      "title": "Frame Format",
      "content": "<p>The IP datagram is printed on a small scroll of paper, in hexadecimal, with each octet separated by whitespace. The scroll of paper is wrapped around one leg of the avian carrier.</p><div class=\"code-block\"><div class=\"code-block-title\">Frame Format</div><pre>The IP datagram is printed, on a small scroll\nof paper, in hexadecimal, with each octet\nseparated by whitestuff and blackstuff.\n\nThe scroll of paper is wrapped around one\nleg of the avian carrier.\n\nA band of strapping tape is used to secure\nthe datagram's edges.</pre></div><div class=\"callout callout-note\"><p>Multiple scrolls may be carried by multiple avian carriers for load balancing. However, out-of-order delivery is common and the upper-layer protocols must handle reassembly.</p></div>"
    },
    {
      "id": "implementation",
      "number": "4",
      "title": "Implementation",
      "content": "<p>The specification addresses several practical implementation concerns for deploying IP over avian carrier networks.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">MTU</span><span class=\"field-table-val\">256 milligrams (limited by carrier leg size)</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Typical Speed</span><span class=\"field-table-val\">Strstrfly (variable)</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Storms</span><span class=\"field-table-val\">Can cause data loss; weatherproofing recommended</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Wstrm Strm</span><span class=\"field-table-val\">Strstrp can be provided for straps</span></div></div><div class=\"callout callout-warning\"><p>Audit trails are automatically generated by the carriers, though interpretation requires ornithological expertise. Intrusion detection is provided by the carriers' natural territorial instincts.</p></div>"
    },
    {
      "id": "quality-of-service",
      "number": "5",
      "title": "Quality of Service",
      "content": "<p>Quality of service considerations for avian carrier networks differ significantly from traditional electronic networks.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Metric</div><div class=\"comparison-col\">Avian Carriers</div><div class=\"comparison-col\">Ethernet</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Latency</div><div class=\"comparison-col\">Hours to days</div><div class=\"comparison-col\">Microseconds</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Bandwidth</div><div class=\"comparison-col\">High (if using microSD)</div><div class=\"comparison-col\">1-100 Gbps</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Packet Loss</div><div class=\"comparison-col\">~55% (tested)</div><div class=\"comparison-col\">&lt; 0.01%</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Jitter</div><div class=\"comparison-col\">Very high (wind-dependent)</div><div class=\"comparison-col\">Very low</div></div></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Waitzman, D., \"IP over Avian Carriers with Quality of Service\", RFC 2549, April 1999."
    },
    {
      "number": "[2]",
      "text": "Carpenter, B., \"Avian IP Network\", Bergen Linux User Group, April 2001."
    },
    {
      "number": "[3]",
      "text": "Postel, J., \"Internet Protocol\", RFC 791, September 1981."
    }
  ]
},

{
  "number": 1958,
  "title": "Architectural Principles of the Internet",
  "shortTitle": "Architectural Principles",
  "authors": [
    "B. Carpenter"
  ],
  "organization": "CERN",
  "date": "June 1996",
  "status": "Informational",
  "category": "meta",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The foundational design philosophy behind the Internet's architecture",
    "color": "blue",
    "animation": "layers",
    "animationData": {
      "layers": [
        {
          "name": "Application",
          "detail": "End-to-end logic",
          "highlight": false
        },
        {
          "name": "Transport",
          "detail": "Reliability",
          "highlight": false
        },
        {
          "name": "Network",
          "detail": "Packet switching",
          "highlight": true
        },
        {
          "name": "Link",
          "detail": "Connectivity",
          "highlight": false
        },
        {
          "name": "Physical",
          "detail": "Transmission",
          "highlight": false
        }
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>This document describes the fundamental architectural principles that guided the design of the Internet. These principles explain why the Internet works the way it does and provide guidance for future protocol design.</p><div class=\"callout callout-info\"><p>Understanding these principles is essential for anyone designing Internet protocols or distributed systems. They represent decades of collective wisdom about building scalable, resilient networked systems.</p></div>"
    },
    {
      "id": "principles",
      "number": "2",
      "title": "Core Principles",
      "content": "<div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Packet Switching</div><div class=\"key-point-text\">The Internet is fundamentally a packet-switched network, not circuit-switched. Resources are shared statistically, enabling more efficient utilization and graceful degradation.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Fate Sharing</div><div class=\"key-point-text\">State should be kept at the endpoints, not in the network. If a node fails, only the connections using that node are affected, not the entire network.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Heterogeneity Support</div><div class=\"key-point-text\">The architecture must support a wide variety of link technologies, from carrier pigeons to fiber optics, without requiring modification.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Autonomous Design</div><div class=\"key-point-text\">There is no single controlling entity. The Internet is a voluntary cooperation of independently managed networks.</div></div></div>"
    },
    {
      "id": "end-to-end",
      "number": "3",
      "title": "The End-to-End Argument",
      "content": "<p>Perhaps the most important principle: functions should be implemented at the endpoints of a communication, not in the intermediary network nodes. The network should be kept simple and general-purpose.</p><div class=\"callout callout-note\"><p>\"In general, the network should provide a general transport service, and specific features should be implemented at the endpoints.\" This principle argues against building application-specific features into the network infrastructure.</p></div><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Endpoint Function</div><div class=\"comparison-col\">Network Function</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Error correction</div><div class=\"comparison-col\">Best-effort delivery</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Flow control</div><div class=\"comparison-col\">Routing</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Encryption</div><div class=\"comparison-col\">Forwarding</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Application logic</div><div class=\"comparison-col\">Addressing</div></div></div>"
    },
    {
      "id": "simplicity",
      "number": "4",
      "title": "Simplicity and Generality",
      "content": "<p>The Internet architecture values simplicity and generality. Protocols should be designed to be as simple as possible while still meeting requirements.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Postel's Law</div><div class=\"key-point-text\">\"Be liberal in what you accept, and conservative in what you send.\" - Jon Postel. This robustness principle has been fundamental to Internet interoperability.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Minimal Design</div><div class=\"key-point-text\">Keep it simple. When in doubt, leave it out. Features that are not strictly necessary add complexity and potential failure modes.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Protocol Independence</div><div class=\"key-point-text\">Each protocol layer should be independent. Changes at one layer should not require changes at another.</div></div></div>"
    },
    {
      "id": "layering",
      "number": "5",
      "title": "Layering",
      "content": "<p>The Internet protocol suite follows a layered architecture. Each layer provides services to the layer above and uses services from the layer below.</p><div class=\"field-list\"><div class=\"field-item\"><span class=\"field-name\">Application</span><span class=\"field-detail\">HTTP, DNS, SMTP, SSH - end-user protocols</span><span class=\"field-size\">Layer 7</span></div><div class=\"field-item\"><span class=\"field-name\">Transport</span><span class=\"field-detail\">TCP, UDP - end-to-end communication</span><span class=\"field-size\">Layer 4</span></div><div class=\"field-item\"><span class=\"field-name\">Internet</span><span class=\"field-detail\">IP - addressing and routing across networks</span><span class=\"field-size\">Layer 3</span></div><div class=\"field-item\"><span class=\"field-name\">Link</span><span class=\"field-detail\">Ethernet, Wi-Fi - local network delivery</span><span class=\"field-size\">Layer 2</span></div></div><div class=\"callout callout-warning\"><p>While layering is a useful conceptual model, strict layering is sometimes violated for performance reasons (e.g., TCP checksum covers application data). The Internet architecture is more pragmatic than the OSI model.</p></div>"
    },
    {
      "id": "connectivity",
      "number": "6",
      "title": "Universal Connectivity",
      "content": "<p>The Internet was designed to provide universal connectivity - any host should be able to communicate with any other host. This principle has been eroded by NAT and firewalls but remains an architectural goal.</p><div class=\"callout callout-warning\"><p>Network Address Translation (NAT), while solving the IPv4 address exhaustion problem, fundamentally violates the end-to-end principle and universal connectivity. IPv6 was designed to restore these properties by providing sufficient address space for every device.</p></div><p>The tension between universal connectivity and security continues to shape Internet architecture. Modern approaches like IPv6, STUN/TURN, and ICE attempt to balance reachability with protection.</p>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Saltzer, J.H., Reed, D.P., Clark, D.D., \"End-To-End Arguments in System Design\", ACM TOCS, November 1984."
    },
    {
      "number": "[2]",
      "text": "Clark, D., \"The Design Philosophy of the DARPA Internet Protocols\", ACM SIGCOMM, 1988."
    },
    {
      "number": "[3]",
      "text": "Carpenter, B., \"Internet Transparency\", RFC 2775, February 2000."
    }
  ]
},

{
  "number": 2119,
  "title": "Key words for use in RFCs to Indicate Requirement Levels",
  "shortTitle": "MUST/SHOULD/MAY",
  "authors": [
    "S. Bradner"
  ],
  "organization": "Harvard University",
  "date": "March 1997",
  "status": "Best Current Practice",
  "category": "meta",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Defining the precise meaning of MUST, SHOULD, MAY and other requirement keywords",
    "color": "red",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "MUST - absolute requirement",
        "SHOULD - recommended",
        "MAY - truly optional",
        "MUST NOT - absolute prohibition"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>In many standards track documents, several words are used to signify the requirements in the specification. These words are often capitalized. This document defines these words as they should be interpreted in IETF documents.</p><div class=\"callout callout-info\"><p>RFC 2119 is one of the most referenced documents in the entire RFC series. Nearly every Internet Standard includes the phrase: \"The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in RFC 2119.\"</p></div>"
    },
    {
      "id": "definitions",
      "number": "2",
      "title": "Keyword Definitions",
      "content": "<div class=\"opcode-grid\"><div class=\"opcode-card\"><span class=\"opcode-highlight\">MUST</span><span>An absolute requirement of the specification. Synonyms: REQUIRED, SHALL.</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">MUST NOT</span><span>An absolute prohibition. The definition is NOT permitted under any circumstances. Synonym: SHALL NOT.</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">SHOULD</span><span>There may exist valid reasons to ignore, but implications must be understood and carefully weighed. Synonym: RECOMMENDED.</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">SHOULD NOT</span><span>There may exist valid reasons when behavior is acceptable, but implications should be understood. Synonym: NOT RECOMMENDED.</span></div><div class=\"opcode-card\"><span class=\"opcode-highlight\">MAY</span><span>An item is truly optional. One implementation may include it while another may omit it. Synonym: OPTIONAL.</span></div></div>"
    },
    {
      "id": "guidance",
      "number": "3",
      "title": "Guidance for Use",
      "content": "<p>Authors must exercise care in using these terms. They should only be used where actually required for interoperation or to limit behavior which has potential for causing harm.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">MUST and Interop</div><div class=\"key-point-text\">MUST is used only when non-compliance would break interoperability. Overusing MUST creates unnecessarily rigid specifications that are hard to implement.</div></div><div class=\"key-point\"><div class=\"key-point-title\">SHOULD and Judgment</div><div class=\"key-point-text\">SHOULD allows implementors to exercise judgment. For example, \"the value SHOULD be cached\" permits implementations that lack caching capability.</div></div><div class=\"key-point\"><div class=\"key-point-title\">MAY and Optional Features</div><div class=\"key-point-text\">When MAY is used, other implementations MUST be prepared to interoperate with implementations that do or do not include the optional feature.</div></div></div><div class=\"callout callout-warning\"><p>A common mistake is using MUST when SHOULD is appropriate. If a requirement cannot always be met in practice, SHOULD is the correct keyword. MUST implies that non-compliance is never acceptable.</p></div>"
    },
    {
      "id": "usage-in-rfcs",
      "number": "4",
      "title": "Usage in RFCs",
      "content": "<p>RFC 2119 keywords are recognized only when they appear in ALL CAPITALS. The lowercase forms of these words carry their normal English meaning.</p><div class=\"code-block\"><div class=\"code-block-title\">Example Usage</div><pre>Correct (RFC 2119 meaning):\n\"Implementations MUST support UTF-8 encoding.\"\n\"The server SHOULD include a Date header.\"\n\"Clients MAY cache the response.\"\n\nNormal English (no RFC 2119 meaning):\n\"This must be considered carefully.\"\n\"Implementations should work well.\"\n\"You may find this useful.\"</pre></div><div class=\"callout callout-note\"><p>RFC 8174 later clarified that the keywords have RFC 2119 meaning only when they are in ALL CAPITALS. This addressed confusion about mixed-case usage like \"Must\" or \"must\".</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Leiba, B., \"Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words\", RFC 8174, May 2017."
    },
    {
      "number": "[2]",
      "text": "Bradner, S., \"The Internet Standards Process -- Revision 3\", RFC 2026, October 1996."
    }
  ]
},

{
  "number": 2549,
  "title": "IP over Avian Carriers with Quality of Service",
  "shortTitle": "Avian Carriers QoS",
  "authors": [
    "D. Waitzman"
  ],
  "organization": "IronBridge Networks",
  "date": "April 1 1999",
  "status": "Informational",
  "category": "meta",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Extending IP over Avian Carriers with Quality of Service mechanisms",
    "color": "pink",
    "animation": "packet-flow",
    "animationData": {
      "topNode": {
        "icon": "A",
        "label": "Source",
        "detail": "Priority queuing"
      },
      "bottomNode": {
        "icon": "B",
        "label": "Destination",
        "detail": "QoS-aware"
      },
      "reqLabel": "Priority Pigeon",
      "repLabel": "ACK Pigeon"
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>This memo amends RFC 1149 to allow for Quality of Service information to be included in datagrams transported on avian carriers. This is a follow-up April Fools' RFC that extends the original with modern networking concepts applied to pigeons.</p><div class=\"callout callout-info\"><p>Published on April 1, 1999, exactly nine years after RFC 1149, this document humorously applies Differentiated Services (DiffServ) and integrated services concepts to carrier pigeon networks.</p></div>"
    },
    {
      "id": "improvements",
      "number": "2",
      "title": "Improvements over RFC 1149",
      "content": "<p>The original RFC 1149 specification did not address quality of service, congestion control, or multiple service classes. RFC 2549 adds these capabilities.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Service Classes</div><div class=\"key-point-text\">Traffic can be classified into different priority levels, with premium carriers (well-trained, experienced pigeons) handling high-priority traffic.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Congestion Control</div><div class=\"key-point-text\">When too many pigeons are launched simultaneously, mid-air collisions may occur. Proper spacing and traffic shaping are essential.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Error Detection</div><div class=\"key-point-text\">Physical inspection of the carrier upon arrival can detect transit damage. Waterproofing provides protection against weather-induced errors.</div></div></div>"
    },
    {
      "id": "quality-of-service",
      "number": "3",
      "title": "Quality of Service",
      "content": "<p>QoS for avian carriers is achieved through careful selection and training of carriers, route optimization, and weather monitoring.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Premium Service</span><span class=\"field-table-val\">Well-rested, champion racing pigeons with GPS tracking</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Standard Service</span><span class=\"field-table-val\">Regular homing pigeons, best-effort delivery</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Bulk Service</span><span class=\"field-table-val\">Any available bird, including non-homing species (unreliable)</span></div></div><div class=\"callout callout-note\"><p>The Differentiated Services Code Point (DSCP) is encoded using colored leg bands. Red indicates Expedited Forwarding, blue indicates Assured Forwarding, and no band indicates Best Effort.</p></div>"
    },
    {
      "id": "mstrstrps",
      "number": "4",
      "title": "The MstrStrpS Field",
      "content": "<p>The Master Strap Security field provides authentication and integrity checking for avian carrier datagrams.</p><div class=\"code-block\"><div class=\"code-block-title\">MstrStrpS Security Levels</div><pre>Level 0: No security (no strap)\nLevel 1: Simple strap (tamper-evident tape)\nLevel 2: Sealed capsule (weather-resistant)\nLevel 3: GPS-tracked capsule with biometric lock</pre></div><div class=\"callout callout-warning\"><p>Security considerations note that avian carriers are vulnerable to man-in-the-middle attacks by hawks, cats, and other predators. End-to-end encryption is strongly recommended for all sensitive datagrams.</p></div>"
    },
    {
      "id": "frame-format",
      "number": "5",
      "title": "Updated Frame Format",
      "content": "<p>The frame format extends RFC 1149 with additional fields for QoS marking, security classification, and carrier health indicators.</p><div class=\"packet-diagram\"><div class=\"packet-diagram-title\">Extended Avian Carrier Frame</div><pre class=\"packet-ascii\">+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|  QoS Class  |  Security Lvl  |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|        Carrier ID             |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|    IP Datagram (on scroll)    |\n|          (variable)           |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|       Checksum (visual)       |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Feature</div><div class=\"comparison-col\">RFC 1149</div><div class=\"comparison-col\">RFC 2549</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">QoS Support</div><div class=\"comparison-col\">None</div><div class=\"comparison-col\">3 service classes</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Security</div><div class=\"comparison-col\">None</div><div class=\"comparison-col\">4 security levels</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">Tracking</div><div class=\"comparison-col\">None</div><div class=\"comparison-col\">GPS optional</div></div></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Waitzman, D., \"Transmission of IP Datagrams on Avian Carriers\", RFC 1149, April 1990."
    },
    {
      "number": "[2]",
      "text": "Nichols, K., et al., \"Definition of the Differentiated Services Field\", RFC 2474, December 1998."
    },
    {
      "number": "[3]",
      "text": "Braden, R., et al., \"Integrated Services in the Internet Architecture\", RFC 1633, June 1994."
    }
  ]
},

{
  "number": 6585,
  "title": "Additional HTTP Status Codes",
  "shortTitle": "HTTP Status 428/429/431/511",
  "authors": [
    "M. Nottingham",
    "R. Fielding"
  ],
  "organization": "Akamai / Adobe",
  "date": "April 2012",
  "status": "Proposed Standard",
  "category": "meta",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "Introducing 429 Too Many Requests and other essential HTTP status codes",
    "color": "orange",
    "animation": "data-format",
    "animationData": {
      "lines": [
        "428 Precondition Required",
        "429 Too Many Requests",
        "431 Request Header Fields Too Large",
        "511 Network Authentication Required"
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>This document specifies additional HTTP status codes for common situations that are not well served by existing codes. These codes have become essential for modern web APIs and infrastructure.</p><div class=\"callout callout-info\"><p>The 429 Too Many Requests status code has become one of the most important additions to HTTP, enabling standardized rate limiting across APIs worldwide. Before this RFC, APIs used various non-standard approaches to communicate rate limits.</p></div>"
    },
    {
      "id": "428-precondition",
      "number": "2",
      "title": "428 Precondition Required",
      "content": "<p>The 428 status code indicates that the origin server requires the request to be conditional. This is used to prevent the \"lost update\" problem, where concurrent modifications can overwrite each other.</p><div class=\"code-block\"><div class=\"code-block-title\">428 Precondition Required Example</div><pre>Client request (missing If-Match):\nPUT /resource HTTP/1.1\nHost: example.com\nContent-Type: application/json\n\n{\"name\": \"updated\"}\n\nServer response:\nHTTP/1.1 428 Precondition Required\nContent-Type: application/json\n\n{\"error\": \"If-Match header required for PUT\"}</pre></div><div class=\"callout callout-note\"><p>This differs from 412 Precondition Failed. A 412 means a precondition was present but evaluated to false. A 428 means a precondition was required but not present at all.</p></div>"
    },
    {
      "id": "429-too-many",
      "number": "3",
      "title": "429 Too Many Requests",
      "content": "<p>The 429 status code indicates that the user has sent too many requests in a given amount of time (\"rate limiting\"). The response SHOULD include a Retry-After header indicating how long to wait.</p><div class=\"code-block\"><div class=\"code-block-title\">429 Too Many Requests Example</div><pre>HTTP/1.1 429 Too Many Requests\nContent-Type: application/json\nRetry-After: 60\n\n{\n  \"error\": \"Rate limit exceeded\",\n  \"limit\": 100,\n  \"remaining\": 0,\n  \"reset\": 1609459200\n}</pre></div><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Rate Limiting</div><div class=\"key-point-text\">APIs use 429 to enforce request quotas. Common patterns include per-second, per-minute, and per-day limits based on API key or IP address.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Retry-After</div><div class=\"key-point-text\">The Retry-After header tells the client when it can retry. It can specify seconds or an HTTP date. Clients SHOULD honor this value.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Scope</div><div class=\"key-point-text\">The rate limit may apply to the user, API key, IP address, or any other classification. The response body can provide details.</div></div></div>"
    },
    {
      "id": "431-headers",
      "number": "4",
      "title": "431 Request Header Fields Too Large",
      "content": "<p>The 431 status code indicates that the server is unwilling to process the request because its header fields are too large. This can apply to the total size of all headers or a single header field.</p><div class=\"field-table\"><div class=\"field-table-row\"><span class=\"field-table-name\">Common Cause</span><span class=\"field-table-val\">Oversized cookies accumulating over time</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Server Limit</span><span class=\"field-table-val\">Typically 8 KB to 16 KB total header size</span></div><div class=\"field-table-row\"><span class=\"field-table-name\">Recovery</span><span class=\"field-table-val\">Client should clear cookies or reduce header payload</span></div></div><div class=\"callout callout-warning\"><p>This is a common issue with applications that set many cookies. Each request includes all matching cookies, and the cumulative size can exceed server limits. Clearing cookies for the domain typically resolves the issue.</p></div>"
    },
    {
      "id": "511-network-auth",
      "number": "5",
      "title": "511 Network Authentication Required",
      "content": "<p>The 511 status code indicates that the client needs to authenticate to gain network access. This is used by captive portals in hotels, airports, and other public Wi-Fi networks.</p><div class=\"code-block\"><div class=\"code-block-title\">511 Captive Portal Response</div><pre>HTTP/1.1 511 Network Authentication Required\nContent-Type: text/html\n\n&lt;html&gt;\n  &lt;head&gt;&lt;title&gt;Network Login Required&lt;/title&gt;&lt;/head&gt;\n  &lt;body&gt;\n    &lt;p&gt;You must &lt;a href=\"https://login.example.net/\"&gt;\n    log in&lt;/a&gt; to access the network.&lt;/p&gt;\n  &lt;/body&gt;\n&lt;/html&gt;</pre></div><div class=\"callout callout-note\"><p>The 511 status was specifically designed for captive portals, replacing the previous practice of using 302 redirects or injecting content into HTTP responses. It helps clients distinguish between a legitimate server response and network-level authentication requirements.</p></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Fielding, R., et al., \"Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content\", RFC 7231, June 2014."
    },
    {
      "number": "[2]",
      "text": "Fielding, R. and J. Reschke, \"HTTP/1.1 Conditional Requests\", RFC 7232, June 2014."
    },
    {
      "number": "[3]",
      "text": "Nottingham, M., \"HTTP Header Field Registrations\", RFC 7240, June 2014."
    }
  ]
},

{
  "number": 7235,
  "title": "Hypertext Transfer Protocol (HTTP/1.1): Authentication",
  "shortTitle": "HTTP Authentication",
  "authors": [
    "R. Fielding",
    "J. Reschke"
  ],
  "organization": "Adobe / greenbytes",
  "date": "June 2014",
  "status": "Proposed Standard",
  "category": "meta",
  "featured": true,
  "obsoletedBy": null,
  "obsoletes": null,
  "hero": {
    "subtitle": "The challenge-response authentication framework for HTTP",
    "color": "green",
    "animation": "handshake",
    "animationData": {
      "leftLabel": "Client",
      "rightLabel": "Server",
      "steps": [
        {
          "label": "Request",
          "from": "left",
          "description": "GET /protected/resource"
        },
        {
          "label": "401 Unauthorized",
          "from": "right",
          "description": "WWW-Authenticate: Basic realm=\"Example\""
        },
        {
          "label": "Authorization",
          "from": "left",
          "description": "Authorization: Basic dXNlcjpwYXNz"
        },
        {
          "label": "200 OK",
          "from": "right",
          "description": "Access granted with content"
        }
      ]
    }
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>HTTP provides a general framework for access control and authentication via an extensible set of challenge-response authentication schemes. This document defines the HTTP Authentication framework, including the 401 and 407 status codes and the Authorization and Proxy-Authorization header fields.</p><div class=\"callout callout-info\"><p>This RFC defines the framework, not individual authentication schemes. Specific schemes like Basic (RFC 7617), Digest (RFC 7616), and Bearer (RFC 6750) are defined separately and plug into this framework.</p></div>"
    },
    {
      "id": "auth-framework",
      "number": "2",
      "title": "Authentication Framework",
      "content": "<p>HTTP authentication is based on a simple challenge-response model. The server challenges the client with a 401 (Unauthorized) response, and the client retries with credentials in the Authorization header.</p><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Challenge</div><div class=\"key-point-text\">The server issues a challenge via the WWW-Authenticate header, specifying one or more authentication schemes it supports.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Credentials</div><div class=\"key-point-text\">The client sends credentials via the Authorization header. The format depends on the authentication scheme (Basic, Bearer, Digest, etc.).</div></div><div class=\"key-point\"><div class=\"key-point-title\">Realm</div><div class=\"key-point-text\">The realm parameter defines a protection space. Different realms on the same server may require different credentials.</div></div></div>"
    },
    {
      "id": "401-407",
      "number": "3",
      "title": "401 and 407 Responses",
      "content": "<p>Two status codes drive the authentication mechanism, one for origin servers and one for proxies.</p><div class=\"comparison-table\"><div class=\"comparison-header\"><div class=\"comparison-col\">Status</div><div class=\"comparison-col\">Challenge Header</div><div class=\"comparison-col\">Credentials Header</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">401 Unauthorized</div><div class=\"comparison-col\">WWW-Authenticate</div><div class=\"comparison-col\">Authorization</div></div><div class=\"comparison-row\"><div class=\"comparison-col\">407 Proxy Auth Required</div><div class=\"comparison-col\">Proxy-Authenticate</div><div class=\"comparison-col\">Proxy-Authorization</div></div></div><div class=\"callout callout-note\"><p>A 401 response MUST include a WWW-Authenticate header containing at least one challenge. Without this header, the client cannot determine which authentication scheme to use.</p></div>"
    },
    {
      "id": "authorization-header",
      "number": "4",
      "title": "Authorization Header",
      "content": "<p>The Authorization header field allows a client to authenticate itself with an origin server. Its value consists of the authentication scheme followed by scheme-specific credentials.</p><div class=\"code-block\"><div class=\"code-block-title\">Authorization Header Examples</div><pre>Basic authentication (base64 encoded user:password):\nAuthorization: Basic dXNlcjpwYXNzd29yZA==\n\nBearer token (OAuth 2.0):\nAuthorization: Bearer eyJhbGciOiJIUzI1NiIs...\n\nDigest authentication:\nAuthorization: Digest username=\"user\",\nrealm=\"example.com\",\nnonce=\"dcd98b...\",\nresponse=\"6629fae...\"</pre></div><div class=\"callout callout-warning\"><p>Basic authentication transmits credentials in base64, which is trivially decoded. It MUST only be used over HTTPS. Bearer tokens provide better security but must also be protected in transit.</p></div>"
    },
    {
      "id": "www-authenticate",
      "number": "5",
      "title": "WWW-Authenticate Header",
      "content": "<p>The WWW-Authenticate header field indicates the authentication scheme(s) and parameters applicable to the target resource. A server MAY include multiple challenges.</p><div class=\"code-block\"><div class=\"code-block-title\">WWW-Authenticate Examples</div><pre>Single scheme:\nWWW-Authenticate: Basic realm=\"Simple API\"\n\nMultiple schemes:\nWWW-Authenticate: Bearer realm=\"api\",\nerror=\"invalid_token\"\nWWW-Authenticate: Basic realm=\"api\"\n\nNegotiate (SPNEGO/Kerberos):\nWWW-Authenticate: Negotiate</pre></div><div class=\"key-points\"><div class=\"key-point\"><div class=\"key-point-title\">Scheme Selection</div><div class=\"key-point-text\">When multiple schemes are offered, the client should choose the most secure scheme it supports. Browsers typically prefer Negotiate over Digest over Basic.</div></div><div class=\"key-point\"><div class=\"key-point-title\">Protection Spaces</div><div class=\"key-point-text\">The realm parameter defines a protection space on the server. The client can reuse credentials for the same realm without waiting for another challenge.</div></div></div>"
    }
  ],
  "references": [
    {
      "number": "[1]",
      "text": "Reschke, J., \"The 'Basic' HTTP Authentication Scheme\", RFC 7617, September 2015."
    },
    {
      "number": "[2]",
      "text": "Shafranovich, Y., et al., \"The 'Digest' HTTP Authentication Scheme\", RFC 7616, September 2015."
    },
    {
      "number": "[3]",
      "text": "Jones, M. and D. Hardt, \"The OAuth 2.0 Authorization Framework: Bearer Token Usage\", RFC 6750, October 2012."
    }
  ]
},

{
  "number": 894,
  "title": "A Standard for the Transmission of IP Datagrams over Ethernet Networks",
  "shortTitle": "IP over Ethernet",
  "authors": [
    "C. Hornig"
  ],
  "organization": "",
  "date": "April 1984",
  "status": "Internet Standard",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1025,
  "title": "TCP and IP Bake Off",
  "shortTitle": "TCP/IP Bake Off",
  "authors": [
    "J. Postel"
  ],
  "organization": "",
  "date": "September 1987",
  "status": "Informational",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1071,
  "title": "Computing the Internet Checksum",
  "shortTitle": "Internet Checksum",
  "authors": [
    "R. Braden",
    "D. Borman",
    "C. Partridge"
  ],
  "organization": "",
  "date": "September 1988",
  "status": "Informational",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1191,
  "title": "Path MTU Discovery",
  "shortTitle": "Path MTU Discovery",
  "authors": [
    "J. Mogul",
    "S. Deering"
  ],
  "organization": "",
  "date": "November 1990",
  "status": "Internet Standard",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1812,
  "title": "Requirements for IP Version 4 Routers",
  "shortTitle": "IPv4 Router Requirements",
  "authors": [
    "F. Baker"
  ],
  "organization": "",
  "date": "June 1995",
  "status": "Internet Standard",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4443,
  "title": "Internet Control Message Protocol (ICMPv6) for IPv6 Specification",
  "shortTitle": "ICMPv6",
  "authors": [
    "A. Conta",
    "S. Deering",
    "M. Gupta"
  ],
  "organization": "",
  "date": "March 2006",
  "status": "Internet Standard",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6335,
  "title": "Internet Assigned Numbers Authority (IANA) Procedures for the Management of the Service Name and Transport Protocol Port Number Registry",
  "shortTitle": "Service Name/Port Registry",
  "authors": [
    "M. Cotton",
    "L. Eggert",
    "J. Touch",
    "M. Westerlund",
    "S. Cheshire"
  ],
  "organization": "",
  "date": "August 2011",
  "status": "Best Current Practice",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8200,
  "title": "Internet Protocol, Version 6 (IPv6) Specification",
  "shortTitle": "IPv6 (Updated)",
  "authors": [
    "S. Deering",
    "R. Hinden"
  ],
  "organization": "",
  "date": "July 2017",
  "status": "Internet Standard",
  "category": "core",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1183,
  "title": "New DNS RR Definitions",
  "shortTitle": "DNS RR Types",
  "authors": [
    "C. Everhart",
    "L. Mamakos",
    "R. Ullmann",
    "P. Mockapetris"
  ],
  "organization": "",
  "date": "October 1990",
  "status": "Experimental",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1886,
  "title": "DNS Extensions to Support IP Version 6",
  "shortTitle": "DNS IPv6 Extensions",
  "authors": [
    "S. Thomson",
    "C. Huitema"
  ],
  "organization": "",
  "date": "December 1995",
  "status": "Historic",
  "category": "dns",
  "featured": false,
  "obsoletedBy": "RFC 3596",
  "obsoletes": null
},

{
  "number": 2136,
  "title": "Dynamic Updates in the Domain Name System (DNS UPDATE)",
  "shortTitle": "Dynamic DNS",
  "authors": [
    "P. Vixie",
    "S. Thomson",
    "Y. Rekhter",
    "J. Bound"
  ],
  "organization": "",
  "date": "April 1997",
  "status": "Proposed Standard",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2181,
  "title": "Clarifications to the DNS Specification",
  "shortTitle": "DNS Clarifications",
  "authors": [
    "R. Elz",
    "R. Bush"
  ],
  "organization": "",
  "date": "July 1997",
  "status": "Proposed Standard",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3596,
  "title": "DNS Extensions to Support IP Version 6",
  "shortTitle": "DNS AAAA Record",
  "authors": [
    "S. Thomson",
    "C. Huitema",
    "V. Ksinant",
    "M. Souissi"
  ],
  "organization": "",
  "date": "October 2003",
  "status": "Internet Standard",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4033,
  "title": "DNS Security Introduction and Requirements",
  "shortTitle": "DNSSEC Introduction",
  "authors": [
    "R. Arends",
    "R. Austein",
    "M. Larson",
    "D. Massey",
    "S. Rose"
  ],
  "organization": "",
  "date": "March 2005",
  "status": "Proposed Standard",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4034,
  "title": "Resource Records for the DNS Security Extensions",
  "shortTitle": "DNSSEC Resource Records",
  "authors": [
    "R. Arends",
    "R. Austein",
    "M. Larson",
    "D. Massey",
    "S. Rose"
  ],
  "organization": "",
  "date": "March 2005",
  "status": "Proposed Standard",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6891,
  "title": "Extension Mechanisms for DNS (EDNS(0))",
  "shortTitle": "EDNS(0)",
  "authors": [
    "J. Damas",
    "M. Graff",
    "P. Vixie"
  ],
  "organization": "",
  "date": "April 2013",
  "status": "Internet Standard",
  "category": "dns",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2817,
  "title": "Upgrading to TLS Within HTTP/1.1",
  "shortTitle": "HTTP Upgrade to TLS",
  "authors": [
    "R. Khare",
    "S. Lawrence"
  ],
  "organization": "",
  "date": "May 2000",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6265,
  "title": "HTTP State Management Mechanism",
  "shortTitle": "HTTP Cookies",
  "authors": [
    "A. Barth"
  ],
  "organization": "",
  "date": "April 2011",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6266,
  "title": "Use of the Content-Disposition Header Field in the Hypertext Transfer Protocol (HTTP)",
  "shortTitle": "Content-Disposition",
  "authors": [
    "J. Reschke"
  ],
  "organization": "",
  "date": "June 2011",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7230,
  "title": "Hypertext Transfer Protocol (HTTP/1.1): Message Syntax and Routing",
  "shortTitle": "HTTP/1.1 Message Syntax",
  "authors": [
    "R. Fielding",
    "J. Reschke"
  ],
  "organization": "",
  "date": "June 2014",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7231,
  "title": "Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content",
  "shortTitle": "HTTP/1.1 Semantics",
  "authors": [
    "R. Fielding",
    "J. Reschke"
  ],
  "organization": "",
  "date": "June 2014",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7232,
  "title": "Hypertext Transfer Protocol (HTTP/1.1): Conditional Requests",
  "shortTitle": "HTTP Conditional Requests",
  "authors": [
    "R. Fielding",
    "J. Reschke"
  ],
  "organization": "",
  "date": "June 2014",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7234,
  "title": "Hypertext Transfer Protocol (HTTP/1.1): Caching",
  "shortTitle": "HTTP Caching",
  "authors": [
    "R. Fielding",
    "M. Nottingham",
    "J. Reschke"
  ],
  "organization": "",
  "date": "June 2014",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8188,
  "title": "Encrypted Content-Encoding for HTTP",
  "shortTitle": "Encrypted Content-Encoding",
  "authors": [
    "M. Thomson"
  ],
  "organization": "",
  "date": "June 2017",
  "status": "Proposed Standard",
  "category": "http",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2104,
  "title": "HMAC: Keyed-Hashing for Message Authentication",
  "shortTitle": "HMAC",
  "authors": [
    "H. Krawczyk",
    "M. Bellare",
    "R. Canetti"
  ],
  "organization": "",
  "date": "February 1997",
  "status": "Informational",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3447,
  "title": "Public-Key Cryptography Standards (PKCS) #1: RSA Cryptography Specifications Version 2.1",
  "shortTitle": "RSA Cryptography",
  "authors": [
    "J. Jonsson",
    "B. Kaliski"
  ],
  "organization": "",
  "date": "February 2003",
  "status": "Informational",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4346,
  "title": "The Transport Layer Security (TLS) Protocol Version 1.1",
  "shortTitle": "TLS 1.1",
  "authors": [
    "T. Dierks",
    "E. Rescorla"
  ],
  "organization": "",
  "date": "April 2006",
  "status": "Historic",
  "category": "security",
  "featured": false,
  "obsoletedBy": "RFC 5246",
  "obsoletes": null
},

{
  "number": 4422,
  "title": "Simple Authentication and Security Layer (SASL)",
  "shortTitle": "SASL",
  "authors": [
    "A. Melnikov",
    "K. Zeilenga"
  ],
  "organization": "",
  "date": "June 2006",
  "status": "Proposed Standard",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 5869,
  "title": "HMAC-based Extract-and-Expand Key Derivation Function (HKDF)",
  "shortTitle": "HKDF",
  "authors": [
    "H. Krawczyk",
    "P. Eronen"
  ],
  "organization": "",
  "date": "May 2010",
  "status": "Informational",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6125,
  "title": "Representation and Verification of Domain-Based Application Service Identity within Internet PKI Using X.509 Certificates",
  "shortTitle": "TLS Server Identity",
  "authors": [
    "P. Saint-Andre",
    "J. Hodges"
  ],
  "organization": "",
  "date": "March 2011",
  "status": "Proposed Standard",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6797,
  "title": "HTTP Strict Transport Security (HSTS)",
  "shortTitle": "HSTS",
  "authors": [
    "J. Hodges",
    "C. Jackson",
    "A. Barth"
  ],
  "organization": "",
  "date": "November 2012",
  "status": "Proposed Standard",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7469,
  "title": "Public Key Pinning Extension for HTTP",
  "shortTitle": "HTTP Public Key Pinning",
  "authors": [
    "C. Evans",
    "C. Palmer",
    "R. Sleevi"
  ],
  "organization": "",
  "date": "April 2015",
  "status": "Proposed Standard",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7518,
  "title": "JSON Web Algorithms (JWA)",
  "shortTitle": "JWA",
  "authors": [
    "M. Jones"
  ],
  "organization": "",
  "date": "May 2015",
  "status": "Proposed Standard",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7636,
  "title": "Proof Key for Code Exchange by OAuth Public Clients",
  "shortTitle": "PKCE",
  "authors": [
    "N. Sakimura",
    "J. Bradley",
    "N. Agarwal"
  ],
  "organization": "",
  "date": "September 2015",
  "status": "Proposed Standard",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8032,
  "title": "Edwards-Curve Digital Signature Algorithm (EdDSA)",
  "shortTitle": "EdDSA",
  "authors": [
    "S. Josefsson",
    "I. Liusvaara"
  ],
  "organization": "",
  "date": "January 2017",
  "status": "Informational",
  "category": "security",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2045,
  "title": "Multipurpose Internet Mail Extensions (MIME) Part One: Format of Internet Message Bodies",
  "shortTitle": "MIME Part 1",
  "authors": [
    "N. Freed",
    "N. Borenstein"
  ],
  "organization": "",
  "date": "November 1996",
  "status": "Internet Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2046,
  "title": "Multipurpose Internet Mail Extensions (MIME) Part Two: Media Types",
  "shortTitle": "MIME Part 2 - Media Types",
  "authors": [
    "N. Freed",
    "N. Borenstein"
  ],
  "organization": "",
  "date": "November 1996",
  "status": "Internet Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2047,
  "title": "Multipurpose Internet Mail Extensions (MIME) Part Three: Message Header Extensions for Non-ASCII Text",
  "shortTitle": "MIME Part 3 - Headers",
  "authors": [
    "K. Moore"
  ],
  "organization": "",
  "date": "November 1996",
  "status": "Internet Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2049,
  "title": "Multipurpose Internet Mail Extensions (MIME) Part Five: Conformance Criteria and Examples",
  "shortTitle": "MIME Part 5 - Conformance",
  "authors": [
    "N. Freed",
    "N. Borenstein"
  ],
  "organization": "",
  "date": "November 1996",
  "status": "Internet Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2821,
  "title": "Simple Mail Transfer Protocol",
  "shortTitle": "SMTP",
  "authors": [
    "J. Klensin"
  ],
  "organization": "",
  "date": "April 2001",
  "status": "Proposed Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": "RFC 5321",
  "obsoletes": null
},

{
  "number": 6376,
  "title": "DomainKeys Identified Mail (DKIM) Signatures",
  "shortTitle": "DKIM",
  "authors": [
    "D. Crocker",
    "T. Hansen",
    "M. Kucherawy"
  ],
  "organization": "",
  "date": "September 2011",
  "status": "Internet Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7208,
  "title": "Sender Policy Framework (SPF) for Authorizing Use of Domains in Email, Version 1",
  "shortTitle": "SPF",
  "authors": [
    "S. Kitterman"
  ],
  "organization": "",
  "date": "April 2014",
  "status": "Proposed Standard",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7489,
  "title": "Domain-based Message Authentication, Reporting, and Conformance (DMARC)",
  "shortTitle": "DMARC",
  "authors": [
    "M. Kucherawy",
    "E. Zwicky"
  ],
  "organization": "",
  "date": "March 2015",
  "status": "Informational",
  "category": "email",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1058,
  "title": "Routing Information Protocol",
  "shortTitle": "RIP",
  "authors": [
    "C. Hedrick"
  ],
  "organization": "",
  "date": "June 1988",
  "status": "Historic",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1772,
  "title": "Application of the Border Gateway Protocol in the Internet",
  "shortTitle": "BGP Application",
  "authors": [
    "Y. Rekhter",
    "P. Gross"
  ],
  "organization": "",
  "date": "March 1995",
  "status": "Internet Standard",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2453,
  "title": "RIP Version 2",
  "shortTitle": "RIPv2",
  "authors": [
    "G. Malkin"
  ],
  "organization": "",
  "date": "November 1998",
  "status": "Internet Standard",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3031,
  "title": "Multiprotocol Label Switching Architecture",
  "shortTitle": "MPLS",
  "authors": [
    "E. Rosen",
    "A. Viswanathan",
    "R. Callon"
  ],
  "organization": "",
  "date": "January 2001",
  "status": "Proposed Standard",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4456,
  "title": "BGP Route Reflection: An Alternative to Full Mesh Internal BGP (IBGP)",
  "shortTitle": "BGP Route Reflection",
  "authors": [
    "T. Bates",
    "E. Chen",
    "R. Chandra"
  ],
  "organization": "",
  "date": "April 2006",
  "status": "Internet Standard",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6126,
  "title": "The Babel Routing Protocol",
  "shortTitle": "Babel",
  "authors": [
    "J. Chroboczek"
  ],
  "organization": "",
  "date": "April 2011",
  "status": "Experimental",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7348,
  "title": "Virtual eXtensible Local Area Network (VXLAN): A Framework for Overlaying Virtualized Layer 2 Networks over Layer 3 Networks",
  "shortTitle": "VXLAN",
  "authors": [
    "M. Mahalingam",
    "D. Dutt",
    "K. Duda",
    "P. Agarwal",
    "L. Kreeger",
    "T. Sridhar",
    "M. Bursell",
    "C. Wright"
  ],
  "organization": "",
  "date": "August 2014",
  "status": "Informational",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7938,
  "title": "Use of BGP for Routing in Large-Scale Data Centers",
  "shortTitle": "Data Center BGP",
  "authors": [
    "P. Lapukhov",
    "A. Premji",
    "J. Mitchell"
  ],
  "organization": "",
  "date": "August 2016",
  "status": "Informational",
  "category": "routing",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1939,
  "title": "Post Office Protocol - Version 3",
  "shortTitle": "POP3",
  "authors": [
    "J. Myers",
    "M. Rose"
  ],
  "organization": "",
  "date": "May 1996",
  "status": "Internet Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2617,
  "title": "HTTP Authentication: Basic and Digest Access Authentication",
  "shortTitle": "HTTP Basic/Digest Auth",
  "authors": [
    "J. Franks",
    "P. Hallam-Baker",
    "J. Hostetler",
    "S. Lawrence",
    "P. Leach",
    "A. Luotonen",
    "L. Stewart"
  ],
  "organization": "",
  "date": "June 1999",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3501,
  "title": "Internet Message Access Protocol - Version 4rev1",
  "shortTitle": "IMAP4",
  "authors": [
    "M. Crispin"
  ],
  "organization": "",
  "date": "March 2003",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4251,
  "title": "The Secure Shell (SSH) Protocol Architecture",
  "shortTitle": "SSH Architecture",
  "authors": [
    "T. Ylonen",
    "C. Lonvick"
  ],
  "organization": "",
  "date": "January 2006",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 5389,
  "title": "Session Traversal Utilities for NAT (STUN)",
  "shortTitle": "STUN",
  "authors": [
    "J. Rosenberg",
    "R. Mahy",
    "P. Matthews",
    "D. Wing"
  ],
  "organization": "",
  "date": "October 2008",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 5766,
  "title": "Traversal Using Relays around NAT (TURN): Relay Extensions to Session Traversal Utilities for NAT (STUN)",
  "shortTitle": "TURN",
  "authors": [
    "R. Mahy",
    "P. Matthews",
    "J. Rosenberg"
  ],
  "organization": "",
  "date": "April 2010",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6120,
  "title": "Extensible Messaging and Presence Protocol (XMPP): Core",
  "shortTitle": "XMPP Core",
  "authors": [
    "P. Saint-Andre"
  ],
  "organization": "",
  "date": "March 2011",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7252,
  "title": "The Constrained Application Protocol (CoAP)",
  "shortTitle": "CoAP",
  "authors": [
    "Z. Shelby",
    "K. Hartke",
    "C. Bormann"
  ],
  "organization": "",
  "date": "June 2014",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7858,
  "title": "Specification for DNS over Transport Layer Security (DNS over TLS)",
  "shortTitle": "DNS over TLS",
  "authors": [
    "Z. Hu",
    "L. Zhu",
    "J. Heidemann",
    "A. Mankin",
    "D. Wessels",
    "P. Hoffman"
  ],
  "organization": "",
  "date": "May 2016",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8484,
  "title": "DNS Queries over HTTPS (DoH)",
  "shortTitle": "DNS over HTTPS",
  "authors": [
    "P. Hoffman",
    "P. McManus"
  ],
  "organization": "",
  "date": "October 2018",
  "status": "Proposed Standard",
  "category": "applications",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1323,
  "title": "TCP Extensions for High Performance",
  "shortTitle": "TCP Extensions",
  "authors": [
    "V. Jacobson",
    "R. Braden",
    "D. Borman"
  ],
  "organization": "",
  "date": "May 1992",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2474,
  "title": "Definition of the Differentiated Services Field (DS Field) in the IPv4 and IPv6 Headers",
  "shortTitle": "DiffServ",
  "authors": [
    "K. Nichols",
    "S. Blake",
    "F. Baker",
    "D. Black"
  ],
  "organization": "",
  "date": "December 1998",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3022,
  "title": "Traditional IP Network Address Translator (Traditional NAT)",
  "shortTitle": "NAT",
  "authors": [
    "P. Srisuresh",
    "K. Egevang"
  ],
  "organization": "",
  "date": "January 2001",
  "status": "Informational",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3339,
  "title": "Date and Time on the Internet: Timestamps",
  "shortTitle": "Internet Timestamps",
  "authors": [
    "G. Klyne",
    "C. Newman"
  ],
  "organization": "",
  "date": "July 2002",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4330,
  "title": "Simple Network Time Protocol (SNTP) Version 4 for IPv4, IPv6 and OSI",
  "shortTitle": "SNTPv4",
  "authors": [
    "D. Mills"
  ],
  "organization": "",
  "date": "January 2006",
  "status": "Informational",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 5905,
  "title": "Network Time Protocol Version 4: Protocol and Algorithms Specification",
  "shortTitle": "NTPv4",
  "authors": [
    "D. Mills",
    "J. Martin",
    "J. Burbank",
    "W. Kasch"
  ],
  "organization": "",
  "date": "June 2010",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6241,
  "title": "Network Configuration Protocol (NETCONF)",
  "shortTitle": "NETCONF",
  "authors": [
    "R. Enns",
    "M. Bjorklund",
    "J. Schoenwaelder",
    "A. Bierman"
  ],
  "organization": "",
  "date": "June 2011",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7011,
  "title": "Specification of the IP Flow Information Export (IPFIX) Protocol for the Exchange of Flow Information",
  "shortTitle": "IPFIX",
  "authors": [
    "B. Claise",
    "B. Trammell",
    "P. Aitken"
  ],
  "organization": "",
  "date": "September 2013",
  "status": "Internet Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7047,
  "title": "The Open vSwitch Database Management Protocol",
  "shortTitle": "OVSDB",
  "authors": [
    "B. Pfaff",
    "B. Davie"
  ],
  "organization": "",
  "date": "December 2013",
  "status": "Informational",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8040,
  "title": "RESTCONF Protocol",
  "shortTitle": "RESTCONF",
  "authors": [
    "A. Bierman",
    "M. Bjorklund",
    "K. Watsen"
  ],
  "organization": "",
  "date": "January 2017",
  "status": "Proposed Standard",
  "category": "infrastructure",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2397,
  "title": "The \"data\" URL scheme",
  "shortTitle": "Data URLs",
  "authors": [
    "L. Masinter"
  ],
  "organization": "",
  "date": "August 1998",
  "status": "Proposed Standard",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4180,
  "title": "Common Format and MIME Type for Comma-Separated Values (CSV) Files",
  "shortTitle": "CSV",
  "authors": [
    "Y. Shafranovich"
  ],
  "organization": "",
  "date": "October 2005",
  "status": "Informational",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 4627,
  "title": "The application/json Media Type for JavaScript Object Notation (JSON)",
  "shortTitle": "JSON Media Type",
  "authors": [
    "D. Crockford"
  ],
  "organization": "",
  "date": "July 2006",
  "status": "Informational",
  "category": "data",
  "featured": false,
  "obsoletedBy": "RFC 7159",
  "obsoletes": null
},

{
  "number": 5234,
  "title": "Augmented BNF for Syntax Specifications: ABNF",
  "shortTitle": "ABNF",
  "authors": [
    "D. Crocker",
    "P. Overell"
  ],
  "organization": "",
  "date": "January 2008",
  "status": "Internet Standard",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6570,
  "title": "URI Template",
  "shortTitle": "URI Templates",
  "authors": [
    "J. Gregorio",
    "R. Fielding",
    "M. Hadley",
    "M. Nottingham",
    "D. Orchard"
  ],
  "organization": "",
  "date": "March 2012",
  "status": "Proposed Standard",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6838,
  "title": "Media Type Specifications and Registration Procedures",
  "shortTitle": "Media Type Registration",
  "authors": [
    "N. Freed",
    "J. Klensin",
    "T. Hansen"
  ],
  "organization": "",
  "date": "January 2013",
  "status": "Best Current Practice",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7049,
  "title": "Concise Binary Object Representation (CBOR)",
  "shortTitle": "CBOR",
  "authors": [
    "C. Bormann",
    "P. Hoffman"
  ],
  "organization": "",
  "date": "October 2013",
  "status": "Proposed Standard",
  "category": "data",
  "featured": false,
  "obsoletedBy": "RFC 8949",
  "obsoletes": null
},

{
  "number": 7320,
  "title": "URI Design and Ownership",
  "shortTitle": "URI Design",
  "authors": [
    "M. Nottingham"
  ],
  "organization": "",
  "date": "July 2014",
  "status": "Best Current Practice",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7807,
  "title": "Problem Details for HTTP APIs",
  "shortTitle": "Problem Details",
  "authors": [
    "M. Nottingham",
    "E. Wilde"
  ],
  "organization": "",
  "date": "March 2016",
  "status": "Proposed Standard",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8949,
  "title": "Concise Binary Object Representation (CBOR)",
  "shortTitle": "CBOR (Updated)",
  "authors": [
    "C. Bormann",
    "P. Hoffman"
  ],
  "organization": "",
  "date": "December 2020",
  "status": "Internet Standard",
  "category": "data",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 1796,
  "title": "Not All RFCs are Standards",
  "shortTitle": "Not All RFCs are Standards",
  "authors": [
    "C. Huitema",
    "J. Postel",
    "S. Crocker"
  ],
  "organization": "",
  "date": "April 1995",
  "status": "Informational",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2026,
  "title": "The Internet Standards Process -- Revision 3",
  "shortTitle": "Internet Standards Process",
  "authors": [
    "S. Bradner"
  ],
  "organization": "",
  "date": "October 1996",
  "status": "Best Current Practice",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 2555,
  "title": "30 Years of RFCs",
  "shortTitle": "30 Years of RFCs",
  "authors": [
    "RFC Editor"
  ],
  "organization": "",
  "date": "April 1999",
  "status": "Informational",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 3552,
  "title": "Guidelines for Writing RFC Text on Security Considerations",
  "shortTitle": "Security Considerations Guide",
  "authors": [
    "E. Rescorla",
    "B. Korver"
  ],
  "organization": "",
  "date": "July 2003",
  "status": "Best Current Practice",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 5000,
  "title": "Internet Official Protocol Standards",
  "shortTitle": "Protocol Standards",
  "authors": [
    "RFC Editor"
  ],
  "organization": "",
  "date": "May 2008",
  "status": "Historic",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 6648,
  "title": "Deprecating the \"X-\" Prefix and Similar Constructs in Application Protocols",
  "shortTitle": "X- Prefix Deprecation",
  "authors": [
    "P. Saint-Andre",
    "D. Crocker",
    "M. Nottingham"
  ],
  "organization": "",
  "date": "June 2012",
  "status": "Best Current Practice",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 7282,
  "title": "On Consensus and Humming in the IETF",
  "shortTitle": "Rough Consensus",
  "authors": [
    "P. Resnick"
  ],
  "organization": "",
  "date": "June 2014",
  "status": "Informational",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
},

{
  "number": 8174,
  "title": "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words",
  "shortTitle": "RFC 2119 Clarification",
  "authors": [
    "B. Leiba"
  ],
  "organization": "",
  "date": "May 2017",
  "status": "Best Current Practice",
  "category": "meta",
  "featured": false,
  "obsoletedBy": null,
  "obsoletes": null
}

);
