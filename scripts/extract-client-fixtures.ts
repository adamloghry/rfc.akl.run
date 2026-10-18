/**
 * Regenerates the client-script markup fixtures in test/fixtures/html/ from a built site, so the
 * happy-dom tests exercise exactly the markup the Astro components emit.
 *
 *   npx astro build && node --import tsx scripts/extract-client-fixtures.ts [dist]
 *
 * Fixtures are committed; rerun this only when a component's markup contract changes.
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const out = path.join(process.cwd(), 'test', 'fixtures', 'html');

const page = (rel: string): string => fs.readFileSync(`${path.join(dist, rel === '.' ? 'index' : rel)}.html`, 'utf8');

/** First match of `re` in `html`, or a loud failure naming the fixture. */
function slice(name: string, html: string, re: RegExp): string {
  const m = re.exec(html);
  if (!m) throw new Error(`${name}: pattern ${re} not found in the built page`);
  return m[0];
}

/** Everything inside <body>, minus asset <script src> tags and the pre-paint inline script (data scripts stay). */
export function bodyOf(html: string): string {
  const body = slice('body', html, /<body[^>]*>([\s\S]*)<\/body>/)
    .replace(/^<body[^>]*>/, '')
    .replace(/<\/body>$/, '');
  return body.replace(/<script\b[^>]*\bsrc="[^"]*"[^>]*><\/script>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
}

const fixtures: Record<string, string> = {
  // Datasheet page with every reader feature: header search + theme toggle, level control, cite panel,
  // TOC, prose code, a packet figure and a sequence simulator (with a router failure branch).
  'rfc-903.html': bodyOf(page('rfc903')),
  // The standalone `code` viz figure.
  'code-fig.html': slice('code-fig', bodyOf(page('rfc1035')), /<figure[^>]*data-viz="code"[\s\S]*?<\/figure>/),
  // Atlas map: chips, canvas and caption.
  'atlas.html': slice('atlas', bodyOf(page('.')), /<div class="at-chips"[\s\S]*?<\/section>/),
  // Home-page hero search with the suggestion pills.
  'hero-search.html': slice('hero-search', bodyOf(page('.')), /<div class="at-hero-search"[\s\S]*?<\/div> <\/div>/),
  // Graph page form and stage.
  'graph.html': slice('graph', bodyOf(page('graph')), /<form class="graph-form"[\s\S]*?<noscript>/),
};

fs.mkdirSync(out, { recursive: true });
for (const [name, html] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(out, name), `${html.trim()}\n`);
  console.log(`${name}: ${html.length} bytes`);
}
