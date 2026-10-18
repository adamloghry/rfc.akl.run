# Explainer generation spec

<!-- BEGIN GENERATED version -->
**Spec version:** `promptVersion: "explain-v1"` (schema `rfc-datasheet-v1`, model `claude-sonnet-5-5`). The merge records both versions in each file's `provenance`.
<!-- END GENERATED version -->

You write plain-language explainers for RFCs on rfc.akl.run. Each RFC in your work unit gets one JSON file. A validator checks the file's structure; you run it yourself and fix every error before you finish. **Nobody fact-checks the content afterwards, so accuracy is your job.** Only write what the RFC text supports.

Parts of this file are generated from the validator's own code (marked `GENERATED`). If this text and the validator ever disagree, the validator wins; run it and read its messages.

## 1. Your job

Your work unit looks like `{id, tier, rfcs: [{number, title, pages, textPath, contentPath, ...}]}`. For each RFC in it:

1. Read the existing content file at `contentPath` (JSON). It holds a short `summary`, an `eli5.summary`, `category`, `shortTitle` and some `questions`. These are kept as they are. Your explainer must agree with them.
2. Read the RFC text at `textPath` (see "Reading the RFC" below). Nothing outside the text is a source, except the metadata on your unit entry (`status`, `published`, `obsoletes`, `obsoletedBy`, `updates`, `updatedBy`).
3. Write `.work/explain/out/<number>.json`, using the Write tool. Use the plain RFC number, never zero-padded (`.work/explain/out/793.json`, not `0793.json`).
4. Run `node --import tsx scripts/explain/validate.ts <number>` (several numbers are fine). It prints `ok <number>` or a numbered list of errors. Fix the file and run it again until it prints `ok` for every RFC in your unit. **Do not finish until it passes.**
5. Reply with one JSON line per RFC: `{"rfc": 793, "ok": true}`, or `{"rfc": 793, "ok": false, "errors": ["..."]}` if you could not get it to pass after several honest attempts.

Never edit anything under `content/`, `src/` or `scripts/`. Write only to `.work/explain/out/`.
## 2. Reading the RFC

- `textPath` ends in `.txt` (plain text, with page headers and footers every 56 lines or so) for almost every RFC. Use the Read tool. `pdf` paths (RFCs 8, 9, 51, 418, 500, 530, 598) are PDFs: use Read with the `pages` parameter (at most 20 pages per request).
- Short RFCs (under about 40 pages): read the whole text.
- Long RFCs: read the abstract, table of contents and introduction first, then read the sections that carry the core of the design in parts of 400 to 700 lines (Read with `offset` and `limit`). For a 300-page RFC you do not need to read every page, but every statement you write must come from text you actually read. Skim appendices and long registries; summarize what they are for.
- **Large tier (over 150 pages):** work in parts. Read the table of contents, the abstract and the overview. Decide your 5 to 10 sections from the document's own structure. Read each part in turn, then write that part's section (or note its key facts) before reading the next, so earlier parts do not fall out of memory. Write the JSON once you have seen everything you plan to cite.
- Ignore page-break noise (running headers, "[Page 12]" footers, form feeds).

## 3. The output file

One JSON object with exactly these keys. All are required except `shortTitle`. No other key is allowed (the validator rejects extras).

```json
{
  "shortTitle": "UDP",
  "subtitle": "One-line hook, 10 to 160 characters, plain text.",
  "tags": ["Transport", "Datagrams"],
  "tldr": {
    "problem": "What problem the RFC addresses (plain text, 1 to 2 sentences).",
    "mechanism": "How it solves it (plain text, 1 to 2 sentences).",
    "outcome": "What resulted or why it matters, including if it was replaced (plain text).",
    "outcomeLabel": "Why it matters"
  },
  "eli5": { "summary": "<p>Two or three sentences a 10-year-old can follow.</p>" },
  "sections": [
    { "id": "introduction", "number": "1", "title": "Introduction", "content": "<p>...</p>", "eli5": "<p>...</p>" }
  ],
  "viz": [],
  "references": [{ "number": "[RFC768]", "text": "Postel, J., \"User Datagram Protocol\", STD 6, RFC 768, August 1980.", "rfc": 768 }],
  "facts": [{ "label": "Header size", "value": "8 bytes" }],
  "today": "<p>Where this stands now, using only what the text and the unit metadata say.</p>",
  "glossaryTerms": [],
  "glossary": ["udp", "port-number"],
  "questions": ["what is udp", "how big is the udp header"]
}
```

