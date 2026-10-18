import fs from 'node:fs';
import zlib from 'node:zlib';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import Datasheet from '../src/components/rfc/Datasheet.astro';
import { buildSite, type RfcContent, type RfcRecord } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import { must } from './helpers';

/**
 * The AI-explainer rollout produces many thin explainers: no viz, no facts, no tl;dr, no lineage, no
 * references, no glossary / "today" / implementations. The Datasheet must render those without empty
 * boxes or dangling headings, with a correct table of contents and within the page budget.
 */
const site = buildSite({
  index: parseIndex(fs.readFileSync('test/fixtures/rfc-index.sample.xml', 'utf8')),
  contentDir: 'test/fixtures/content',
  buildDate: new Date('2026-10-15'),
});
const container = await AstroContainer.create();
const render = (rfc: RfcRecord) => container.renderToString(Datasheet, { props: { rfc, site } });
const gz = (s: string) => zlib.gzipSync(s, { level: 6 }).length;
const EXPLAINER_BUDGET = 60 * 1024; // scripts/check-dist.ts BUDGET.explainer

const bare = (content: RfcContent): RfcRecord => ({
  ...must(site.rfcs.get(5952)),
  tier: 'explainer',
  content,
  obsoletes: [],
  updates: [],
  obsoletedBy: [],
  updatedBy: [],
  journeys: [],
  mentionedIn: [],
  isNew: false,
  categoryReviewed: true,
});
const draft = { source: 'llm-draft', model: 'claude-sonnet-5-5', reviewedBy: null, promptVersion: 'p1', schemaVersion: '1' };
const sec = (id: string, title: string, text: string) => ({ id, title, content: `<p>${text}</p>` });

const compact = bare({
  number: 5952,
  summary: '<p>A short note.</p>',
  sections: [
    sec('what-it-is', 'What it is', 'A single sentence about the thing.'),
    sec('how-it-works', 'How it works', 'Another short sentence.'),
    sec('why-it-matters', 'Why it matters', 'A last short sentence.'),
  ],
  provenance: draft,
});
const standard = bare({
  number: 5952,
  summary: '<p>Describes a thing.</p>',
  tldr: { problem: 'P', mechanism: 'M', outcome: 'O' },
  plainLanguage: { summary: '<p>Like a mailbox.</p>' },
  sections: [1, 2, 3, 4, 5].map((i) => ({ ...sec(`part-${i}`, `Part ${i}`, `Body of part ${i}.`), plainLanguage: `<p>Story ${i}.</p>` })),
  references: [{ number: '[1]', text: 'Postel, J., "Internet Protocol", RFC 791.', rfc: 791 }],
  glossary: ['mac-address', 'no-such-term'],
  provenance: draft,
});

const EMPTY_BOX = /<(div|section|aside|nav|dl|ul|ol|details|figure|p)\b[^>]*>\s*<\/\1>/g;

/** Sections of the main column: [id, text outside the heading]. */
function bodies(html: string): [string, string][] {
  return [...html.matchAll(/<section class="sec" id="([^"]+)">([\s\S]*?)<\/section>/g)].map(([, id, inner]) => [
    id as string,
    (inner as string)
      .replace(/<h2[\s\S]*?<\/h2>/, '')
      .replace(/<[^>]*>/g, '')
      .trim(),
  ]);
}
// The ISO Plain Language panel (the RFC text panel has its own contents rail).
const aiPanel = (html: string) => html.slice(html.indexOf('id="plain-language"'));
const tocOf = (html: string, cls: string) =>
  [
    ...(new RegExp(`<nav class="${cls}"[^>]*>([\\s\\S]*?)</nav>`).exec(html)?.[1] ?? '').matchAll(
      /<a href="#([^"]+)"[^>]*><span class="toc-n">([^<]*)<\/span>([^<]*)<\/a>/g,
    ),
  ].map((m) => [m[1], m[2], m[3]]);

