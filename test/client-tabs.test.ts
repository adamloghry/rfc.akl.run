// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init, tabForHash } from '../src/scripts/tabs';
import { click, el, mount, resetDocument, setUrl } from './dom-helpers';

const MARKUP = `
<div class="rt-tabs" data-tabs>
  <div class="tablist" role="tablist" hidden>
    <button role="tab" id="tab-text" data-tab="text" aria-controls="rfc-text" aria-selected="true">RFC text</button>
    <button role="tab" id="tab-eli5" data-tab="eli5" aria-controls="eli5" aria-selected="false" tabindex="-1">AI ELI5</button>
  </div>
  <section id="rfc-text" role="tabpanel" data-tab-panel="text"><span id="section-3">3</span><span id="section-3.2">3.2</span></section>
  <section id="eli5" role="tabpanel" data-tab-panel="eli5"><section id="packet-format"></section><span id="field-oper"></span><figure id="step-3"></figure></section>
</div>`;

let dispose: () => void = () => {};
const url = (hash = '') => `https://rfc.akl.run/rfc903${hash}`;
const start = (hash = '') => {
  resetDocument(url(hash));
  document.documentElement.removeAttribute('data-tab');
  mount(MARKUP);
  Element.prototype.scrollIntoView = vi.fn();
  dispose = init();
};
const selected = () => ['text', 'eli5'].find((k) => el(`#tab-${k}`).getAttribute('aria-selected') === 'true');
const hidden = () => ['text', 'eli5'].filter((k) => el(`[data-tab-panel="${k}"]`).hidden);
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});

describe('tabForHash', () => {
  beforeEach(() => mount(MARKUP));
  test('anchors inside the AI panel (and #eli5 itself) open AI ELI5; everything else opens RFC text', () => {
    for (const h of ['#eli5', '#packet-format', '#field-oper', '#step-3']) expect(tabForHash(document, h), h).toBe('eli5');
    for (const h of ['', '#', '#section-3', '#section-3.2', '#rfc-text', '#nope', '#%E0%A4%A'])
      expect(tabForHash(document, h), h).toBe('text');
  });
});

describe('tabs', () => {
  test('default: RFC text is selected, the AI panel hidden, the tab list revealed, nothing stored', () => {
    start();
    expect(el('[role="tablist"]').hidden).toBe(false);
    expect(selected()).toBe('text');
    expect(hidden()).toEqual(['eli5']);
    expect(document.documentElement.getAttribute('data-tab')).toBe('text');
    expect(el('[data-tabs]').classList.contains('tabs-on')).toBe(true);
    expect(el('#tab-text').tabIndex).toBe(0);
    expect(el('#tab-eli5').tabIndex).toBe(-1);
    expect(localStorage.length).toBe(0);
  });

  test.each(['#eli5', '#packet-format', '#field-oper', '#step-3'])('%s opens AI ELI5 on load', (hash) => {
    start(hash);
    expect(selected()).toBe('eli5');
    expect(hidden()).toEqual(['text']);
    expect(document.documentElement.getAttribute('data-tab')).toBe('eli5');
  });

  test('#section-3 stays on RFC text and scrolls to the heading', () => {
    start('#section-3');
    expect(selected()).toBe('text');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  test('clicking a tab switches and rewrites the hash with replaceState (#eli5, or none)', () => {
    start('#section-3');
    const replace = vi.spyOn(history, 'replaceState');
    click(el('#tab-eli5'));
    expect(selected()).toBe('eli5');
    expect(location.hash).toBe('#eli5');
    click(el('#tab-text'));
    expect(selected()).toBe('text');
    expect(location.hash).toBe('');
    expect(location.pathname).toBe('/rfc903');
    expect(replace).toHaveBeenCalledTimes(2);
  });

  test('arrow keys, Home and End move between tabs, wrap around, move focus and activate', () => {
    start();
    const key = (k: string) =>
      el('[role="tab"][aria-selected="true"]').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key('ArrowRight');
    expect(selected()).toBe('eli5');
    expect(document.activeElement?.id).toBe('tab-eli5');
    key('ArrowRight');
    expect(selected()).toBe('text');
    key('ArrowLeft');
    expect(selected()).toBe('eli5');
    key('Home');
    expect(selected()).toBe('text');
    key('End');
    expect(selected()).toBe('eli5');
    key('x');
    expect(selected()).toBe('eli5');
  });

  test('hashchange selects the tab and scrolls to the anchor', () => {
    start();
    setUrl(url('#packet-format'));
    window.dispatchEvent(new Event('hashchange'));
    expect(selected()).toBe('eli5');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    setUrl(url('#eli5'));
    window.dispatchEvent(new Event('hashchange'));
    expect(selected()).toBe('eli5');
    setUrl(url());
    window.dispatchEvent(new Event('hashchange'));
    expect(selected()).toBe('text');
  });

  test('a page without tabs is left alone; dispose removes the listeners', () => {
    resetDocument(url());
    mount('<p>nothing</p>');
    expect(init()()).toBeUndefined();
    mount('<div data-tabs><div role="tablist"></div></div>');
    expect(init()()).toBeUndefined();
    start();
    dispose();
    click(el('#tab-eli5'));
    expect(selected()).toBe('text');
  });
});
