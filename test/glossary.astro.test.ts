import zlib from 'node:zlib';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import GlossaryLetter from '../src/components/pages/GlossaryLetter.astro';
import GlossaryNav from '../src/components/pages/GlossaryNav.astro';
import { buildGlossaryModel, GLOSSARY_PAGE_MAX } from '../src/lib/glossary';
import { must } from './helpers';

const t = (id: string, term: string, extra: Record<string, unknown> = {}) => ({
  id,
  term,
  definition: `<p>${term} defined.</p>`,
  rfcs: [],
  usedBy: [],
  ...extra,
});
const container = await AstroContainer.create();

describe('glossary pages', () => {
  const model = buildGlossaryModel([t('arp', 'ARP', { usedBy: [826, 903] }), t('mac', 'MAC address', { eli5: "A device's name tag." })]);
  test('letter page: terms carry id anchors, nav marks the current letter, links point at RFC pages', async () => {
    const page = must(model.pages.find((p) => p.slug === 'm'));
    const h = await container.renderToString(GlossaryLetter, { props: { page, letters: model.letters } });
    expect(h).toContain('<dt id="mac">MAC address</dt>');
    expect(h).not.toContain('id="arp"');
    expect(h).toContain('A device&#39;s name tag.');
    expect(h).toMatch(/<a href="\/glossary\/m\/" aria-current="page"/);
    expect(h).toContain('href="/glossary/a/"');
    expect(h).toContain('<link rel="canonical" href="https://rfc.akl.run/glossary/m/">');
  });
  test('nav: letters without terms are not links', async () => {
    const h = await container.renderToString(GlossaryNav, { props: { letters: model.letters } });
    expect(h).toContain('href="/glossary/a/"');
    expect(h).not.toContain('href="/glossary/b/"');
  });

  test('scale: 20,000 terms stay within the 200 KB gz page budget', async () => {
    const words =
      'the packet header carries an address field which a router reads before it forwards the datagram toward its destination network'.split(
        ' ',
      );
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const sentence = (n: number) =>
      Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)] + Math.floor(rnd() * 90)).join(' ');
    // English-like initial-letter skew: a few letters hold a large share
    const letters = 'sssscccpppaaammmdddtttiiirrbbfgeoluhnwvk';
    const terms = Array.from({ length: 20000 }, (_, i) =>
      t(`term-${i}`, `${letters[Math.floor(rnd() * letters.length)]}${sentence(2)}`, {
        definition: `<p>${sentence(50)}</p><p>${sentence(30)}</p>`,
        eli5: sentence(25),
        usedBy: Array.from({ length: Math.floor(rnd() * 2000) }, (_, k) => k + 1),
      }),
    );
    const m = buildGlossaryModel(terms);
    expect(m.total).toBe(20000);
    expect(Math.max(...m.pages.map((p) => p.entries.length))).toBeLessThanOrEqual(GLOSSARY_PAGE_MAX);
    const worst = [...m.pages].sort((a, b) => b.entries.length - a.entries.length).slice(0, 3);
    for (const page of worst) {
      const h = await container.renderToString(GlossaryLetter, { props: { page, letters: m.letters } });
      expect(zlib.gzipSync(h, { level: 6 }).length).toBeLessThan(200 * 1024);
    }
  }, 60_000);
});