describe.each([
  ['compact', compact, 3, 14 * 1024],
  ['standard', standard, 5, 20 * 1024],
] as const)('%s explainer', (_name, rfc, count, budget) => {
  test('renders without empty boxes, dangling headings or placeholder text', async () => {
    const h = await render(rfc);
    const main = /<main[\s\S]*<\/main>/.exec(h)?.[0] ?? '';
    expect(main.length).toBeGreaterThan(0);
    expect(main.match(EMPTY_BOX) ?? []).toEqual([]);
    const secs = bodies(h);
    expect(secs.filter(([id]) => id !== 'references')).toHaveLength(count);
    for (const [id, text] of secs) expect(text.length, `section ${id} has a body`).toBeGreaterThan(0);
    expect(h).not.toMatch(/undefined|null|\[object Object\]/);
    expect(h).not.toContain('class="viz');
  });

  test('table of contents: one entry per rendered section, numbered in order, every target exists', async () => {
    const h = aiPanel(await render(rfc));
    const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const refs = bodies(h).some(([id]) => id === 'references') ? 1 : 0;
    for (const cls of ['toc', 'toc-disclosure']) {
      const toc =
        cls === 'toc'
          ? tocOf(h, 'toc')
          : [
              ...(/<details class="toc-disclosure">[\s\S]*?<\/details>/.exec(h)?.[0] ?? '').matchAll(
                /<a href="#([^"]+)"[^>]*><span class="toc-n">([^<]*)<\/span>([^<]*)<\/a>/g,
              ),
            ].map((m) => [m[1], m[2], m[3]]);
      expect(toc, cls).toHaveLength(count + refs);
      toc.forEach(([id, n], i) => {
        expect(n).toBe(String(i + 1));
        expect(ids, `#${id} target`).toContain(id);
      });
    }
  });

  test('stays within the explainer page budget (and well under it for thin pages)', async () => {
    const g = gz(await render(rfc));
    expect(g).toBeLessThan(EXPLAINER_BUDGET);
    expect(g).toBeLessThan(budget);
  });
});

describe('compact specifics', () => {
  test('no tl;dr, lineage, facts, references, glossary, today, implementations or reading-level control', async () => {
    const h = await render(compact);
    for (const absent of [
      'class="tldr"',
      'class="lineage"',
      'id="references"',
      'GLOSSARY ON THIS PAGE',
      "WHERE YOU'LL MEET IT TODAY",
      'IMPLEMENTATIONS',
      'MENTIONED IN',
      'PART OF JOURNEY',
      'level-ctl',
    ])
      expect(h, absent).not.toContain(absent);
    expect(h).toContain('Draft · machine-assisted, not yet reviewed');
    expect(h).toContain('<meta name="rfc-tier" content="explainer">');
    expect(h).toContain('rfc.akl.run/rfc5952#what-it-is'); // permalink note points at the first section
  });

  test('without any rail content the right column is dropped and the grid collapses', async () => {
    const h = await render({ ...compact, content: { ...compact.content, provenance: undefined } });
    expect(h).not.toContain('rail-right');
    expect(h).toContain('body-grid no-right');
    expect(await render(compact)).toContain('rail-right'); // the draft note keeps it
  });

  test('sections with no prose and no diagram are not rendered, and not in the TOC', async () => {
    const withEmpty = bare({
      ...compact.content,
      sections: [sec('a', 'A', 'Text A.'), { id: 'empty', title: 'Empty heading', content: '  <p> </p> ' }, sec('b', 'B', 'Text B.')],
    });
    const h = await render(withEmpty);
    expect(h).not.toContain('Empty heading');
    expect(h).not.toContain('id="empty"');
    expect(tocOf(h, 'toc').map((t) => [t[0], t[1]])).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
    expect(bodies(h).map(([id]) => id)).toEqual(['a', 'b']);
  });

  test('a section kept alive only by a diagram renders; an empty tl;dr and blank references vanish', async () => {
    const h = await render(
      bare({
        number: 5952,
        sections: [{ id: 'fig', title: 'Figure', content: '' }, sec('t', 'T', 'Text.')],
        viz: [{ type: 'code', anchor: 'fig', title: 'x', code: 'hello' }],
        tldr: { problem: ' ', mechanism: '', outcome: '<p></p>' },
        references: [{ text: '  ' }],
      }),
    );
    expect(h).toContain('id="fig"');
    expect(h).not.toContain('class="tldr"');
    expect(h).not.toContain('id="references"');
  });
});

describe('standard specifics', () => {
  test('tl;dr, references, reading levels, glossary chips on the letter pages', async () => {
    const h = await render(standard);
    expect(h).toContain('class="tldr"');
    expect(h).toContain('id="references"');
    expect(h).toContain('level-ctl');
    expect(h).toContain('GLOSSARY ON THIS PAGE');
    expect(h).toContain('href="/glossary/m#mac-address"');
    expect(h).not.toContain('no-such-term');
    expect(tocOf(h, 'toc').at(-1)).toEqual(['references', '6', 'References']);
  });
});
