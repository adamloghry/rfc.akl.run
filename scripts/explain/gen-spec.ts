/**
 * Regenerates the GENERATED blocks of scripts/explain/SPEC.md from the validator's own code, so the instruction
 * set cannot drift from what is enforced: HTML allowlist (read from src/lib/sanitize-check.ts and cross-checked against
 * checkHtml), the section-id vocabulary, the viz shapes, the tier depth table and the compact example.
 *
 * CLI: node --import tsx scripts/explain/gen-spec.ts [--check]
 *   (default) rewrites SPEC.md; --check exits 1 when SPEC.md is stale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkHtml } from '../../src/lib/sanitize-check';
import { isMain, MODEL, PROMPT_VERSION, SCHEMA_VERSION, SECTION_BOUNDS, TIERS, UNIT_SIZE, VIZ_MAX } from './lib';
import { GENERATED_VIZ_TYPES, MAX_TREE_DEPTH, MAX_TREE_NODES, VIZ_EXAMPLES } from './vizshape';
import { SECTION_IDS } from './vocab';

const HERE = path.dirname(import.meta.filename);
export const SPEC_FILE = path.join(HERE, 'SPEC.md');
export const EXAMPLE_FILE = path.join(HERE, 'example-compact.json');
const SANITIZER_SRC = path.join(HERE, '..', '..', 'src', 'lib', 'sanitize-check.ts');

/** Tags and attributes straight from the sanitizer's source, verified against its behaviour. */
export function sanitizerAllowlist(): { tags: string[]; attrs: string[] } {
  const src = fs.readFileSync(SANITIZER_SRC, 'utf8');
  const tagBlock = src.match(/const TAGS = new Set<string>\(([\s\S]*?)\.split\(' '\)/)?.[1];
  const attrBlock = src.match(/const ATTRS = new Set<string>\(\[([\s\S]*?)\]\)/)?.[1];
  if (!tagBlock || !attrBlock) throw new Error('gen-spec: cannot find TAGS/ATTRS in src/lib/sanitize-check.ts (did its layout change?)');
  const strings = (b: string) => [...b.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const tags = strings(tagBlock).join('').split(' ').filter(Boolean);
  const attrs = strings(attrBlock);
  // Cross-check by behaviour so a refactor of the source layout cannot silently produce a wrong list.
  const universeTags = [
    ...tags,
    ...'script style iframe object embed form input button textarea select option img svg math video audio canvas link meta base title head body html font center marquee h1 h2 h6 nav main section article aside header footer details summary dialog label'.split(
      ' ',
    ),
  ];
  for (const t of new Set(universeTags)) {
    const allowed = !checkHtml(`<${t}>x</${t}>`).some((p) => p.startsWith('tag not allowed'));
    if (allowed !== tags.includes(t))
      throw new Error(
        `gen-spec: tag <${t}> is ${allowed ? 'allowed' : 'rejected'} by checkHtml but ${tags.includes(t) ? 'listed' : 'not listed'} in the source`,
      );
  }
  const universeAttrs = [
    ...attrs,
    'style',
    'onclick',
    'onerror',
    'src',
    'srcset',
    'data-x',
    'target',
    'rel',
    'width',
    'height',
    'role',
    'tabindex',
  ];
  for (const a of new Set(universeAttrs)) {
    const allowed = !checkHtml(`<p ${a}="x">y</p>`).some((p) => p.startsWith('attribute not allowed'));
    const listed = attrs.includes(a);
    if (allowed !== listed)
      throw new Error(
        `gen-spec: attribute ${a} is ${allowed ? 'allowed' : 'rejected'} by checkHtml but ${listed ? 'listed' : 'not listed'} in the source`,
      );
  }
  return { tags, attrs };
}

const code = (xs: readonly string[]) => xs.map((x) => `\`${x}\``).join(', ');

export function generateBlocks(): Record<string, string> {
  const { tags, attrs } = sanitizerAllowlist();
  const blocks: Record<string, string> = {};

  blocks.version = `**Spec version:** \`promptVersion: "${PROMPT_VERSION}"\` (schema \`${SCHEMA_VERSION}\`, model \`${MODEL}\`). The merge records both versions in each file's \`provenance\`.`;

  blocks['section-ids'] =
    `Allowed ids (${SECTION_IDS.length}):\n\n${code(SECTION_IDS)}\n\nEscape hatch: \`section-<k>\` where k is a positive whole number (\`section-1\`, \`section-2\`). Use it only when no vocabulary id fits.`;

  blocks['html-allowlist'] = [
    'The sanitizer allows exactly these tags and attributes; anything else fails validation.',
    '',
    `- **Tags:** ${code(tags)}`,
    `- **Attributes:** ${code(attrs)}, and any \`aria-*\``,
    '- **`href`:** the sanitizer accepts `http:`, `https:`, `mailto:`, `/` and `#` targets, but for these explainers only links of the form `/rfc<number>` (for example `/rfc793`, optionally followed by `#section-id`) are accepted (see House style). No `style` attributes, no scripts, no HTML comments, no `<img>`, no `<h1>`/`<h2>` (the page supplies the headings; use `<h3>` inside a section only if you must).',
  ].join('\n');

  const vizParts = [
    'Allowed `type` values: ' +
      code(GENERATED_VIZ_TYPES) +
      '. Exact `data` shapes follow; optional fields are shown to document them, so omit what you do not need.',
    '',
  ];
  for (const t of GENERATED_VIZ_TYPES) {
    const ex = VIZ_EXAMPLES[t];
    vizParts.push(
      `### \`${t}\``,
      '',
      `Use for ${ex.use}`,
      '',
      '```json',
      JSON.stringify({ type: t, anchor: 'operation', caption: 'SHORT CAPTION', data: ex.data }, null, 2),
      '```',
      '',
    );
  }
  vizParts.push(
    `Limits: a \`tree\` has at most ${MAX_TREE_DEPTH} levels and ${MAX_TREE_NODES} nodes; a \`sequence\` has 2 to 5 lanes and at most 20 messages.`,
  );
  blocks['viz-shapes'] = vizParts.join('\n');

  const rows = TIERS.map((t) => {
    const [lo, hi] = SECTION_BOUNDS[t];
    return `| ${t} | ${UNIT_SIZE[t]} | ${lo} to ${hi} | ${VIZ_MAX[t]} |`;
  });
  blocks['tier-depth'] = ['| Tier | RFCs per work unit | Sections (enforced) | Max viz (enforced) |', '|---|---|---|---|', ...rows].join(
    '\n',
  );

  const example = fs.readFileSync(EXAMPLE_FILE, 'utf8').trimEnd();
  blocks['compact-example'] = `\`\`\`json\n${example}\n\`\`\``;
  return blocks;
}

const BLOCK = /<!-- BEGIN GENERATED ([\w-]+) -->\n([\s\S]*?)<!-- END GENERATED \1 -->/g;

/** Returns SPEC text with every GENERATED block replaced; throws when SPEC.md names a block this script does not generate. */
export function renderSpec(spec: string, blocks = generateBlocks()): string {
  const used = new Set<string>();
  const out = spec.replace(BLOCK, (_m, name: string) => {
    if (!(name in blocks)) throw new Error(`gen-spec: SPEC.md has unknown generated block "${name}"`);
    used.add(name);
    return `<!-- BEGIN GENERATED ${name} -->\n${blocks[name]}\n<!-- END GENERATED ${name} -->`;
  });
  for (const name of Object.keys(blocks)) if (!used.has(name)) throw new Error(`gen-spec: SPEC.md lacks the generated block "${name}"`);
  return out;
}

export function specIsFresh(): boolean {
  const cur = fs.readFileSync(SPEC_FILE, 'utf8');
  return renderSpec(cur) === cur;
}

if (isMain(import.meta.filename)) {
  const cur = fs.readFileSync(SPEC_FILE, 'utf8');
  const next = renderSpec(cur);
  if (process.argv.includes('--check')) {
    if (next !== cur) {
      console.error('scripts/explain/SPEC.md is stale: run `npm run explain:spec`');
      process.exit(1);
    }
    console.log('SPEC.md is up to date');
  } else if (next !== cur) {
    fs.writeFileSync(SPEC_FILE, next);
    console.log('SPEC.md updated');
  } else console.log('SPEC.md already up to date');
}
