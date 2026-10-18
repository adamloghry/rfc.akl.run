import fs from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import AiNotice from '../src/components/rfc/AiNotice.astro';
import Datasheet from '../src/components/rfc/Datasheet.astro';
import IndexTier from '../src/components/rfc/IndexTier.astro';
import RfcText from '../src/components/rfc/RfcText.astro';
import { describe as describeRfc, modelFamily } from '../src/components/rfc/util';
import { buildSite, type RfcRecord } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import { parseRfcFile } from '../src/lib/rfc-text';
import { must } from './helpers';

const site = buildSite({
  index: parseIndex(fs.readFileSync('test/fixtures/rfc-index.sample.xml', 'utf8')),
  contentDir: 'test/fixtures/content',
  buildDate: new Date('2026-10-15'),
});
const container = await AstroContainer.create();
const r903 = must(site.rfcs.get(903));
const withProv = (rfc: RfcRecord, provenance: Record<string, unknown> | undefined): RfcRecord => ({
  ...rfc,
  content: { ...(rfc.content || {}), provenance },
});
const page = (rfc: RfcRecord, file?: ReturnType<typeof parseRfcFile> | null) =>
  container.renderToString(Datasheet, { props: { rfc, site, file } });
const notice = (rfc: RfcRecord) => container.renderToString(AiNotice, { props: { rfc } });

