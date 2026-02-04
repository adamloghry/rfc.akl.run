window.RFC_DATA = window.RFC_DATA || [];
window.RFC_DATA.push(

// ============================================================
// SECURITY RFCs
// ============================================================

{
  number: 2818,
  title: 'HTTP Over TLS',
  shortTitle: 'HTTPS',
  authors: ['E. Rescorla'],
  organization: 'RTFM, Inc.',
  date: 'May 2000',
  status: 'Informational',
  category: 'security',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Securing the web by layering HTTP over TLS, establishing the foundation for all secure web communication.',
    color: 'green',
    animation: 'lock',
    animationData: {
      steps: ['Client connects on port 443', 'TLS handshake negotiated', 'Server certificate verified', 'Encrypted HTTP begins']
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>HTTP Over TLS (commonly known as HTTPS) provides a mechanism for securing HTTP connections using TLS (Transport Layer Security). This is the cornerstone of web security, enabling encrypted communication between browsers and servers.</p><div class="callout callout-info"><p>HTTPS is simply HTTP layered on top of TLS/SSL. The protocol itself is not different from HTTP; it uses TLS to encrypt the entire HTTP conversation.</p></div><div class="key-points"><div class="key-point"><div class="key-point-title">Default Port</div><div class="key-point-text">HTTPS uses port 443 instead of HTTP\'s port 80</div></div><div class="key-point"><div class="key-point-title">URI Scheme</div><div class="key-point-text">URLs use the https:// scheme identifier</div></div></div>'
    },
    {
      id: 'connection-initiation',
      number: '2',
      title: 'Connection Initiation',
      content: '<p>The client initiates a TLS connection to the server on port 443. Once the TLS handshake is complete, the client sends its first HTTP request. All HTTP data is sent as TLS application data.</p><div class="comparison-table"><div class="comparison-header"><div class="comparison-col">HTTP</div><div class="comparison-col">HTTPS</div></div><div class="comparison-row"><div class="comparison-col">Port 80</div><div class="comparison-col">Port 443</div></div><div class="comparison-row"><div class="comparison-col">Plaintext</div><div class="comparison-col">Encrypted</div></div><div class="comparison-row"><div class="comparison-col">http:// scheme</div><div class="comparison-col">https:// scheme</div></div></div>'
    },
    {
      id: 'endpoint-identification',
      number: '3',
      title: 'Endpoint Identification',
      content: '<p>The client must verify the server\'s identity using the certificate presented during the TLS handshake. The hostname in the URI must match the identity in the server\'s certificate.</p><div class="callout callout-warning"><p>If the hostname does not match the certificate, the client MUST either notify the user or terminate the connection. This prevents man-in-the-middle attacks.</p></div><p>Certificate matching rules:</p><div class="field-list"><div class="field-item"><span class="field-name">dNSName</span><span class="field-detail">Match against the hostname using wildcard rules</span></div><div class="field-item"><span class="field-name">iPAddress</span><span class="field-detail">Match against the host IP if connecting by IP</span></div><div class="field-item"><span class="field-name">Common Name</span><span class="field-detail">Legacy fallback if no SubjectAltName extension</span></div></div>'
    },
    {
      id: 'references-and-impact',
      number: '4',
      title: 'Impact on the Modern Web',
      content: '<p>HTTPS has become the de facto standard for all web communication. Major browsers now flag HTTP sites as "Not Secure," and search engines prioritize HTTPS sites in rankings.</p><div class="key-points"><div class="key-point"><div class="key-point-title">Let\'s Encrypt</div><div class="key-point-text">Free, automated certificates have driven HTTPS adoption to over 95% of web traffic</div></div><div class="key-point"><div class="key-point-title">HSTS</div><div class="key-point-text">HTTP Strict Transport Security (RFC 6797) forces HTTPS-only connections</div></div><div class="key-point"><div class="key-point-title">Mixed Content</div><div class="key-point-text">Browsers block insecure resources loaded on HTTPS pages</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Rescorla, E., "HTTP Over TLS", RFC 2818, May 2000.' },
    { number: '[2]', text: 'Dierks, T. and C. Allen, "The TLS Protocol Version 1.0", RFC 2246, January 1999.' },
    { number: '[3]', text: 'Fielding, R., et al., "Hypertext Transfer Protocol -- HTTP/1.1", RFC 2616, June 1999.' }
  ]
},