Field rules:

- `shortTitle`: optional, at most 28 characters (a common name such as `TCP`, `HTTP/2`). Omit it when the content file already has one; it is kept anyway.
- `subtitle`: plain text. `tags`: 1 to 4 short topic words in Title Case.
- `tldr`: four plain-text strings, no HTML. `outcomeLabel` is a short label such as `Why it matters`, `Why it faded`, `Status today` or `The catch`.
- `eli5.summary`: HTML. The content file's own `eli5.summary` is kept; still write a good one.
- `sections`: see sections 4 and 8. Each has `id` (from the fixed vocabulary), `number` (a string such as `"1"` or `"3.2"`; use the RFC's own section number when a section maps to one RFC section, otherwise a running count), `title` (plain text, 3 to 90 characters), `content` (HTML, at least 100 characters) and `eli5` (HTML, a 10-year-old's version).
- `viz`: see section 6. Use `[]` when nothing in the RFC is naturally visual.
- `references`: the RFC's most useful references (at most 20; `[]` is fine). `number` is the tag as the RFC prints it, `text` is the citation in plain text, and `rfc` is the plain issued RFC number when the reference is an RFC (omit `rfc` for anything else; never guess a number).
- `facts`: at most 6 `{label, value}` pairs of hard facts (sizes, ports, codes, limits). Every value must be in the RFC text. `[]` is fine.
- `today`: HTML, 1 to 3 sentences. State status plainly: if the unit metadata says the RFC is Historic, obsoleted (`obsoletedBy`) or updated (`updatedBy`), say so in the first sentence and link the replacement as `<a href='/9293/'>RFC 9293</a>`. Do not claim deployments, products or usage that the RFC text does not state.
- `questions`: 3 to 6 lowercase, search-style phrases without a question mark (`what is udp`, not `What is UDP?`). The merge adds them to the file's existing questions (6 in total at most).
- `glossary` and `glossaryTerms`: see section 9.

Do **not** include `provenance`, `status`, `date`, `obsoletes`, `obsoletedBy`, `lineage`, `hero`, `implementations`, `updated` or `number`. The merge step sets those, and the validator rejects them.

## 4. Section ids

Every section `id` comes from a fixed vocabulary so that page URLs (`/793/#header-format`) are stable. Pick the closest match for what the section is about. Use each id at most once per RFC. When nothing fits, use the escape hatch `section-1`, `section-2`, and so on.

<!-- BEGIN GENERATED section-ids -->
Allowed ids (54):

`introduction`, `motivation`, `background`, `overview`, `scope`, `terminology`, `concepts`, `architecture`, `design`, `requirements`, `message-format`, `packet-format`, `header-format`, `data-model`, `encoding`, `syntax`, `operation`, `procedures`, `state-machine`, `negotiation`, `connection-management`, `data-transfer`, `addressing`, `routing`, `naming`, `resolution`, `authentication`, `key-management`, `cryptography`, `error-handling`, `extensibility`, `options`, `algorithms`, `parameters`, `management`, `security-considerations`, `privacy-considerations`, `iana-considerations`, `deployment`, `operational-considerations`, `performance`, `interoperability`, `compatibility`, `migration`, `implementation-notes`, `conformance`, `history`, `changes`, `status`, `examples`, `test-vectors`, `discussion`, `related-work`, `summary`