describe('RFC page tabs', () => {
  test('tab list, tabs and panels are wired together; RFC text first, then ISO Plain Language', async () => {
    const h = await page(r903);
    expect(h).toMatch(/<div class="tablist" role="tablist"[^>]* hidden>/);
    expect(h).toMatch(/<button[^>]*role="tab"[^>]*id="tab-text"[^>]*aria-controls="rfc-text"[^>]*aria-selected="true"/);
    expect(h).toMatch(
      /<button[^>]*role="tab"[^>]*id="tab-plain-language"[^>]*aria-controls="plain-language"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    );
    expect(h).toContain('>RFC text<');
    expect(h).toContain('>ISO Plain Language<');
    expect(h).toMatch(/<section id="rfc-text"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-text"/);
    expect(h).toMatch(/<section id="plain-language"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-plain-language"/);
    expect(h.indexOf('id="rfc-text"')).toBeLessThan(h.indexOf('id="plain-language"'));
    // no-JS: both panels are in the page, each with its h2
    expect(h).toMatch(/<h2 class="panel-h">RFC text<\/h2>/);
    expect(h).toMatch(/<h2 class="panel-h">ISO Plain Language<\/h2>/);
    // the datasheet band stays on top of the tabs
    expect(h.indexOf('class="band"')).toBeLessThan(h.indexOf('role="tablist"'));
  });

  test('the RFC text is in the HTML: normalized, linked, with a contents rail', async () => {
    const h = await page(r903);
    expect(h).toContain('<pre class="rt-pre"');
    expect(h).toContain('A Reverse Address Resolution Protocol');
    expect(h).not.toContain('\f');
    expect(h).not.toMatch(/\[Page \d+\]/);
    expect(h).toContain('id="section-iii"');
    expect(h).toMatch(/<nav class="toc rt-toc"[^>]*><a href="#section-status-of-this-memo"/);
    expect(h).toMatch(/<details class="toc-disclosure"><summary>Contents<\/summary>/);
    expect(h).toContain('View on rfc-editor.org ↗');
    expect(h).toContain('href="https://www.rfc-editor.org/rfc/rfc903.html"');
    expect(h).toContain('On rfc-editor.org ↗');
    // RFC 903 mentions RFC 826 elsewhere in the fixture index (issued) but not itself as a link
    expect(h).not.toContain('<a href="/rfc903">RFC 903</a>\n');
  });

  test('level switch is renamed', async () => {
    const h = await page(r903);
    expect(h).toContain('Plain language<span>simpler</span>');
    expect(h).toContain('In depth<span>default</span>');
    expect(h).not.toContain('Explained');
  });

  test('the AI panel starts with the notice, before the TL;DR and the sections', async () => {
    const h = await page(r903);
    const ai = h.slice(h.indexOf('id="plain-language"'));
    expect(ai.indexOf('class="ai-note"')).toBeGreaterThan(-1);
    if (ai.includes('class="tldr"')) expect(ai.indexOf('class="ai-note"')).toBeLessThan(ai.indexOf('class="tldr"'));
    expect(ai.indexOf('class="ai-note"')).toBeLessThan(ai.indexOf('class="sec"'));
  });

  test('the obsoleted banner is page-level, above the tabs', async () => {
    const h = await page({ ...r903, obsoletedBy: [951] });
    expect(h.indexOf('class="obs-banner"')).toBeGreaterThan(h.indexOf('class="band"'));
    expect(h.indexOf('class="obs-banner"')).toBeLessThan(h.indexOf('role="tablist"'));
  });

  test('section ids shared with the AI panel are renamed in the RFC text', async () => {
    const file = { note: null, body: 'x\n\n1.  Intro\n\n   See Section 1.\n' };
    const rfc = { ...r903, content: { ...r903.content, sections: [{ id: 'section-1', title: 'One', content: '<p>x</p>' }], viz: [] } };
    const h = await page(rfc, file);
    expect(h).toContain('id="text-section-1"');
    expect(h.match(/ id="section-1"/g)).toHaveLength(1);
  });

  test('PDF-converted texts get a note and link to the PDF; a missing text says so', async () => {
    const pdf = await page(
      r903,
      parseRfcFile("[rfc.akl.run: converted from the RFC Editor's PDF edition; may contain conversion errors]\n\nBody text\n"),
    );
    expect(pdf).toMatch(/converted from the RFC Editor(&#39;|')s PDF edition/);
    expect(pdf).toContain('href="https://www.rfc-editor.org/rfc/rfc903.pdf"');
    expect(pdf).toContain('Body text');
    const none = await container.renderToString(RfcText, { props: { rfc: r903, site, file: null } });
    expect(none).toContain('is not included in this build');
    expect(none).not.toContain('<pre');
    expect(none).toContain('no-toc');
  });

  test('IndexTier carries the RFC text panel only when asked', async () => {
    const r = must(site.rfcs.get(5952));
    expect(await container.renderToString(IndexTier, { props: { rfc: r, site } })).not.toContain('id="rfc-text"');
    expect(await container.renderToString(IndexTier, { props: { rfc: r, site, withText: true } })).toContain('id="rfc-text"');
  });
});

describe('AI notice', () => {
  test.each([
    ['claude-sonnet-5-5', 'Claude Sonnet'],
    ['claude-haiku-4-5', 'Claude Haiku'],
    ['claude-opus-4-1-20250805', 'Claude Opus'],
  ])('model %s', async (model, family) => {
    const h = await notice(withProv(r903, { source: 'llm-draft', model, reviewedBy: null }));
    expect(h).toContain('<strong>AI-generated explainer.</strong>');
    expect(h).toContain(
      `Written by Claude (${family}) from the RFC text and not reviewed by a human. It may contain mistakes. The RFC text is the authoritative source.`,
    );
    expect(h).toContain('role="note"');
  });
  test('unknown or missing model, and human-written content', async () => {
    expect(await notice(withProv(r903, { source: 'llm-draft', model: 'mystery-1' }))).toContain('Written by Claude from the RFC text');
    expect(await notice(withProv(r903, undefined))).toContain('AI-generated explainer.');
    const human = await notice(withProv(r903, { source: 'human', reviewedBy: 'akl' }));
    expect(human).not.toContain('AI-generated');
    expect(human).toContain('authoritative');
  });
  test('modelFamily', () => {
    expect(modelFamily('claude-3-5-haiku-20241022')).toBe('Claude Haiku');
    expect(modelFamily(undefined)).toBe('');
  });
});

describe('meta description leads with the RFC', () => {
  test('title, status, date and the RFC Editor abstract come before anything about explainers', () => {
    const d = describeRfc({ ...r903, abstract: 'This RFC suggests a method for workstations to find addresses.' });
    expect(d).toMatch(/^RFC 903: /);
    expect(d).toContain('This RFC suggests a method');
    expect(d.length).toBeLessThanOrEqual(200);
    expect(describeRfc({ ...r903, abstract: 'x '.repeat(200) })).toMatch(/…$/);
    expect(describeRfc({ ...r903, abstract: null })).toContain('The original RFC text, with an optional ISO Plain Language explainer.');
    expect(describeRfc({ ...r903, abstract: null, content: null })).toMatch(/The original RFC text\.$/);
  });
});
