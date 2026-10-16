import { describe, test, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import NotFound from '../src/pages/404.astro';
import Graph from '../src/pages/graph/index.astro';
import Question from '../src/pages/contribute/question/index.astro';
import AreaCard from '../src/components/pages/AreaCard.astro';
import IndexList from '../src/components/pages/IndexList.astro';
import CovTable from '../src/components/pages/CovTable.astro';
import Gallery from '../src/components/pages/Gallery.astro';

const container = await AstroContainer.create();
const render = (c: any, props?: any) => container.renderToString(c, { props });
const rec = (n: number) => ({ number: n, title: `Title ${n}` });

describe('secondary pages', () => {
  test('404: noindex, go-to-RFC form and inline script', async () => {
    const h = await render(NotFound);
    expect(h).toMatch(/<meta name="robots" content="noindex, follow">/);
    expect(h).toContain('id="goto-form"');
    expect(h).toContain("location.href='/'+n+'/'");
    expect(h).toContain('class="pal-warm"');
  });

  test('graph: hash-route meta, stage, form, noscript', async () => {
    const h = await render(Graph);
    expect(h).toMatch(/<meta name="rfc-hash-route" content="1">/);
    expect(h).toContain('id="graph"');
    expect(h).toContain('id="graph-form"');
    expect(h).toContain('<noscript>');
  });

  test('contribute/question: meta refresh to the issue template, noindex', async () => {
    const h = await render(Question);
    expect(h).toMatch(/http-equiv="refresh" content="0; url=https:\/\/github\.com\/adamloghry\/rfc\.akl\.run\/issues\/new\?template=question\.yml"/);
    expect(h).toContain('<meta name="robots" content="noindex">');
    expect(h).toContain('href="https://rfc.akl.run/contribute/"');
  });

  test('area card: counts and coverage bar', async () => {
    const list = [{ tier: 'index' }, { tier: 'summary' }, { tier: 'explainer' }, { tier: 'interactive' }];
    const h = await render(AreaCard, { cat: { key: 'core', name: 'Core' }, list });
    expect(h).toContain('href="/areas/core/"');
    expect(h).toContain('4 RFCs');
    expect(h).toContain('width:75%');
    expect(h).toContain('2 explainers · 1 summaries · 75% covered');
  });

  test('index list: flat under 300, <details> per 1000 block above', async () => {
    const small = await render(IndexList, { list: [rec(2), rec(1)] });
    expect(small).toContain('<ul class="idx-list">');
    expect(small.indexOf('RFC 1 ·')).toBeLessThan(small.indexOf('RFC 2 ·'));
    const big = await render(IndexList, { list: Array.from({ length: 2500 }, (_, i) => rec(i + 1)) });
    expect((big.match(/<details/g) || []).length).toBe(3);
    expect(big).toContain('RFC 2500 · Title 2500');
    expect(big).not.toMatch(/<details[^>]* open/);
  });

  test('coverage table: row per entry with covered percentage', async () => {
    const h = await render(CovTable, { first: 'Area', rows: [['Core', { total: 4, index: 1, summary: 1, explainer: 1, interactive: 1 }, '/areas/core/'], ['1980s', { total: 0, index: 0, summary: 0, explainer: 0, interactive: 0 }, null]] });
    expect(h).toContain('<a href="/areas/core/">Core</a>');
    expect(h).toContain('<td>75.0%</td>');
    expect(h).toContain('<td>0.0%</td>');
  });

  test('viz gallery: an item for each of the 12 types with live samples', async () => {
    const h = await render(Gallery);
    for (const t of ['packet', 'sequence-sim', 'sequence', 'compare-table', 'contrast', 'key-grid', 'layers', 'timeline', 'state-machine', 'tree', 'opcodes', 'code']) {
      expect(h).toContain(`data-gallery="${t}"`);
    }
    expect(h).toContain('class="viz viz-packet"');
    expect(h).toContain('Live example: see');
  });
});