Escape hatch: `section-<k>` where k is a positive whole number (`section-1`, `section-2`). Use it only when no vocabulary id fits.
<!-- END GENERATED section-ids -->

## 5. HTML

`content`, section `eli5`, `eli5.summary`, `today` and glossary `definition` are HTML. Everything else is plain text and is escaped on the page, so write `<` and `&` as plain characters there and use no tags.

Write HTML inside a JSON string with **single quotes for attributes** (`<a href='/793/'>`), so you do not have to escape double quotes. Escape newlines as `\n` or avoid them.

<!-- BEGIN GENERATED html-allowlist -->
The sanitizer allows exactly these tags and attributes; anything else fails validation.

- **Tags:** `p`, `a`, `em`, `strong`, `b`, `i`, `code`, `pre`, `ul`, `ol`, `li`, `br`, `sup`, `sub`, `abbr`, `kbd`, `blockquote`, `h3`, `h4`, `h5`, `span`, `div`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `caption`, `figure`, `figcaption`, `dl`, `dt`, `dd`, `hr`, `small`, `mark`
- **Attributes:** `class`, `href`, `title`, `id`, `colspan`, `rowspan`, `lang`, and any `aria-*`
- **`href`:** the sanitizer accepts `http:`, `https:`, `mailto:`, `/` and `#` targets, but for these explainers only links of the form `/<rfc number>/` are accepted (see House style). No `style` attributes, no scripts, no HTML comments, no `<img>`, no `<h1>`/`<h2>` (the page supplies the headings; use `<h3>` inside a section only if you must).
<!-- END GENERATED html-allowlist -->

House style for HTML:

- Wrap text in `<p>...</p>`. Use `<strong>` for the first mention of a key term, `<code>` for literals (field names, values, methods, opcodes).
- Callouts: `<div class='callout callout-info'><p>...</p></div>` (also `callout-note` and `callout-warning`). At most one per section.
- Key points: `<div class='key-points'><div class='key-point'><div class='key-point-title'>Title</div><div class='key-point-text'>Text</div></div></div>`. Use sparingly.
- Links: only to other RFCs, as `<a href='/793/'>RFC 793</a>` (plain number, trailing slash, no zero-padding). No external URLs. Link an RFC only when it is issued; the validator checks.
- No Markdown (`**bold**`, `#` headings, backtick fences, `- ` bullets). Use `<ul><li>` for lists.
- Write RFC numbers as `RFC 793`, never `RFC 0793`.

## 6. Visualisations (`viz`)

Add a viz only where the RFC itself defines something worth drawing: a header layout, a message exchange, a state machine, a comparison, a hierarchy. Do not decorate. Each entry:

```json
{ "type": "sequence", "anchor": "operation", "position": "after", "caption": "A SHORT CAPTION", "data": { } }
```

- `type`: one of the types below. **`sequence-sim` is not allowed.**
- `anchor`: the `id` of one of your own sections; the viz is placed with that section. `position` is `"before"` or `"after"` (default `"after"`).
- `caption`: plain text, 3 to 100 characters. Say "illustrative, not from the RFC" in the caption when you made up an example exchange or snippet rather than copying one from the RFC.
- `data`: exactly the fields shown for the type. Extra keys are errors.
- Every number, size or constant in a viz must appear in the RFC text. A `sequence` shows who sends what to whom in the order the RFC describes: `from` and `to` are lane `key`s (not labels). A `tree` is at most 4 levels deep (the root counts as level 1) with at most 40 nodes. A `state-machine` transition's `from`/`to` are state `key`s. Keys are lowercase kebab-case.
- Plain text inside viz data, no HTML (except in `code`, which is verbatim).

<!-- BEGIN GENERATED viz-shapes -->
Allowed `type` values: `packet`, `sequence`, `compare-table`, `contrast`, `key-grid`, `layers`, `timeline`, `state-machine`, `tree`, `opcodes`, `code`. Exact `data` shapes follow; optional fields are shown to document them, so omit what you do not need.

### `packet`