{
  number: 5246,
  title: 'The Transport Layer Security (TLS) Protocol Version 1.2',
  shortTitle: 'TLS 1.2',
  authors: ['T. Dierks', 'E. Rescorla'],
  organization: 'Independent / RTFM, Inc.',
  date: 'August 2008',
  status: 'Proposed Standard',
  category: 'security',
  featured: true,
  obsoletedBy: 'RFC 8446 (TLS 1.3)',
  obsoletes: 'RFC 4346',
  hero: {
    subtitle: 'The cryptographic protocol that secured the internet for a decade, providing privacy and data integrity between applications.',
    color: 'blue',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client',
      rightLabel: 'Server',
      steps: [
        { label: 'ClientHello', from: 'left', description: 'Supported ciphers & random' },
        { label: 'ServerHello', from: 'right', description: 'Chosen cipher & certificate' },
        { label: 'Key Exchange', from: 'left', description: 'Pre-master secret' },
        { label: 'Finished', from: 'right', description: 'Encrypted communication begins' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>TLS 1.2 provides communication security over the Internet. The protocol allows client/server applications to communicate in a way that is designed to prevent eavesdropping, tampering, or message forgery.</p><div class="callout callout-info"><p>TLS 1.2 was the dominant secure transport protocol from 2008 until TLS 1.3 was standardized in 2018. It remains widely deployed and supported.</p></div>'
    },
    {
      id: 'handshake-protocol',
      number: '2',
      title: 'Handshake Protocol',
      content: '<p>The TLS handshake negotiates security parameters, authenticates the server (and optionally the client), and establishes shared keys for encryption.</p><div class="field-list"><div class="field-item"><span class="field-name">ClientHello</span><span class="field-detail">Client sends supported protocol versions, cipher suites, and a random value</span></div><div class="field-item"><span class="field-name">ServerHello</span><span class="field-detail">Server selects the cipher suite and sends its certificate</span></div><div class="field-item"><span class="field-name">ServerKeyExchange</span><span class="field-detail">Additional key material for DHE/ECDHE cipher suites</span></div><div class="field-item"><span class="field-name">ClientKeyExchange</span><span class="field-detail">Client sends pre-master secret (encrypted with server\'s public key)</span></div><div class="field-item"><span class="field-name">ChangeCipherSpec</span><span class="field-detail">Both sides switch to the negotiated encryption</span></div><div class="field-item"><span class="field-name">Finished</span><span class="field-detail">Verification that the handshake was not tampered with</span></div></div>'
    },
    {
      id: 'record-protocol',
      number: '3',
      title: 'Record Protocol',
      content: '<p>The TLS Record Protocol takes messages to be transmitted, fragments the data into manageable blocks, optionally compresses, applies a MAC, encrypts, and transmits the result.</p><div class="packet-diagram"><div class="packet-diagram-title">TLS Record Format</div><pre class="packet-ascii">+------+------+------+----------+\n| Type | Ver  | Len  | Fragment |\n| (1)  | (2)  | (2)  | (varies) |\n+------+------+------+----------+</pre></div><div class="field-table"><div class="field-table-row"><span class="field-table-name">Content Type</span><span class="field-table-val">handshake(22), application_data(23), alert(21), change_cipher_spec(20)</span></div><div class="field-table-row"><span class="field-table-name">Version</span><span class="field-table-val">TLS 1.2 = {3, 3}</span></div><div class="field-table-row"><span class="field-table-name">Length</span><span class="field-table-val">Max 2^14 bytes per record</span></div></div>'
    },
    {
      id: 'cipher-suites',
      number: '4',
      title: 'Cipher Suites',
      content: '<p>TLS 1.2 introduced support for SHA-256 as the default hash, authenticated encryption with AEAD cipher modes, and more flexible cipher suite negotiation.</p><div class="code-block"><div class="code-block-title">Common TLS 1.2 Cipher Suites</div><pre>TLS_RSA_WITH_AES_128_CBC_SHA256\nTLS_DHE_RSA_WITH_AES_128_GCM_SHA256\nTLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384\nTLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256</pre></div><div class="callout callout-note"><p>ECDHE cipher suites provide forward secrecy: compromising the server\'s long-term key does not compromise past session keys.</p></div>'
    },
    {
      id: 'security-considerations',
      number: '5',
      title: 'Security Considerations',
      content: '<div class="key-points"><div class="key-point"><div class="key-point-title">BEAST Attack</div><div class="key-point-text">CBC cipher vulnerability mitigated by 1/n-1 record splitting</div></div><div class="key-point"><div class="key-point-title">POODLE</div><div class="key-point-text">Padding oracle attack that led to disabling SSL 3.0 and CBC ciphers</div></div><div class="key-point"><div class="key-point-title">Lucky 13</div><div class="key-point-text">Timing attack on CBC mode MACs, mitigated in constant-time implementations</div></div><div class="key-point"><div class="key-point-title">Forward Secrecy</div><div class="key-point-text">ECDHE key exchange provides forward secrecy, now considered essential</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Dierks, T. and E. Rescorla, "The Transport Layer Security (TLS) Protocol Version 1.2", RFC 5246, August 2008.' },
    { number: '[2]', text: 'Dierks, T. and C. Allen, "The TLS Protocol Version 1.0", RFC 2246, January 1999.' },
    { number: '[3]', text: 'Rescorla, E., "The Transport Layer Security (TLS) Protocol Version 1.3", RFC 8446, August 2018.' }
  ]
},

{
  number: 5280,
  title: 'Internet X.509 Public Key Infrastructure Certificate and CRL Profile',
  shortTitle: 'X.509 Certificates',
  authors: ['D. Cooper', 'S. Santesson', 'S. Farrell', 'S. Boeyen', 'R. Housley', 'W. Polk'],
  organization: 'NIST / Microsoft / Trinity College Dublin',
  date: 'May 2008',
  status: 'Proposed Standard',
  category: 'security',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 3280',
  hero: {
    subtitle: 'The PKI framework that underpins digital trust on the Internet, defining the format for digital certificates used in TLS, code signing, and email security.',
    color: 'purple',
    animation: 'tree',
    animationData: {
      root: {
        label: 'Root CA',
        children: [
          {
            label: 'Intermediate CA',
            children: [
              { label: 'example.com', children: [] },
              { label: 'mail.example.com', children: [] }
            ]
          },
          {
            label: 'Intermediate CA 2',
            children: [
              { label: 'api.service.io', children: [] }
            ]
          }
        ]
      }
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>X.509 certificates bind a public key to an identity through a chain of trust. Certificate Authorities (CAs) issue and sign certificates, allowing relying parties to verify the identity of servers, clients, and other entities.</p><div class="callout callout-info"><p>Every HTTPS connection you make relies on X.509 certificates to verify you\'re talking to the intended server and not an impersonator.</p></div>'
    },
    {
      id: 'certificate-format',
      number: '2',
      title: 'Certificate Format',
      content: '<p>An X.509 v3 certificate contains several fields encoded in ASN.1 DER format:</p><div class="field-list"><div class="field-item"><span class="field-name">Version</span><span class="field-detail">v3 (value 2) for modern certificates</span></div><div class="field-item"><span class="field-name">Serial Number</span><span class="field-detail">Unique identifier assigned by the CA</span></div><div class="field-item"><span class="field-name">Signature Algorithm</span><span class="field-detail">Algorithm used by the CA to sign (e.g., sha256WithRSAEncryption)</span></div><div class="field-item"><span class="field-name">Issuer</span><span class="field-detail">Distinguished Name of the issuing CA</span></div><div class="field-item"><span class="field-name">Validity</span><span class="field-detail">notBefore and notAfter dates</span></div><div class="field-item"><span class="field-name">Subject</span><span class="field-detail">Distinguished Name of the certificate holder</span></div><div class="field-item"><span class="field-name">Subject Public Key Info</span><span class="field-detail">The public key and its algorithm</span></div><div class="field-item"><span class="field-name">Extensions</span><span class="field-detail">v3 extensions like Subject Alternative Name, Key Usage, etc.</span></div></div>'
    },
    {
      id: 'certificate-path-validation',
      number: '3',
      title: 'Certificate Path Validation',
      content: '<p>To verify a certificate, the relying party must build and validate a certification path from the end-entity certificate to a trusted root CA.</p><div class="key-points"><div class="key-point"><div class="key-point-title">Chain Building</div><div class="key-point-text">Follow issuer references from end-entity up to a trusted root</div></div><div class="key-point"><div class="key-point-title">Signature Verification</div><div class="key-point-text">Each certificate\'s signature is verified using the issuer\'s public key</div></div><div class="key-point"><div class="key-point-title">Validity Checking</div><div class="key-point-text">Current time must fall within each certificate\'s validity period</div></div><div class="key-point"><div class="key-point-title">Revocation Checking</div><div class="key-point-text">Check CRLs or OCSP responders for revoked certificates</div></div></div>'
    },
    {
      id: 'extensions',
      number: '4',
      title: 'Certificate Extensions',
      content: '<p>X.509 v3 extensions provide additional identity information and constraints:</p><div class="field-table"><div class="field-table-row"><span class="field-table-name">Subject Alternative Name</span><span class="field-table-val">DNS names, IPs, emails the cert covers</span></div><div class="field-table-row"><span class="field-table-name">Key Usage</span><span class="field-table-val">digitalSignature, keyEncipherment, etc.</span></div><div class="field-table-row"><span class="field-table-name">Extended Key Usage</span><span class="field-table-val">serverAuth, clientAuth, codeSigning</span></div><div class="field-table-row"><span class="field-table-name">Basic Constraints</span><span class="field-table-val">Whether this cert can act as a CA</span></div><div class="field-table-row"><span class="field-table-name">Authority Key Identifier</span><span class="field-table-val">Identifies the issuing CA\'s key</span></div><div class="field-table-row"><span class="field-table-name">CRL Distribution Points</span><span class="field-table-val">URLs for Certificate Revocation Lists</span></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Cooper, D., et al., "Internet X.509 Public Key Infrastructure Certificate and CRL Profile", RFC 5280, May 2008.' },
    { number: '[2]', text: 'Housley, R., et al., "Internet X.509 Public Key Infrastructure Certificate and CRL Profile", RFC 3280, April 2002.' }
  ]
},

{
  number: 6749,
  title: 'The OAuth 2.0 Authorization Framework',
  shortTitle: 'OAuth 2.0',
  authors: ['D. Hardt'],
  organization: 'Microsoft',
  date: 'October 2012',
  status: 'Proposed Standard',
  category: 'security',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The authorization framework that powers "Sign in with Google/GitHub/Facebook" and API access delegation across the modern web.',
    color: 'orange',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client App',
      rightLabel: 'Auth Server',
      steps: [
        { label: 'Authorization Request', from: 'left', description: 'Redirect user to auth server' },
        { label: 'User Grants Access', from: 'right', description: 'User authenticates & consents' },
        { label: 'Authorization Code', from: 'right', description: 'Redirect back with code' },
        { label: 'Token Request', from: 'left', description: 'Exchange code for access token' },
        { label: 'Access Token', from: 'right', description: 'Bearer token issued' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>OAuth 2.0 is an authorization framework that enables third-party applications to obtain limited access to an HTTP service on behalf of a resource owner. Rather than sharing credentials, users delegate access through access tokens.</p><div class="callout callout-info"><p>OAuth 2.0 is about authorization (what you can access), not authentication (who you are). OpenID Connect builds authentication on top of OAuth 2.0.</p></div>'
    },
    {
      id: 'roles',
      number: '2',
      title: 'Roles',
      content: '<p>OAuth 2.0 defines four roles:</p><div class="field-list"><div class="field-item"><span class="field-name">Resource Owner</span><span class="field-detail">The user who authorizes access to their account</span></div><div class="field-item"><span class="field-name">Client</span><span class="field-detail">The application requesting access on behalf of the user</span></div><div class="field-item"><span class="field-name">Authorization Server</span><span class="field-detail">Issues access tokens after authenticating the resource owner</span></div><div class="field-item"><span class="field-name">Resource Server</span><span class="field-detail">Hosts the protected resources, validates access tokens</span></div></div>'
    },
    {
      id: 'grant-types',
      number: '3',
      title: 'Grant Types',
      content: '<p>OAuth 2.0 defines several flows for obtaining access tokens, each suited to different application types:</p><div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Grant Type</div><div class="comparison-col">Use Case</div></div><div class="comparison-row"><div class="comparison-col">Authorization Code</div><div class="comparison-col">Web apps with a backend server (most secure)</div></div><div class="comparison-row"><div class="comparison-col">Implicit</div><div class="comparison-col">Browser-based SPAs (deprecated in favor of Auth Code + PKCE)</div></div><div class="comparison-row"><div class="comparison-col">Resource Owner Password</div><div class="comparison-col">Trusted first-party apps only (discouraged)</div></div><div class="comparison-row"><div class="comparison-col">Client Credentials</div><div class="comparison-col">Machine-to-machine API access</div></div></div><div class="callout callout-warning"><p>The Implicit grant type is now considered insecure. Use Authorization Code with PKCE (RFC 7636) for all public clients including SPAs and mobile apps.</p></div>'
    },
    {
      id: 'access-tokens',
      number: '4',
      title: 'Access Tokens & Refresh Tokens',
      content: '<p>Access tokens are credentials used to access protected resources. They have a limited lifetime and specific scope.</p><div class="key-points"><div class="key-point"><div class="key-point-title">Access Token</div><div class="key-point-text">Short-lived credential (minutes to hours) sent with API requests via Authorization header</div></div><div class="key-point"><div class="key-point-title">Refresh Token</div><div class="key-point-text">Long-lived credential used to obtain new access tokens without user interaction</div></div><div class="key-point"><div class="key-point-title">Scope</div><div class="key-point-text">Limits what resources the token can access (e.g., "read:email write:profile")</div></div></div><div class="code-block"><div class="code-block-title">Using a Bearer Token</div><pre>GET /api/user/profile HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer eyJhbGciOiJSUzI1NiIs...</pre></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Hardt, D., "The OAuth 2.0 Authorization Framework", RFC 6749, October 2012.' },
    { number: '[2]', text: 'Jones, M. and D. Hardt, "The OAuth 2.0 Authorization Framework: Bearer Token Usage", RFC 6750, October 2012.' },
    { number: '[3]', text: 'Sakimura, N., et al., "Proof Key for Code Exchange by OAuth Public Clients", RFC 7636, September 2015.' }
  ]
},

{
  number: 7519,
  title: 'JSON Web Token (JWT)',
  shortTitle: 'JWT',
  authors: ['M. Jones', 'J. Bradley', 'N. Sakimura'],
  organization: 'Microsoft / Ping Identity / NRI',
  date: 'May 2015',
  status: 'Proposed Standard',
  category: 'security',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'A compact, URL-safe token format for securely transmitting claims between parties, the backbone of modern API authentication.',
    color: 'purple',
    animation: 'data-format',
    animationData: {
      lines: [
        'eyJhbGciOiJIUzI1NiIs',
        'ICJ0eXAiOiJKV1QifQ.',
        '------- HEADER -------',
        'eyJzdWIiOiIxMjM0NTY3',
        'ODkwIiwibmFtZSI6Ikpv',
        '------- PAYLOAD ------',
        'SflKxwRJSMeKKF2QT4fw',
        'pMeJf36POk6yJV_adQssw',
        '------ SIGNATURE -----'
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>JSON Web Token (JWT) is a compact, URL-safe means of representing claims to be transferred between two parties. The claims are encoded as a JSON object that is used as the payload of a JSON Web Signature (JWS) structure or as the plaintext of a JSON Web Encryption (JWE) structure.</p><div class="callout callout-info"><p>JWTs are ubiquitous in modern web development. They\'re used for authentication tokens, API keys, single sign-on, and information exchange between microservices.</p></div>'
    },
    {
      id: 'structure',
      number: '2',
      title: 'JWT Structure',
      content: '<p>A JWT is composed of three parts separated by dots: Header, Payload, and Signature.</p><div class="code-block"><div class="code-block-title">JWT Structure</div><pre>HEADER.PAYLOAD.SIGNATURE\n\nBase64URL(Header) + "." +\nBase64URL(Payload) + "." +\nBase64URL(Signature)</pre></div><div class="field-list"><div class="field-item"><span class="field-name">Header</span><span class="field-detail">JSON object specifying the algorithm (alg) and token type (typ)</span></div><div class="field-item"><span class="field-name">Payload</span><span class="field-detail">JSON object containing the claims (sub, iss, exp, iat, etc.)</span></div><div class="field-item"><span class="field-name">Signature</span><span class="field-detail">HMAC or RSA signature over Header + Payload</span></div></div>'
    },
    {
      id: 'claims',
      number: '3',
      title: 'JWT Claims',
      content: '<p>Claims are statements about an entity (typically the user) and additional data. There are registered, public, and private claims.</p><div class="field-table"><div class="field-table-row"><span class="field-table-name">iss</span><span class="field-table-val">Issuer - who created the token</span></div><div class="field-table-row"><span class="field-table-name">sub</span><span class="field-table-val">Subject - who the token is about</span></div><div class="field-table-row"><span class="field-table-name">aud</span><span class="field-table-val">Audience - intended recipient</span></div><div class="field-table-row"><span class="field-table-name">exp</span><span class="field-table-val">Expiration time (Unix timestamp)</span></div><div class="field-table-row"><span class="field-table-name">iat</span><span class="field-table-val">Issued at time</span></div><div class="field-table-row"><span class="field-table-name">nbf</span><span class="field-table-val">Not before time</span></div><div class="field-table-row"><span class="field-table-name">jti</span><span class="field-table-val">JWT ID - unique identifier for the token</span></div></div>'
    },
    {
      id: 'security',
      number: '4',
      title: 'Security Considerations',
      content: '<div class="key-points"><div class="key-point"><div class="key-point-title">Always Verify Signatures</div><div class="key-point-text">Never trust a JWT without verifying its signature. Use the "alg" header to determine which algorithm to use for verification.</div></div><div class="key-point"><div class="key-point-title">Avoid "alg: none"</div><div class="key-point-text">The "none" algorithm must be rejected unless explicitly expected. It has been the source of critical vulnerabilities.</div></div><div class="key-point"><div class="key-point-title">Use Short Expiration</div><div class="key-point-text">JWTs cannot be revoked once issued. Keep expiration times short and use refresh tokens for long sessions.</div></div><div class="key-point"><div class="key-point-title">Don\'t Store Secrets in Payload</div><div class="key-point-text">JWT payloads are only Base64URL-encoded, not encrypted. Anyone can read the claims.</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Jones, M., Bradley, J., and N. Sakimura, "JSON Web Token (JWT)", RFC 7519, May 2015.' },
    { number: '[2]', text: 'Jones, M., "JSON Web Algorithms (JWA)", RFC 7518, May 2015.' },
    { number: '[3]', text: 'Jones, M., Bradley, J., and N. Sakimura, "JSON Web Signature (JWS)", RFC 7515, May 2015.' }
  ]
},

{
  number: 8446,
  title: 'The Transport Layer Security (TLS) Protocol Version 1.3',
  shortTitle: 'TLS 1.3',
  authors: ['E. Rescorla'],
  organization: 'Mozilla',
  date: 'August 2018',
  status: 'Proposed Standard',
  category: 'security',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'A major overhaul of TLS that eliminates legacy cruft, reduces handshake latency to one round trip, and mandates forward secrecy.',
    color: 'green',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client',
      rightLabel: 'Server',
      steps: [
        { label: 'ClientHello + KeyShare', from: 'left', description: 'Cipher suites + key material in one shot' },
        { label: 'ServerHello + KeyShare', from: 'right', description: 'Server key + encrypted extensions + cert' },
        { label: 'Finished', from: 'left', description: '1-RTT handshake complete' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>TLS 1.3 is a major revision of the TLS protocol that provides significant improvements in both security and performance. It removes obsolete and unsafe features and streamlines the handshake.</p><div class="comparison-table"><div class="comparison-header"><div class="comparison-col">TLS 1.2</div><div class="comparison-col">TLS 1.3</div></div><div class="comparison-row"><div class="comparison-col">2-RTT handshake</div><div class="comparison-col">1-RTT handshake (0-RTT resumption)</div></div><div class="comparison-row"><div class="comparison-col">RSA key exchange</div><div class="comparison-col">(EC)DHE only - forward secrecy mandatory</div></div><div class="comparison-row"><div class="comparison-col">CBC & RC4 ciphers</div><div class="comparison-col">AEAD only (AES-GCM, ChaCha20-Poly1305)</div></div><div class="comparison-row"><div class="comparison-col">Compression supported</div><div class="comparison-col">Compression removed (CRIME attack)</div></div><div class="comparison-row"><div class="comparison-col">Renegotiation</div><div class="comparison-col">Removed entirely</div></div></div>'
    },
    {
      id: 'handshake',
      number: '2',
      title: '1-RTT Handshake',
      content: '<p>TLS 1.3 reduces the handshake to a single round trip by having the client send key shares in the first message.</p><div class="key-points"><div class="key-point"><div class="key-point-title">ClientHello</div><div class="key-point-text">Client sends supported cipher suites, key shares for likely groups, and random. Everything needed for key exchange in one message.</div></div><div class="key-point"><div class="key-point-title">ServerHello</div><div class="key-point-text">Server responds with its key share. From this point, all further messages are encrypted.</div></div><div class="key-point"><div class="key-point-title">EncryptedExtensions</div><div class="key-point-text">Server extensions that don\'t need to be in the clear are now encrypted.</div></div></div>'
    },
    {
      id: 'zero-rtt',
      number: '3',
      title: '0-RTT Resumption',
      content: '<p>When a client has previously connected to a server, it can send application data in its first message (0-RTT) using a pre-shared key from the previous session.</p><div class="callout callout-warning"><p>0-RTT data is not protected against replay attacks. Servers must ensure that 0-RTT data is idempotent or implement replay protection at the application layer.</p></div>'
    },
    {
      id: 'removed-features',
      number: '4',
      title: 'Removed Features',
      content: '<p>TLS 1.3 aggressively removed legacy features that were sources of security vulnerabilities:</p><div class="field-list"><div class="field-item"><span class="field-name">Static RSA</span><span class="field-detail">No forward secrecy; removed in favor of ephemeral key exchange</span></div><div class="field-item"><span class="field-name">CBC Ciphers</span><span class="field-detail">Vulnerable to padding oracle attacks (POODLE, Lucky13)</span></div><div class="field-item"><span class="field-name">RC4</span><span class="field-detail">Statistical biases allow plaintext recovery</span></div><div class="field-item"><span class="field-name">Compression</span><span class="field-detail">Enables CRIME/BREACH side-channel attacks</span></div><div class="field-item"><span class="field-name">Renegotiation</span><span class="field-detail">Complex, attack-prone mechanism removed entirely</span></div><div class="field-item"><span class="field-name">Custom DHE Groups</span><span class="field-detail">Only named groups with known security properties allowed</span></div></div>'
    },
    {
      id: 'cipher-suites',
      number: '5',
      title: 'Cipher Suites',
      content: '<p>TLS 1.3 dramatically simplifies cipher suite negotiation. Only five cipher suites are defined:</p><div class="code-block"><div class="code-block-title">TLS 1.3 Cipher Suites</div><pre>TLS_AES_128_GCM_SHA256\nTLS_AES_256_GCM_SHA384\nTLS_CHACHA20_POLY1305_SHA256\nTLS_AES_128_CCM_SHA256\nTLS_AES_128_CCM_8_SHA256</pre></div><div class="callout callout-note"><p>Key exchange and authentication algorithms are negotiated separately via extensions, not as part of the cipher suite. This greatly simplifies the combinatorial explosion of TLS 1.2.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Rescorla, E., "The Transport Layer Security (TLS) Protocol Version 1.3", RFC 8446, August 2018.' },
    { number: '[2]', text: 'Dierks, T. and E. Rescorla, "The Transport Layer Security (TLS) Protocol Version 1.2", RFC 5246, August 2008.' }
  ]
},

{
  number: 8555,
  title: 'Automatic Certificate Management Environment (ACME)',
  shortTitle: 'ACME',
  authors: ['R. Barnes', 'J. Hoffman-Andrews', 'D. McCarney', 'J. Kasten'],
  organization: 'Cisco / EFF / Let\'s Encrypt',
  date: 'March 2019',
  status: 'Proposed Standard',
  category: 'security',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The protocol behind Let\'s Encrypt that automated certificate issuance and renewal, bringing free HTTPS to the entire web.',
    color: 'cyan',
    animation: 'handshake',
    animationData: {
      leftLabel: 'ACME Client',
      rightLabel: 'CA Server',
      steps: [
        { label: 'Create Account', from: 'left', description: 'Register with key pair' },
        { label: 'Order Certificate', from: 'left', description: 'Request cert for domain(s)' },
        { label: 'Authorization Challenge', from: 'right', description: 'HTTP-01 or DNS-01 challenge' },
        { label: 'Prove Control', from: 'left', description: 'Respond to domain challenge' },
        { label: 'Certificate Issued', from: 'right', description: 'DV certificate delivered' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>ACME (Automatic Certificate Management Environment) automates the process of verification and issuance of X.509 certificates. It was designed for Let\'s Encrypt but is used by many CAs.</p><div class="callout callout-info"><p>Before ACME, getting an SSL certificate required manual steps, payment, and waiting. ACME made free, automated certificates possible, driving HTTPS adoption from ~40% to over 95% of web traffic.</p></div>'
    },
    {
      id: 'protocol-overview',
      number: '2',
      title: 'Protocol Overview',
      content: '<p>ACME is a JSON-based protocol over HTTPS. All requests are signed with the account\'s private key using JWS (JSON Web Signature).</p><div class="field-list"><div class="field-item"><span class="field-name">Account Creation</span><span class="field-detail">Client registers a public key with the CA server</span></div><div class="field-item"><span class="field-name">Order</span><span class="field-detail">Client requests a certificate for one or more domain names</span></div><div class="field-item"><span class="field-name">Authorization</span><span class="field-detail">CA presents challenges to prove domain control</span></div><div class="field-item"><span class="field-name">Finalize</span><span class="field-detail">Client submits CSR, CA issues the certificate</span></div></div>'
    },
    {
      id: 'challenge-types',
      number: '3',
      title: 'Challenge Types',
      content: '<p>ACME supports multiple challenge types to prove domain control:</p><div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Challenge</div><div class="comparison-col">Mechanism</div></div><div class="comparison-row"><div class="comparison-col">HTTP-01</div><div class="comparison-col">Place a file at /.well-known/acme-challenge/ on port 80</div></div><div class="comparison-row"><div class="comparison-col">DNS-01</div><div class="comparison-col">Create a TXT record _acme-challenge.domain</div></div><div class="comparison-row"><div class="comparison-col">TLS-ALPN-01</div><div class="comparison-col">Present a self-signed cert during TLS on port 443</div></div></div><div class="callout callout-note"><p>DNS-01 is the only challenge type that supports wildcard certificates (*.example.com).</p></div>'
    },
    {
      id: 'automation',
      number: '4',
      title: 'Automated Renewal',
      content: '<p>ACME certificates are typically valid for 90 days, encouraging automation. Clients like Certbot, acme.sh, and Caddy handle automatic renewal.</p><div class="key-points"><div class="key-point"><div class="key-point-title">Certbot</div><div class="key-point-text">The most popular ACME client, developed by EFF. Supports Apache, Nginx, and standalone modes.</div></div><div class="key-point"><div class="key-point-title">Short-Lived Certs</div><div class="key-point-text">90-day validity reduces exposure if a key is compromised and encourages automation.</div></div><div class="key-point"><div class="key-point-title">Rate Limits</div><div class="key-point-text">Let\'s Encrypt enforces rate limits (50 certs per domain per week) to prevent abuse.</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Barnes, R., et al., "Automatic Certificate Management Environment (ACME)", RFC 8555, March 2019.' },
    { number: '[2]', text: 'Aas, J., et al., "Let\'s Encrypt: A Free, Automated, and Open Certificate Authority", 2019.' }
  ]
},

// ============================================================
// EMAIL RFCs
// ============================================================

{
  number: 821,
  title: 'Simple Mail Transfer Protocol',
  shortTitle: 'SMTP (Original)',
  authors: ['J. Postel'],
  organization: 'USC/Information Sciences Institute',
  date: 'August 1982',
  status: 'Internet Standard',
  category: 'email',
  featured: true,
  obsoletedBy: 'RFC 2821, RFC 5321',
  obsoletes: null,
  hero: {
    subtitle: 'The original specification for email delivery that established how messages traverse the Internet, still in use (updated) over 40 years later.',
    color: 'yellow',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Sender MTA',
      rightLabel: 'Receiver MTA',
      steps: [
        { label: '220 Ready', from: 'right', description: 'Server greeting' },
        { label: 'HELO sender.com', from: 'left', description: 'Client identifies itself' },
        { label: 'MAIL FROM:<alice@sender.com>', from: 'left', description: 'Envelope sender' },
        { label: 'RCPT TO:<bob@receiver.com>', from: 'left', description: 'Envelope recipient' },
        { label: 'DATA / 354 Start', from: 'left', description: 'Message body follows' },
        { label: '250 OK / QUIT', from: 'right', description: 'Message accepted' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>SMTP (Simple Mail Transfer Protocol) defines the mechanism for transmitting email messages between mail servers. It operates on a store-and-forward model where messages are relayed between Mail Transfer Agents (MTAs).</p><div class="callout callout-info"><p>Jon Postel authored this RFC along with many other foundational Internet standards. SMTP remains one of the oldest protocols still in active daily use, handling billions of emails per day.</p></div>'
    },
    {
      id: 'commands',
      number: '2',
      title: 'SMTP Commands',
      content: '<p>SMTP uses a simple text-based command-response protocol over TCP port 25.</p><div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">HELO</span><span>Identify the sending host</span></div><div class="opcode-card"><span class="opcode-highlight">MAIL FROM</span><span>Specify the envelope sender</span></div><div class="opcode-card"><span class="opcode-highlight">RCPT TO</span><span>Specify an envelope recipient</span></div><div class="opcode-card"><span class="opcode-highlight">DATA</span><span>Begin the message body</span></div><div class="opcode-card"><span class="opcode-highlight">QUIT</span><span>Close the connection</span></div><div class="opcode-card"><span class="opcode-highlight">RSET</span><span>Reset the session state</span></div><div class="opcode-card"><span class="opcode-highlight">NOOP</span><span>No operation (keep-alive)</span></div><div class="opcode-card"><span class="opcode-highlight">VRFY</span><span>Verify a mailbox exists</span></div></div>'
    },
    {
      id: 'reply-codes',
      number: '3',
      title: 'Reply Codes',
      content: '<p>SMTP reply codes are three-digit numbers where the first digit indicates the class of response:</p><div class="field-table"><div class="field-table-row"><span class="field-table-name">2xx</span><span class="field-table-val">Positive completion (e.g., 250 OK)</span></div><div class="field-table-row"><span class="field-table-name">3xx</span><span class="field-table-val">Positive intermediate (e.g., 354 Start mail input)</span></div><div class="field-table-row"><span class="field-table-name">4xx</span><span class="field-table-val">Transient negative (e.g., 451 Local error)</span></div><div class="field-table-row"><span class="field-table-name">5xx</span><span class="field-table-val">Permanent negative (e.g., 550 Mailbox unavailable)</span></div></div>'
    },
    {
      id: 'legacy',
      number: '4',
      title: 'Legacy and Evolution',
      content: '<p>RFC 821 was updated by RFC 2821 and then RFC 5321, adding extensions like EHLO, STARTTLS, authentication, and internationalized email. The core store-and-forward model remains unchanged.</p><div class="key-points"><div class="key-point"><div class="key-point-title">ESMTP</div><div class="key-point-text">Extended SMTP (RFC 5321) adds capabilities negotiation via EHLO</div></div><div class="key-point"><div class="key-point-title">STARTTLS</div><div class="key-point-text">Opportunistic encryption for SMTP connections</div></div><div class="key-point"><div class="key-point-title">SPF/DKIM/DMARC</div><span class="key-point-text">Authentication mechanisms to prevent email spoofing</span></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Postel, J., "Simple Mail Transfer Protocol", RFC 821, August 1982.' },
    { number: '[2]', text: 'Klensin, J., "Simple Mail Transfer Protocol", RFC 5321, October 2008.' }
  ]
},

{
  number: 5321,
  title: 'Simple Mail Transfer Protocol',
  shortTitle: 'SMTP',
  authors: ['J. Klensin'],
  organization: '',
  date: 'October 2008',
  status: 'Internet Standard',
  category: 'email',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 2821, RFC 821',
  hero: {
    subtitle: 'The current standard for Internet email delivery, defining how billions of messages are routed and delivered every day.',
    color: 'orange',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\u2709', label: 'Sending MTA', detail: 'mail.sender.com' },
      bottomNode: { icon: '\uD83D\uDCEB', label: 'Receiving MTA', detail: 'mx.receiver.com' },
      reqLabel: 'MAIL FROM / RCPT TO / DATA',
      repLabel: '250 OK - Message Accepted'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>RFC 5321 is the current definitive specification for SMTP, superseding RFC 2821 and the original RFC 821. It describes the protocol for reliable and efficient email transfer.</p><div class="callout callout-info"><p>This RFC defines Extended SMTP (ESMTP), which adds service extension negotiation via the EHLO command, supporting features like TLS, authentication, and pipelining.</p></div>'
    },
    {
      id: 'architecture',
      number: '2',
      title: 'Mail System Architecture',
      content: '<p>The SMTP mail system consists of several components:</p><div class="field-list"><div class="field-item"><span class="field-name">MUA</span><span class="field-detail">Mail User Agent - the email client (Outlook, Thunderbird, Gmail)</span></div><div class="field-item"><span class="field-name">MSA</span><span class="field-detail">Mail Submission Agent - accepts mail from MUAs (port 587)</span></div><div class="field-item"><span class="field-name">MTA</span><span class="field-detail">Mail Transfer Agent - relays mail between servers (port 25)</span></div><div class="field-item"><span class="field-name">MDA</span><span class="field-detail">Mail Delivery Agent - delivers mail to recipient mailboxes</span></div><div class="field-item"><span class="field-name">MX Record</span><span class="field-detail">DNS record pointing to the receiving mail server for a domain</span></div></div>'
    },
    {
      id: 'extensions',
      number: '3',
      title: 'SMTP Extensions',
      content: '<p>ESMTP allows servers to advertise supported extensions in response to the EHLO command:</p><div class="code-block"><div class="code-block-title">EHLO Capability Advertisement</div><pre>S: 250-mail.example.com Hello\nS: 250-SIZE 35882577\nS: 250-8BITMIME\nS: 250-STARTTLS\nS: 250-AUTH LOGIN PLAIN\nS: 250-PIPELINING\nS: 250 SMTPUTF8</pre></div>'
    },
    {
      id: 'delivery',
      number: '4',
      title: 'Mail Delivery Process',
      content: '<div class="key-points"><div class="key-point"><div class="key-point-title">1. DNS Lookup</div><div class="key-point-text">Sending MTA queries DNS for the MX records of the recipient\'s domain</div></div><div class="key-point"><div class="key-point-title">2. Connection</div><div class="key-point-text">Connect to the highest-priority MX host on port 25</div></div><div class="key-point"><div class="key-point-title">3. EHLO Exchange</div><div class="key-point-text">Negotiate capabilities, optionally upgrade to TLS</div></div><div class="key-point"><div class="key-point-title">4. Envelope</div><div class="key-point-text">Send MAIL FROM and RCPT TO commands</div></div><div class="key-point"><div class="key-point-title">5. Message Transfer</div><div class="key-point-text">Send headers and body via DATA command, terminated by CRLF.CRLF</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Klensin, J., "Simple Mail Transfer Protocol", RFC 5321, October 2008.' },
    { number: '[2]', text: 'Resnick, P., "Internet Message Format", RFC 5322, October 2008.' }
  ]
},

{
  number: 5322,
  title: 'Internet Message Format',
  shortTitle: 'Email Format',
  authors: ['P. Resnick'],
  organization: 'Qualcomm',
  date: 'October 2008',
  status: 'Internet Standard',
  category: 'email',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 2822',
  hero: {
    subtitle: 'Defining the syntax of email messages - headers, body, addresses, and dates - the format behind every email you\'ve ever sent or received.',
    color: 'blue',
    animation: 'data-format',
    animationData: {
      lines: [
        'From: Alice <alice@example.com>',
        'To: Bob <bob@example.org>',
        'Date: Wed, 04 Feb 2026 10:30:00 -0500',
        'Subject: Hello from RFC 5322',
        'Message-ID: <unique@example.com>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain',
        '',
        'This is the message body.'
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>RFC 5322 defines the format of Internet email messages, specifying the syntax for headers and body. While SMTP (RFC 5321) handles delivery, this RFC defines what the message itself looks like.</p><div class="callout callout-info"><p>An email message is just structured text: a set of header fields followed by a blank line and then the message body. MIME extensions add support for attachments and rich content.</p></div>'
    },
    {
      id: 'header-fields',
      number: '2',
      title: 'Header Fields',
      content: '<p>Header fields follow the format <code>Field-Name: Field-Value</code>, with long values folded across multiple lines.</p><div class="field-table"><div class="field-table-row"><span class="field-table-name">From</span><span class="field-table-val">The author(s) of the message</span></div><div class="field-table-row"><span class="field-table-name">To</span><span class="field-table-val">Primary recipient(s)</span></div><div class="field-table-row"><span class="field-table-name">Cc</span><span class="field-table-val">Carbon copy recipients</span></div><div class="field-table-row"><span class="field-table-name">Bcc</span><span class="field-table-val">Blind carbon copy (not visible to other recipients)</span></div><div class="field-table-row"><span class="field-table-name">Date</span><span class="field-table-val">Date and time the message was composed</span></div><div class="field-table-row"><span class="field-table-name">Subject</span><span class="field-table-val">Summary of the message topic</span></div><div class="field-table-row"><span class="field-table-name">Message-ID</span><span class="field-table-val">Globally unique identifier for the message</span></div><div class="field-table-row"><span class="field-table-name">In-Reply-To</span><span class="field-table-val">Message-ID of the message being replied to</span></div><div class="field-table-row"><span class="field-table-name">References</span><span class="field-table-val">Thread of Message-IDs for conversation tracking</span></div></div>'
    },
    {
      id: 'address-format',
      number: '3',
      title: 'Address Specification',
      content: '<p>Email addresses can be specified in several formats:</p><div class="code-block"><div class="code-block-title">Address Formats</div><pre>Simple:      user@example.com\nDisplay:     John Doe &lt;john@example.com&gt;\nGroup:       Team: alice@ex.com, bob@ex.com;\nQuoted:      "john.doe"@example.com</pre></div><p>The local-part (before @) is case-sensitive per the standard, though most servers treat it as case-insensitive. The domain part is always case-insensitive.</p>'
    },
    {
      id: 'date-format',
      number: '4',
      title: 'Date and Time',
      content: '<p>RFC 5322 defines a specific date format used in email headers:</p><div class="code-block"><div class="code-block-title">Date Format</div><pre>date-time = [ day-of-week "," ] date time\n\nExamples:\nWed, 04 Feb 2026 10:30:00 -0500\n4 Feb 2026 15:30:00 +0000</pre></div><div class="callout callout-note"><p>This date format is widely used beyond email. RFC 2822 dates appear in HTTP headers, RSS feeds, and many other Internet protocols.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Resnick, P., "Internet Message Format", RFC 5322, October 2008.' },
    { number: '[2]', text: 'Freed, N. and N. Borenstein, "Multipurpose Internet Mail Extensions (MIME) Part One", RFC 2045, November 1996.' }
  ]
},

// ============================================================
// APPLICATION PROTOCOL RFCs
// ============================================================

{
  number: 959,
  title: 'File Transfer Protocol (FTP)',
  shortTitle: 'FTP',
  authors: ['J. Postel', 'J. Reynolds'],
  organization: 'USC/Information Sciences Institute',
  date: 'October 1985',
  status: 'Internet Standard',
  category: 'applications',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 765',
  hero: {
    subtitle: 'The classic file transfer protocol that pioneered client-server file sharing on the Internet, using separate control and data connections.',
    color: 'green',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\uD83D\uDCBB', label: 'FTP Client', detail: 'Control: Port 21' },
      bottomNode: { icon: '\uD83D\uDDA7', label: 'FTP Server', detail: 'Data: Port 20' },
      reqLabel: 'RETR filename.txt',
      repLabel: '226 Transfer complete'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>FTP enables reliable file transfer between hosts on a TCP/IP network. It uses a unique dual-connection architecture: a persistent control connection for commands and a separate data connection for file transfers.</p><div class="callout callout-info"><p>While largely replaced by SFTP and HTTPS for most use cases, FTP remains in use for legacy systems, firmware updates, and bulk file distribution. Its dual-connection model influenced many later protocols.</p></div>'
    },
    {
      id: 'commands',
      number: '2',
      title: 'FTP Commands',
      content: '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">USER/PASS</span><span>Authentication credentials</span></div><div class="opcode-card"><span class="opcode-highlight">LIST</span><span>List directory contents</span></div><div class="opcode-card"><span class="opcode-highlight">RETR</span><span>Retrieve (download) a file</span></div><div class="opcode-card"><span class="opcode-highlight">STOR</span><span>Store (upload) a file</span></div><div class="opcode-card"><span class="opcode-highlight">CWD</span><span>Change working directory</span></div><div class="opcode-card"><span class="opcode-highlight">PWD</span><span>Print working directory</span></div><div class="opcode-card"><span class="opcode-highlight">PASV</span><span>Enter passive mode</span></div><div class="opcode-card"><span class="opcode-highlight">TYPE</span><span>Set transfer type (ASCII/Binary)</span></div><div class="opcode-card"><span class="opcode-highlight">QUIT</span><span>Close session</span></div></div>'
    },
    {
      id: 'connections',
      number: '3',
      title: 'Control and Data Connections',
      content: '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Control Connection</div><div class="comparison-col">Data Connection</div></div><div class="comparison-row"><div class="comparison-col">Port 21 (persistent)</div><div class="comparison-col">Port 20 or dynamic (per-transfer)</div></div><div class="comparison-row"><div class="comparison-col">Text commands/responses</div><div class="comparison-col">File data / directory listings</div></div><div class="comparison-row"><div class="comparison-col">Always TCP</div><div class="comparison-col">Active or Passive mode</div></div></div><div class="callout callout-note"><p>In active mode, the server connects back to the client for data transfer. In passive mode (PASV), the client initiates both connections. Passive mode is necessary for clients behind NAT/firewalls.</p></div>'
    },
    {
      id: 'security',
      number: '4',
      title: 'Security Considerations',
      content: '<p>Original FTP transmits everything (including passwords) in cleartext, making it unsuitable for modern use without additional security layers.</p><div class="key-points"><div class="key-point"><div class="key-point-title">FTPS (RFC 4217)</div><div class="key-point-text">FTP over TLS - adds encryption via STARTTLS or implicit TLS</div></div><div class="key-point"><div class="key-point-title">SFTP</div><div class="key-point-text">SSH File Transfer Protocol - a completely different protocol that runs over SSH (not FTP)</div></div><div class="key-point"><div class="key-point-title">Modern Alternatives</div><div class="key-point-text">HTTPS uploads, SCP, rsync over SSH, cloud storage APIs</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Postel, J. and J. Reynolds, "File Transfer Protocol (FTP)", RFC 959, October 1985.' },
    { number: '[2]', text: 'Ford-Hutchinson, P., "Securing FTP with TLS", RFC 4217, October 2005.' }
  ]
},

{
  number: 2131,
  title: 'Dynamic Host Configuration Protocol',
  shortTitle: 'DHCP',
  authors: ['R. Droms'],
  organization: 'Bucknell University',
  date: 'March 1997',
  status: 'Internet Standard',
  category: 'applications',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 1541',
  hero: {
    subtitle: 'The protocol that automatically configures every device that joins a network, assigning IP addresses, gateways, and DNS servers.',
    color: 'yellow',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Client',
      rightLabel: 'DHCP Server',
      steps: [
        { label: 'DHCPDISCOVER', from: 'left', description: 'Broadcast: "I need an IP!"' },
        { label: 'DHCPOFFER', from: 'right', description: 'Here\'s 192.168.1.100' },
        { label: 'DHCPREQUEST', from: 'left', description: 'I\'ll take that one' },
        { label: 'DHCPACK', from: 'right', description: 'Confirmed, lease granted' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>DHCP provides a framework for automatic network configuration. When you connect to a WiFi network and get an IP address, that\'s DHCP at work. It evolved from BOOTP (RFC 951) to add dynamic address allocation and lease management.</p><div class="callout callout-info"><p>DHCP is one of the most widely used network protocols. Every smartphone, laptop, smart TV, and IoT device uses DHCP to obtain its network configuration.</p></div>'
    },
    {
      id: 'dora',
      number: '2',
      title: 'The DORA Process',
      content: '<p>DHCP uses a four-step process known as DORA:</p><div class="key-points"><div class="key-point"><div class="key-point-title">Discover</div><div class="key-point-text">Client broadcasts DHCPDISCOVER on the local network (UDP port 67/68)</div></div><div class="key-point"><div class="key-point-title">Offer</div><div class="key-point-text">One or more servers respond with DHCPOFFER containing an available IP address</div></div><div class="key-point"><div class="key-point-title">Request</div><div class="key-point-text">Client broadcasts DHCPREQUEST to accept one offer and decline others</div></div><div class="key-point"><div class="key-point-title">Acknowledge</div><div class="key-point-text">Server confirms with DHCPACK, client configures its network interface</div></div></div>'
    },
    {
      id: 'options',
      number: '3',
      title: 'DHCP Options',
      content: '<p>DHCP delivers network configuration via options encoded as type-length-value (TLV) fields:</p><div class="field-table"><div class="field-table-row"><span class="field-table-name">Option 1</span><span class="field-table-val">Subnet Mask (e.g., 255.255.255.0)</span></div><div class="field-table-row"><span class="field-table-name">Option 3</span><span class="field-table-val">Default Gateway</span></div><div class="field-table-row"><span class="field-table-name">Option 6</span><span class="field-table-val">DNS Servers</span></div><div class="field-table-row"><span class="field-table-name">Option 15</span><span class="field-table-val">Domain Name</span></div><div class="field-table-row"><span class="field-table-name">Option 51</span><span class="field-table-val">Lease Time</span></div><div class="field-table-row"><span class="field-table-name">Option 53</span><span class="field-table-val">DHCP Message Type</span></div></div>'
    },
    {
      id: 'leases',
      number: '4',
      title: 'Lease Management',
      content: '<p>DHCP addresses are leased for a specific duration. Clients must renew their lease before it expires to retain their IP address.</p><div class="field-list"><div class="field-item"><span class="field-name">T1 (Renewal)</span><span class="field-detail">At 50% of lease time, client attempts unicast renewal with the original server</span></div><div class="field-item"><span class="field-name">T2 (Rebinding)</span><span class="field-detail">At 87.5% of lease time, client broadcasts renewal to any server</span></div><div class="field-item"><span class="field-name">Expiration</span><span class="field-detail">If no renewal succeeds, client releases the IP and starts DORA again</span></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Droms, R., "Dynamic Host Configuration Protocol", RFC 2131, March 1997.' },
    { number: '[2]', text: 'Croft, B. and J. Gilmore, "Bootstrap Protocol (BOOTP)", RFC 951, September 1985.' }
  ]
},

{
  number: 3261,
  title: 'SIP: Session Initiation Protocol',
  shortTitle: 'SIP',
  authors: ['J. Rosenberg', 'H. Schulzrinne', 'G. Camarillo', 'A. Johnston', 'J. Peterson', 'R. Sparks', 'M. Handley', 'E. Schooler'],
  organization: 'Columbia University / Cisco / Ericsson',
  date: 'June 2002',
  status: 'Proposed Standard',
  category: 'applications',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 2543',
  hero: {
    subtitle: 'The signaling protocol behind Voice over IP (VoIP), video calls, and multimedia sessions across the Internet.',
    color: 'purple',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Caller',
      rightLabel: 'Callee',
      steps: [
        { label: 'INVITE', from: 'left', description: 'Initiate session with SDP offer' },
        { label: '180 Ringing', from: 'right', description: 'Phone is ringing' },
        { label: '200 OK', from: 'right', description: 'Call answered with SDP answer' },
        { label: 'ACK', from: 'left', description: 'Three-way handshake complete' },
        { label: 'BYE', from: 'left', description: 'End the call' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>SIP is a text-based signaling protocol for creating, modifying, and terminating multimedia sessions. It handles the setup and teardown of calls while the actual media (audio/video) flows via RTP.</p><div class="callout callout-info"><p>SIP powers most VoIP phone systems, video conferencing platforms, and is the signaling backbone for telecom providers worldwide. Its HTTP-like text format makes it easy to debug and extend.</p></div>'
    },
    {
      id: 'methods',
      number: '2',
      title: 'SIP Methods',
      content: '<div class="opcode-grid"><div class="opcode-card"><span class="opcode-highlight">INVITE</span><span>Initiate a session or modify existing one</span></div><div class="opcode-card"><span class="opcode-highlight">ACK</span><span>Confirm reception of a final response</span></div><div class="opcode-card"><span class="opcode-highlight">BYE</span><span>Terminate a session</span></div><div class="opcode-card"><span class="opcode-highlight">CANCEL</span><span>Cancel a pending INVITE</span></div><div class="opcode-card"><span class="opcode-highlight">REGISTER</span><span>Bind a SIP URI to a contact address</span></div><div class="opcode-card"><span class="opcode-highlight">OPTIONS</span><span>Query server capabilities</span></div></div>'
    },
    {
      id: 'architecture',
      number: '3',
      title: 'Architecture',
      content: '<p>SIP uses several network elements:</p><div class="field-list"><div class="field-item"><span class="field-name">User Agent (UA)</span><span class="field-detail">End device (phone, softphone) that initiates or receives calls</span></div><div class="field-item"><span class="field-name">Proxy Server</span><span class="field-detail">Routes requests on behalf of UAs, handles policies</span></div><div class="field-item"><span class="field-name">Registrar</span><span class="field-detail">Accepts REGISTER requests and stores location bindings</span></div><div class="field-item"><span class="field-name">Redirect Server</span><span class="field-detail">Responds with alternative contact addresses</span></div><div class="field-item"><span class="field-name">B2BUA</span><span class="field-detail">Back-to-Back User Agent - sits in the call path (PBX, SBC)</span></div></div>'
    },
    {
      id: 'example',
      number: '4',
      title: 'SIP Message Example',
      content: '<div class="code-block"><div class="code-block-title">SIP INVITE Request</div><pre>INVITE sip:bob@example.com SIP/2.0\nVia: SIP/2.0/UDP pc33.example.com;branch=z9hG4bK776\nMax-Forwards: 70\nTo: Bob &lt;sip:bob@example.com&gt;\nFrom: Alice &lt;sip:alice@example.com&gt;;tag=1928301774\nCall-ID: a84b4c76e66710@pc33.example.com\nCSeq: 314159 INVITE\nContact: &lt;sip:alice@pc33.example.com&gt;\nContent-Type: application/sdp\nContent-Length: 142</pre></div><div class="callout callout-note"><p>SIP\'s text format is deliberately similar to HTTP, making it accessible to web developers and easy to inspect with standard text tools.</p></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Rosenberg, J., et al., "SIP: Session Initiation Protocol", RFC 3261, June 2002.' },
    { number: '[2]', text: 'Schulzrinne, H., et al., "RTP: A Transport Protocol for Real-Time Applications", RFC 3550, July 2003.' }
  ]
},

{
  number: 3550,
  title: 'RTP: A Transport Protocol for Real-Time Applications',
  shortTitle: 'RTP',
  authors: ['H. Schulzrinne', 'S. Casner', 'R. Frederick', 'V. Jacobson'],
  organization: 'Columbia University / Packet Design',
  date: 'July 2003',
  status: 'Internet Standard',
  category: 'applications',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 1889',
  hero: {
    subtitle: 'The real-time transport protocol that carries audio and video across the Internet, powering video calls, live streaming, and VoIP.',
    color: 'red',
    animation: 'packet-flow',
    animationData: {
      topNode: { icon: '\uD83C\uDFA4', label: 'Media Source', detail: 'Audio/Video Encoder' },
      bottomNode: { icon: '\uD83D\uDD0A', label: 'Media Sink', detail: 'Audio/Video Decoder' },
      reqLabel: 'RTP Packets (Sequence #)',
      repLabel: 'RTCP Receiver Reports'
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>RTP provides end-to-end delivery services for data with real-time characteristics, such as audio and video. It runs over UDP and provides timestamps, sequence numbers, and payload type identification.</p><div class="callout callout-info"><p>RTP doesn\'t guarantee delivery or quality - it provides the building blocks for applications to handle real-time media. Companion protocol RTCP provides feedback on quality.</p></div>'
    },
    {
      id: 'packet-format',
      number: '2',
      title: 'RTP Packet Format',
      content: '<div class="packet-diagram"><div class="packet-diagram-title">RTP Header (12 bytes minimum)</div><pre class="packet-ascii"> 0                   1                   2                   3\n 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|V=2|P|X|  CC   |M|     PT      |       Sequence Number         |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                           Timestamp                           |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+\n|                   Synchronization Source (SSRC)               |\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+</pre></div><div class="field-list"><div class="field-item"><span class="field-name">V (2 bits)</span><span class="field-detail">RTP version - always 2</span></div><div class="field-item"><span class="field-name">PT (7 bits)</span><span class="field-detail">Payload type - identifies codec (e.g., 0=PCMU, 111=Opus)</span></div><div class="field-item"><span class="field-name">Sequence Number</span><span class="field-detail">Increments per packet - detects loss and reordering</span></div><div class="field-item"><span class="field-name">Timestamp</span><span class="field-detail">Sampling instant - enables synchronization and jitter calculation</span></div><div class="field-item"><span class="field-name">SSRC</span><span class="field-detail">Synchronization source identifier - unique per media stream</span></div></div>'
    },
    {
      id: 'rtcp',
      number: '3',
      title: 'RTCP: Control Protocol',
      content: '<p>RTCP provides out-of-band statistics and control information for an RTP session:</p><div class="field-table"><div class="field-table-row"><span class="field-table-name">Sender Report (SR)</span><span class="field-table-val">Transmission statistics from the media sender</span></div><div class="field-table-row"><span class="field-table-name">Receiver Report (RR)</span><span class="field-table-val">Reception quality metrics (loss, jitter, RTT)</span></div><div class="field-table-row"><span class="field-table-name">SDES</span><span class="field-table-val">Source description items (CNAME, email, etc.)</span></div><div class="field-table-row"><span class="field-table-name">BYE</span><span class="field-table-val">Indicates a source is leaving the session</span></div></div>'
    },
    {
      id: 'applications',
      number: '4',
      title: 'Applications',
      content: '<div class="key-points"><div class="key-point"><div class="key-point-title">WebRTC</div><div class="key-point-text">Browser-based real-time communication uses RTP (via SRTP) for media transport</div></div><div class="key-point"><div class="key-point-title">VoIP</div><div class="key-point-text">Voice over IP systems use RTP to carry audio between phones and PBXes</div></div><div class="key-point"><div class="key-point-title">Live Streaming</div><div class="key-point-text">RTSP-based streaming uses RTP for media delivery</div></div><div class="key-point"><div class="key-point-title">Video Conferencing</div><div class="key-point-text">Zoom, Teams, Meet all use RTP variants for real-time video</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Schulzrinne, H., et al., "RTP: A Transport Protocol for Real-Time Applications", RFC 3550, July 2003.' },
    { number: '[2]', text: 'Baugher, M., et al., "The Secure Real-time Transport Protocol (SRTP)", RFC 3711, March 2004.' }
  ]
},

{
  number: 4253,
  title: 'The Secure Shell (SSH) Transport Layer Protocol',
  shortTitle: 'SSH Transport',
  authors: ['T. Ylonen', 'C. Lonvick'],
  organization: 'SSH Communications Security / Cisco',
  date: 'January 2006',
  status: 'Proposed Standard',
  category: 'applications',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'The transport layer of SSH that provides encrypted remote access, replacing telnet and rlogin as the standard for secure server administration.',
    color: 'green',
    animation: 'handshake',
    animationData: {
      leftLabel: 'SSH Client',
      rightLabel: 'SSH Server',
      steps: [
        { label: 'Version Exchange', from: 'left', description: 'SSH-2.0-OpenSSH_9.0' },
        { label: 'Algorithm Negotiation', from: 'left', description: 'KEX_INIT with supported algorithms' },
        { label: 'Key Exchange', from: 'left', description: 'Diffie-Hellman or ECDH' },
        { label: 'Host Key Verification', from: 'right', description: 'Server proves its identity' },
        { label: 'Encrypted Channel', from: 'right', description: 'Symmetric encryption begins' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>The SSH Transport Layer Protocol provides server authentication, confidentiality, and integrity over an insecure network. It is the foundation for the SSH connection and authentication protocols.</p><div class="callout callout-info"><p>SSH is one of the most important tools in a system administrator\'s toolkit. It provides secure remote shell access, file transfer (SCP/SFTP), port forwarding, and is the transport for Git over SSH.</p></div>'
    },
    {
      id: 'key-exchange',
      number: '2',
      title: 'Key Exchange',
      content: '<p>SSH uses a key exchange algorithm to establish shared secrets for encryption and MAC computation.</p><div class="field-list"><div class="field-item"><span class="field-name">diffie-hellman-group14-sha256</span><span class="field-detail">DH with 2048-bit group, SHA-256 hash</span></div><div class="field-item"><span class="field-name">curve25519-sha256</span><span class="field-detail">ECDH on Curve25519 - modern default</span></div><div class="field-item"><span class="field-name">ecdh-sha2-nistp256</span><span class="field-detail">ECDH on NIST P-256 curve</span></div></div><div class="callout callout-note"><p>The key exchange also verifies the server\'s identity via its host key. On first connection, the client stores the host key fingerprint ("known_hosts"). This is the famous "Are you sure you want to continue connecting?" prompt.</p></div>'
    },
    {
      id: 'encryption',
      number: '3',
      title: 'Encryption and MAC',
      content: '<p>After key exchange, all traffic is encrypted with a symmetric cipher and integrity-protected with a MAC or AEAD:</p><div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Algorithm</div><div class="comparison-col">Type</div></div><div class="comparison-row"><div class="comparison-col">chacha20-poly1305@openssh.com</div><div class="comparison-col">AEAD (recommended)</div></div><div class="comparison-row"><div class="comparison-col">aes128-gcm@openssh.com</div><div class="comparison-col">AEAD</div></div><div class="comparison-row"><div class="comparison-col">aes256-ctr</div><div class="comparison-col">Encrypt-then-MAC</div></div></div>'
    },
    {
      id: 'host-keys',
      number: '4',
      title: 'Host Keys',
      content: '<p>Server host keys verify the server\'s identity and prevent man-in-the-middle attacks.</p><div class="key-points"><div class="key-point"><div class="key-point-title">Ed25519</div><div class="key-point-text">Modern, fast, small keys - the recommended host key type</div></div><div class="key-point"><div class="key-point-title">ECDSA</div><div class="key-point-text">Elliptic curve keys on NIST curves - widely supported</div></div><div class="key-point"><div class="key-point-title">RSA</div><div class="key-point-text">Legacy but universal support - use SHA-256 signatures (rsa-sha2-256)</div></div></div><div class="code-block"><div class="code-block-title">Checking a Host Key Fingerprint</div><pre>$ ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub\n256 SHA256:AbC123... root@server (ED25519)</pre></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Ylonen, T. and C. Lonvick, "The Secure Shell (SSH) Transport Layer Protocol", RFC 4253, January 2006.' },
    { number: '[2]', text: 'Ylonen, T. and C. Lonvick, "The Secure Shell (SSH) Authentication Protocol", RFC 4252, January 2006.' },
    { number: '[3]', text: 'Ylonen, T. and C. Lonvick, "The Secure Shell (SSH) Connection Protocol", RFC 4254, January 2006.' }
  ]
},

{
  number: 6455,
  title: 'The WebSocket Protocol',
  shortTitle: 'WebSocket',
  authors: ['I. Fette', 'A. Melnikov'],
  organization: 'Google / Isode',
  date: 'December 2011',
  status: 'Proposed Standard',
  category: 'applications',
  featured: true,
  obsoletedBy: null,
  obsoletes: null,
  hero: {
    subtitle: 'Enabling full-duplex, bidirectional communication over a single TCP connection, powering real-time web applications from chat to live data.',
    color: 'cyan',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Browser',
      rightLabel: 'Server',
      steps: [
        { label: 'HTTP Upgrade Request', from: 'left', description: 'Connection: Upgrade, Upgrade: websocket' },
        { label: '101 Switching Protocols', from: 'right', description: 'Sec-WebSocket-Accept header' },
        { label: 'Bidirectional frames', from: 'left', description: 'Text/binary messages flow both ways' },
        { label: 'Close frame', from: 'left', description: 'Clean shutdown handshake' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>WebSocket provides a full-duplex communication channel over a single TCP connection. Unlike HTTP\'s request-response model, WebSocket allows both client and server to send messages independently at any time.</p><div class="callout callout-info"><p>Before WebSocket, real-time web apps relied on inefficient techniques like long-polling, Server-Sent Events, or Comet. WebSocket provides a clean, efficient solution for bidirectional communication.</p></div>'
    },
    {
      id: 'opening-handshake',
      number: '2',
      title: 'Opening Handshake',
      content: '<p>WebSocket connections start as an HTTP/1.1 Upgrade request:</p><div class="code-block"><div class="code-block-title">Client Request</div><pre>GET /chat HTTP/1.1\nHost: server.example.com\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\nSec-WebSocket-Version: 13</pre></div><div class="code-block"><div class="code-block-title">Server Response</div><pre>HTTP/1.1 101 Switching Protocols\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=</pre></div><p>After this handshake, the connection transitions from HTTP to the WebSocket framing protocol.</p>'
    },
    {
      id: 'framing',
      number: '3',
      title: 'Data Framing',
      content: '<p>WebSocket uses a lightweight frame-based protocol:</p><div class="field-list"><div class="field-item"><span class="field-name">FIN bit</span><span class="field-detail">Indicates this is the final fragment of a message</span></div><div class="field-item"><span class="field-name">Opcode (4 bits)</span><span class="field-detail">Frame type: 0x1=text, 0x2=binary, 0x8=close, 0x9=ping, 0xA=pong</span></div><div class="field-item"><span class="field-name">Mask bit</span><span class="field-detail">Client-to-server frames must be masked (security measure)</span></div><div class="field-item"><span class="field-name">Payload length</span><span class="field-detail">7 bits, or extended to 16/64 bits for larger messages</span></div><div class="field-item"><span class="field-name">Masking key</span><span class="field-detail">4-byte XOR mask for client frames</span></div></div>'
    },
    {
      id: 'use-cases',
      number: '4',
      title: 'Use Cases',
      content: '<div class="key-points"><div class="key-point"><div class="key-point-title">Chat Applications</div><div class="key-point-text">Real-time messaging with instant delivery (Slack, Discord)</div></div><div class="key-point"><div class="key-point-title">Live Data Feeds</div><div class="key-point-text">Stock tickers, sports scores, IoT sensor data</div></div><div class="key-point"><div class="key-point-title">Multiplayer Games</div><div class="key-point-text">Low-latency game state synchronization</div></div><div class="key-point"><div class="key-point-title">Collaborative Editing</div><div class="key-point-text">Real-time document collaboration (Google Docs-style)</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Fette, I. and A. Melnikov, "The WebSocket Protocol", RFC 6455, December 2011.' },
    { number: '[2]', text: 'Fielding, R. and J. Reschke, "Hypertext Transfer Protocol (HTTP/1.1)", RFC 7230, June 2014.' }
  ]
},

{
  number: 4960,
  title: 'Stream Control Transmission Protocol',
  shortTitle: 'SCTP',
  authors: ['R. Stewart'],
  organization: 'Cisco',
  date: 'September 2007',
  status: 'Proposed Standard',
  category: 'transport',
  featured: true,
  obsoletedBy: null,
  obsoletes: 'RFC 2960',
  hero: {
    subtitle: 'A message-oriented transport protocol offering multi-streaming, multi-homing, and ordered/unordered delivery - features TCP and UDP lack.',
    color: 'orange',
    animation: 'handshake',
    animationData: {
      leftLabel: 'Endpoint A',
      rightLabel: 'Endpoint B',
      steps: [
        { label: 'INIT', from: 'left', description: 'Initiate association' },
        { label: 'INIT-ACK', from: 'right', description: 'Response with cookie' },
        { label: 'COOKIE-ECHO', from: 'left', description: 'Return the cookie' },
        { label: 'COOKIE-ACK', from: 'right', description: 'Association established' }
      ]
    }
  },
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      content: '<p>SCTP (Stream Control Transmission Protocol) is a transport-layer protocol that provides reliable, message-oriented delivery with support for multi-homing and multi-streaming. It was originally designed for telephony signaling (SS7 over IP) but has broader applications.</p><div class="callout callout-info"><p>SCTP combines the reliability of TCP with the message boundaries of UDP, while adding features neither provides: multiple independent streams within a single connection and seamless failover between network paths.</p></div>'
    },
    {
      id: 'features',
      number: '2',
      title: 'Key Features',
      content: '<div class="comparison-table"><div class="comparison-header"><div class="comparison-col">Feature</div><div class="comparison-col">TCP</div><div class="comparison-col">SCTP</div></div><div class="comparison-row"><div class="comparison-col">Message Boundaries</div><div class="comparison-col">No (byte stream)</div><div class="comparison-col">Yes (message-oriented)</div></div><div class="comparison-row"><div class="comparison-col">Multi-streaming</div><div class="comparison-col">No</div><div class="comparison-col">Yes (independent streams)</div></div><div class="comparison-row"><div class="comparison-col">Multi-homing</div><div class="comparison-col">No</div><div class="comparison-col">Yes (multiple IP addresses)</div></div><div class="comparison-row"><div class="comparison-col">Head-of-line Blocking</div><div class="comparison-col">Yes</div><div class="comparison-col">Per-stream only</div></div><div class="comparison-row"><div class="comparison-col">SYN Flood Protection</div><div class="comparison-col">No (SYN cookies workaround)</div><div class="comparison-col">Yes (4-way handshake with cookie)</div></div></div>'
    },
    {
      id: 'multi-streaming',
      number: '3',
      title: 'Multi-Streaming',
      content: '<p>A single SCTP association can carry multiple independent streams. A lost packet in one stream does not block delivery in other streams, solving TCP\'s head-of-line blocking problem.</p><div class="callout callout-note"><p>QUIC (RFC 9000) adopted SCTP\'s multi-streaming concept. WebRTC uses SCTP for its data channel, running SCTP over DTLS over UDP.</p></div>'
    },
    {
      id: 'multi-homing',
      number: '4',
      title: 'Multi-Homing',
      content: '<p>SCTP endpoints can have multiple IP addresses. If the primary path fails, traffic automatically switches to an alternate address without disrupting the connection.</p><div class="key-points"><div class="key-point"><div class="key-point-title">Heartbeat</div><div class="key-point-text">Periodic probes verify reachability of alternate paths</div></div><div class="key-point"><div class="key-point-title">Failover</div><div class="key-point-text">Automatic retransmission on alternate path after primary failure</div></div><div class="key-point"><div class="key-point-title">Telecom Use</div><div class="key-point-text">Critical for SS7 signaling where connection loss drops phone calls</div></div></div>'
    }
  ],
  references: [
    { number: '[1]', text: 'Stewart, R., "Stream Control Transmission Protocol", RFC 4960, September 2007.' },
    { number: '[2]', text: 'Stewart, R., et al., "Stream Control Transmission Protocol", RFC 2960, October 2000.' }
  ]
}

);
