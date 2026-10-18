import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';

/**
 * Every set:html in src/**\/*.astro, as "file :: expression". Only fields listed in HTML_FIELDS
 * (src/lib/sanitize-check.ts) are sanitize-checked, so a new set:html on content data must be added
 * to HTML_FIELDS first. Constants (PREPAINT, HASH_FORWARDER, NOSCRIPT, safeJson) are static or
 * JSON-escaped, and the others render hand-authored strings or escaped values.
 */
const ALLOWED = [
  // content fields (HTML_FIELDS)
  "components/rfc/Section.astro :: s.content || ''",
  'components/rfc/Section.astro :: s.plainLanguage',
  'components/rfc/RightRail.astro :: c.plainLanguage.summary',
  'components/rfc/RightRail.astro :: c.today',
  'components/rfc/IndexTier.astro :: summary',
  'components/rfc/IndexTier.astro :: plainLanguage',
  'components/pages/GlossaryLetter.astro :: t.definition',
  // generated / static / escaped by their builders
  'components/rfc/MetaList.astro :: factValueHtml(f.value, site)',
  'components/rfc/Datasheet.astro :: NOSCRIPT',
  'components/rfc/RfcText.astro :: rendered.html',
  'components/viz/SequenceSim.astro :: safeJson',
  'layouts/BaseLayout.astro :: PREPAINT',
  'pages/glossary/index.astro :: glossaryForwarder(exceptions)',
  'pages/index.astro :: HASH_FORWARDER',
].sort();

function astroFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? astroFiles(p) : p.endsWith('.astro') ? [p] : [];
  });
}

/** Expression after `set:html={`, up to the matching closing brace. */
function expressions(src: string): string[] {
  const out: string[] = [];
  for (let at = src.indexOf('set:html={'); at >= 0; at = src.indexOf('set:html={', at + 1)) {
    let i = at + 'set:html={'.length;
    const start = i;
    for (let depth = 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    out.push(src.slice(start, i).trim());
  }
  return out;
}

test('every set:html in src/ is on the allowlist', () => {
  const root = path.join(process.cwd(), 'src');
  const found = astroFiles(root)
    .flatMap((f) => expressions(fs.readFileSync(f, 'utf8')).map((e) => `${path.relative(root, f).split(path.sep).join('/')} :: ${e}`))
    .sort();
  const unlisted = found.filter((x) => !ALLOWED.includes(x));
  const stale = ALLOWED.filter((x) => !found.includes(x));
  assert.deepEqual(
    unlisted,
    [],
    `New set:html site(s). Content fields must be added to HTML_FIELDS in src/lib/sanitize-check.ts (so lint sanitizes them), then to ALLOWED in this test.`,
  );
  assert.deepEqual(stale, [], 'ALLOWED lists set:html sites that no longer exist; remove them.');
});