Use for a fixed-layout header or message the RFC draws as a bit diagram. `bits` is the field width; fields wrap at `width` (default 32).

```json
{
  "type": "packet",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "title": "Example header",
    "bytes": 8,
    "width": 32,
    "fields": [
      {
        "key": "src-port",
        "name": "Source Port",
        "bits": 16,
        "desc": "Port of the sender."
      },
      {
        "key": "dst-port",
        "name": "Destination Port",
        "bits": 16,
        "desc": "Port of the receiver."
      },
      {
        "key": "length",
        "name": "Length",
        "bits": 16,
        "desc": "Header plus data, in bytes.",
        "value": "8"
      },
      {
        "key": "checksum",
        "name": "Checksum",
        "bits": 16,
        "desc": "Error check over header and data."
      }
    ]
  }
}
```

### `sequence`

Use for a message exchange between 2 to 5 parties. `from` and `to` MUST be lane `key`s. `color` is blue, green or neutral.

```json
{
  "type": "sequence",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "lanes": [
      {
        "key": "client",
        "label": "Client"
      },
      {
        "key": "server",
        "label": "Server"
      }
    ],
    "messages": [
      {
        "from": "client",
        "to": "server",
        "label": "REQUEST",
        "color": "blue",
        "note": "What the client asks for."
      },
      {
        "from": "server",
        "to": "client",
        "label": "REPLY",
        "color": "green"
      }
    ]
  }
}
```

### `compare-table`

Use for a side-by-side comparison. Every row has exactly one cell per column; the first cell is the row header. `self: true` marks the row for this RFC.

```json
{
  "type": "compare-table",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "columns": [
      "Version",
      "Address size"
    ],
    "rows": [
      {
        "cells": [
          "IPv4",
          "32 bits"
        ]
      },
      {
        "cells": [
          "IPv6",
          "128 bits"
        ],
        "self": true
      }
    ]
  }
}
```

### `contrast`

Use for two things that mirror or oppose each other (request/reply, old/new). `joiner` is the word between them (default "inverse of").

```json
{
  "type": "contrast",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "left": {
      "title": "Request",
      "from": "client",
      "to": "server",
      "desc": "Asks a question."
    },
    "right": {
      "title": "Reply",
      "from": "server",
      "to": "client",
      "desc": "Answers it."
    },
    "joiner": "answered by"
  }
}
```

### `key-grid`

Use for 2 to 8 short key ideas or properties.

```json
{
  "type": "key-grid",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "items": [
      {
        "title": "Checksum",
        "text": "Detects corruption."
      },
      {
        "title": "Retry",
        "text": "Resends lost data."
      }
    ]
  }
}
```

### `layers`

Use for where the protocol sits in a stack (2 to 8 layers, top to bottom). `highlight: true` marks this RFC.

```json
{
  "type": "layers",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "layers": [
      {
        "label": "Application",
        "detail": "The program using the protocol"
      },
      {
        "label": "This protocol",
        "detail": "What the RFC defines",
        "highlight": true
      },
      {
        "label": "IP",
        "detail": "Delivers packets"
      }
    ]
  }
}
```

### `timeline`

Use for dated events (at most 10). `rfc`, when present, must be an issued RFC number; it becomes a link.

```json
{
  "type": "timeline",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "events": [
      {
        "year": 1981,
        "label": "Original specification",
        "rfc": 793
      },
      {
        "year": 2022,
        "label": "Consolidated specification"
      }
    ]
  }
}
```

### `state-machine`

Use for states and transitions the RFC defines. Transition `from` and `to` MUST be state `key`s.

```json
{
  "type": "state-machine",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "states": [
      {
        "key": "closed",
        "label": "CLOSED",
        "initial": true
      },
      {
        "key": "open",
        "label": "OPEN"
      }
    ],
    "transitions": [
      {
        "from": "closed",
        "to": "open",
        "label": "open request"
      },
      {
        "from": "open",
        "to": "closed",
        "label": "close request"
      }
    ]
  }
}
```

