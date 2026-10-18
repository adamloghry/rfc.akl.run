import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import AreaCard from '../src/components/pages/AreaCard.astro';
import IndexList from '../src/components/pages/IndexList.astro';
import NotFound from '../src/pages/404.astro';
import Graph from '../src/pages/graph/index.astro';

const container = await AstroContainer.create();
const render = (c: Parameters<typeof container.renderToString>[0], props?: Record<string, unknown>) =>
  container.renderToString(c, { props });
const rec = (n: number) => ({ number: n, title: `Title ${n}` });

describe('secondary pages', () => {
  test('404: noindex, go-to-RFC form and inline script', async () => {
    const h = await render(NotFound);
    expect(h).toMatch(/<meta name="robots" content="noindex, follow">/);
    expect(h).toContain('id="goto-form"');
    expect(h).toContain("location.assign('/rfc'+n)");
    expect(h).toContain('class="pal-warm"');
  });

  test('graph: hash-route meta, stage, form, noscript', async () => {
    const h = await render(Graph);
    expect(h).toMatch(/<meta name="rfc-hash-route" content="1">/);
    expect(h).toContain('id="graph"');
    expect(h).toContain('id="graph-form"');
    expect(h).toContain('<noscript>');
  });

  test('area card: counts and coverage bar', async () => {
    const list = [{ tier: 'index' }, { tier: 'summary' }, { tier: 'explainer' }, { tier: 'interactive' }];
    const h = await render(AreaCard, { cat: { key: 'core', name: 'Core' }, list });
    expect(h).toContain('href="/areas/core"');
    expect(h).toContain('4 RFCs');
    expect(h).not.toContain('cov-bar');
    expect(h).toContain('2 with ISO Plain Language · 1 summaries');
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
});