### `tree`

Use for a hierarchy such as a name space or object tree. At most 4 levels (the root counts as level 1) and 40 nodes.

```json
{
  "type": "tree",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "root": {
      "label": "root",
      "note": "optional note",
      "children": [
        {
          "label": "child A"
        },
        {
          "label": "child B",
          "children": [
            {
              "label": "grandchild"
            }
          ]
        }
      ]
    }
  }
}
```

### `opcodes`

Use for a table of codes, types or flags with their meaning (at most 24 rows). `highlight: true` marks the important one.

```json
{
  "type": "opcodes",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "items": [
      {
        "code": "1",
        "label": "REQUEST",
        "desc": "Asks for something."
      },
      {
        "code": "2",
        "label": "REPLY",
        "desc": "Answers a request.",
        "highlight": true
      }
    ]
  }
}
```

### `code`

Use for a short verbatim or illustrative text snippet (a message, ABNF, pseudo-code). Rendered escaped, so write it raw. If you wrote it as an illustration rather than copying the RFC, say so in `caption`.

```json
{
  "type": "code",
  "anchor": "operation",
  "caption": "SHORT CAPTION",
  "data": {
    "title": "Example message",
    "lang": "text",
    "code": "HELLO world\nBYE"
  }
}
```

Limits: a `tree` has at most 4 levels and 40 nodes; a `sequence` has 2 to 5 lanes and at most 20 messages.
<!-- END GENERATED viz-shapes -->

## 7. Depth per tier

Your unit's `tier` sets how much to write. The validator enforces the section count and the viz maximum; the rest is guidance.

<!-- BEGIN GENERATED tier-depth -->
| Tier | RFCs per work unit | Sections (enforced) | Max viz (enforced) |
|---|---|---|---|
| large | 1 | 5 to 10 | 8 |
| full | 2 | 5 to 8 | 6 |
| standard | 3 | 4 to 6 | 3 |
| compact | 6 | 3 to 4 | 1 |
<!-- END GENERATED tier-depth -->

- **Compact** (short, early or April 1st RFCs): a tight explainer. Short TL;DR, 3 to 4 sections of 1 to 2 short paragraphs, at most one viz and only if it clearly helps.
- **Standard**: 4 to 6 sections of 2 to 3 paragraphs each. A viz only when natural.
- **Full**: 5 to 8 sections. Cover the problem, the core design, the message or data formats, how it behaves, security considerations and the status today. Add viz where the RFC defines formats, exchanges or states.
- **Large**: the Full shape, 5 to 10 sections, written from a part-by-part read (see "Reading the RFC").
- Do not pad. A short RFC gets short sections. If the RFC has no security section, say what it says (or that it says nothing) rather than inventing one.

## 8. Writing rules

- **Audience:** a curious engineer who has not read the RFC. Plain language; define a term the first time you use it; prefer concrete examples over abstractions. Short sentences.
- **ELI5** (`eli5` on each section and `eli5.summary`): write for a 10-year-old. One everyday analogy, no jargon, two or three short sentences. It must still be true to the section it sits beside.
- **Every number, size, constant, port, code and date must appear in the RFC text** (or the unit metadata). If you are not sure, leave it out. Do not round, convert or compute new figures.
- **Do not invent** implementations, products, deployments, adoption statistics, history or later events that the RFC text does not state. "Where this stands now" comes from `status`, `obsoletedBy`, `updatedBy` and what the text says.
- **Status, stated plainly:** if the RFC is Historic, obsoleted or updated, say so in `today` and in `tldr.outcome`, and link the newer RFC (`/<number>/`). Do not present an obsoleted protocol as current.
- **April 1st RFCs** (`aprilFools: true` on the unit entry): these are humor. Say once, early, that it is an April 1st joke document, then explain the joke straight-faced and accurately, keeping its tone light. Note any real protocol it parodies or any real thing that came of it only if the text says so.
- Keep the RFC's own terminology and RFC 2119 words (MUST, SHOULD) where they matter; explain what they require.
- No filler ("In this section we will..."), no marketing words, no first person, no emojis, no em dashes used as decoration.
- `title`s are descriptive nouns ("The TCP Header"), not questions.

## 9. Glossary

- `glossary` lists the glossary term ids this explainer uses, at most 12. **Reuse existing ids first.** The existing terms are the files in `content/glossary/` (`ls content/glossary`, or `ls content/glossary | grep -i checksum`). An id is the file name without `.json`. Look before you invent: `udp`, `port-number`, `internet-checksum`, `datagram` and about 550 others exist.
- `glossaryTerms` defines **new** terms: at most 5, each `{ "id", "term", "definition", "eli5" }`. Only add a term the reader needs, that the RFC defines or depends on, and that is not already covered. A new id must also appear in `glossary`.
  - `id`: lowercase kebab-case and **singular** (`pseudo-header`, not `pseudo-headers`; `three-way-handshake`). It must not already exist in `content/glossary/`.
  - `term`: the display name (`Pseudo-header`).
  - `definition`: HTML in `<p>...</p>`, 30 to 700 characters, 1 to 3 sentences, complete sentences ending in a full stop.
  - `eli5`: plain text, one or two sentences.
- Every id in `glossary` must be an existing id or one you define in `glossaryTerms`.
- Terms that only one RFC ever uses are dropped later, so keep new terms general.

## 10. Examples to imitate

- **Full-tier exemplar:** `content/rfcs/9293.json` (TCP). Read it for voice, section rhythm, the way `viz` is anchored and how references are written. Note: it predates the fixed section-id vocabulary and includes keys you must not write (`provenance`, `status`, `lineage`, `implementations` and so on). Imitate its prose and structure, not its extra keys. Another good April 1st example: `content/rfcs/2324.json`.
- **A compact example**, abridged by hand (RFC 768, UDP). This exact file passes the validator for a Compact RFC:

<!-- BEGIN GENERATED compact-example -->
```json
{
  "shortTitle": "UDP",
  "subtitle": "The bare-bones way for programs to send each other independent messages over IP.",
  "tags": ["Transport", "Datagrams"],
  "tldr": {
    "problem": "Some programs want to send a message to another program with as little protocol machinery as possible, and do not need a reliable ordered stream.",
    "mechanism": "UDP adds an 8-byte header to each message with source and destination ports, a length and a checksum, and sends it as one IP datagram.",
    "outcome": "Delivery and duplicate protection are not guaranteed, so applications that need ordered, reliable delivery should use TCP instead.",
    "outcomeLabel": "The trade-off"
  },
  "eli5": {
    "summary": "<p>UDP is like dropping a postcard in the mailbox: it is quick and simple, but nobody promises it arrives or that postcards arrive in order.</p>"
  },
  "sections": [
    {
      "id": "introduction",
      "number": "1",
      "title": "Introduction",
      "content": "<p>RFC 768 defines the <strong>User Datagram Protocol</strong> (UDP), a datagram mode of communication that assumes the Internet Protocol (IP) underneath. It lets application programs send messages to other programs with a minimum of protocol mechanism.</p><p>The RFC is blunt about the trade-off: the protocol is transaction oriented, and delivery and duplicate protection are not guaranteed. Applications that need ordered, reliable delivery of streams of data should use TCP.</p>",
      "eli5": "<p>UDP lets one program toss a short message to another with almost no fuss. It does not promise the message gets there, so important things should use TCP instead.</p>"
    },
    {
      "id": "header-format",
      "number": "2",
      "title": "The UDP Header",
      "content": "<p>Every UDP message starts with a header of four 16-bit fields: <strong>Source Port</strong>, <strong>Destination Port</strong>, <strong>Length</strong> and <strong>Checksum</strong>, followed by the data octets. That makes the header 8 bytes.</p><p>The source port is optional: when it is not used, a value of zero is inserted. Length counts the header and the data in octets, so its minimum value is eight.</p><p>The checksum covers a pseudo header taken from the IP header (the source address, the destination address, the protocol and the UDP length), the UDP header and the data. If the computed checksum is zero it is sent as all ones, and a transmitted checksum of all zeros means the sender did not compute one.</p>",
      "eli5": "<p>The header is the address label on the postcard: who sent it, who it is for, how big it is, and a quick check number to spot if it got scrambled.</p>"
    },
    {
      "id": "operation",
      "number": "3",
      "title": "Ports, Interfaces and Uses",
      "content": "<p>A user interface should let a program create receive ports, receive data together with the source port and source address, and send a datagram by giving the data, the ports and the addresses. The UDP module must be able to read the source and destination addresses and the protocol field from the IP header.</p><p>UDP is protocol number 17 (21 octal) in the Internet Protocol. The RFC names two major uses of the protocol: the Internet Name Server and the Trivial File Transfer protocol.</p>",
      "eli5": "<p>Programs pick a numbered mailbox (a port) to listen on, and UDP hands each arriving postcard to the right mailbox.</p>"
    }
  ],
  "viz": [
    {
      "type": "packet",
      "anchor": "header-format",
      "position": "after",
      "caption": "USER DATAGRAM HEADER (RFC 768)",
      "data": {
        "title": "UDP header",
        "bytes": 8,
        "width": 32,
        "fields": [
          { "key": "src-port", "name": "Source Port", "bits": 16, "desc": "Optional; port of the sending process, zero if not used." },
          { "key": "dst-port", "name": "Destination Port", "bits": 16, "desc": "Port of the receiving process on the destination address." },
          { "key": "length", "name": "Length", "bits": 16, "desc": "Octets in header plus data; the minimum is eight." },
          { "key": "checksum", "name": "Checksum", "bits": 16, "desc": "One's complement checksum over a pseudo header, the header and the data." }
        ]
      }
    }
  ],
  "references": [
    { "number": "[1]", "text": "Postel, J., \"Internet Protocol\", RFC 760, January 1980.", "rfc": 760 },
    { "number": "[2]", "text": "Postel, J., \"Transmission Control Protocol\", RFC 761, January 1980.", "rfc": 761 },
    { "number": "[3]", "text": "Postel, J., \"Internet Name Server\", IEN 116, August 1979." }
  ],
  "facts": [
    { "label": "Header size", "value": "8 bytes" },
    { "label": "Header fields", "value": "4, each 16 bits" },
    { "label": "IP protocol number", "value": "17 (21 octal)" },
    { "label": "Delivery", "value": "Not guaranteed" }
  ],
  "today": "<p>RFC 768 is an Internet Standard and has not been obsoleted, so it is still the definition of UDP.</p>",
  "glossaryTerms": [
    {
      "id": "demultiplexing",
      "term": "Demultiplexing",
      "definition": "<p>Sorting arriving data to the right receiver, for example by looking at the destination port.</p>",
      "eli5": "Sorting the mail into the right mailbox when it arrives."
    }
  ],
  "glossary": ["udp", "port-number", "datagram", "connectionless", "internet-checksum", "pseudo-header", "demultiplexing"],
  "questions": ["what is udp", "how big is the udp header", "what is the udp checksum", "when should i use udp instead of tcp"]
}
```
<!-- END GENERATED compact-example -->

## 11. Before you finish

1. `node --import tsx scripts/explain/validate.ts <your numbers>` prints `ok <n>` for every RFC.
2. If it prints errors, each one names the field and what to change. Fix them and rerun. Typical fixes: a section id outside the vocabulary, a viz `anchor` that is not one of your section ids, a sequence `from`/`to` that is not a lane key, a disallowed tag or attribute, a link to a non-issued RFC, more than 5 new glossary terms, an `rfc` reference to a number that is not an issued RFC, a section count outside the tier's range.
3. Do not finish until every RFC in your unit passes, or you have made several real attempts and report the remaining errors.
