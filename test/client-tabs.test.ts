// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init, tabForHash } from '../src/scripts/tabs';
import { click, el, mount, resetDocument, setUrl } from './dom-helpers';

const MARKUP = `
<div class="rt-tabs" data-tabs>
  <div class="tablist" role="tablist" hidden>
    <button role="tab" id="tab-text" data-tab="text" aria-controls="rfc-text" aria-selected="true">RFC text</button>
    <button role="tab" id="tab-plain-language" data-tab="plain-language" aria-controls="plain-language" aria-selected="false" tabindex="-1">ISO Plain Language</button>
  </div>
  <section id="rfc-text" role="tabpanel" data-tab-panel="text"><span id="section-3">3</span><span id="section-3.2">3.2</span></section>
  <section id="plain-language" role="tabpanel" data-tab-panel="plain-language"><section id="packet-format"></section><span id="field-oper"></span><figure id="step-3"></figure></section>
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
const selected = () => ['text', 'plain-language'].find((k) => el(`#tab-${k}`).getAttribute('aria-selected') === 'true');
const hidden = () => ['text', 'plain-language'].filter((k) => el(`[data-tab-panel="${k}"]`).hidden);
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});

describe('tabForHash', () => {
  beforeEach(() => mount(MARKUP));
  test('anchors inside the AI panel (and #plain-language itself) open ISO Plain Language; everything else opens RFC text', () => {
    for (const h of ['#plain-language', '#packet-format', '#field-oper', '#step-3'])
      expect(tabForHash(document, h), h).toBe('plain-language');
    for (const h of ['', '#', '#section-3', '#section-3.2', '#rfc-text', '#nope', '#%E0%A4%A'])
      expect(tabForHash(document, h), h).toBe('text');
  });
});

describe('tabs', () => {
  test('default: RFC text is selected, the AI panel hidden, the tab list revealed, nothing stored', () => {
    start();
    expect(el('[role="tablist"]').hidden).toBe(false);
    expect(selected()).toBe('text');
    expect(hidden()).toEqual(['plain-language']);
    expect(document.documentElement.getAttribute('data-tab')).toBe('text');
    expect(el('[data-tabs]').classList.contains('tabs-on')).toBe(true);
    expect(el('#tab-text').tabIndex).toBe(0);
    expect(el('#tab-plain-language').tabIndex).toBe(-1);
    expect(localStorage.length).toBe(0);
  });

  test.each(['#plain-language', '#packet-format', '#field-oper', '#step-3'])('%s opens ISO Plain Language on load', (hash) => {
    start(hash);
    expect(selected()).toBe('plain-language');
    expect(hidden()).toEqual(['text']);
    expect(document.documentElement.getAttribute('data-tab')).toBe('plain-language');
  });

  test('#section-3 stays on RFC text and scrolls to the heading', () => {
    start('#section-3');
    expect(selected()).toBe('text');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  test('clicking a tab switches and rewrites the hash with replaceState (#plain-language, or none)', () => {
    start('#section-3');
    const replace = vi.spyOn(history, 'replaceState');
    click(el('#tab-plain-language'));
    expect(selected()).toBe('plain-language');
    expect(location.hash).toBe('#plain-language');
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
    expect(selected()).toBe('plain-language');
    expect(document.activeElement?.id).toBe('tab-plain-language');
    key('ArrowRight');
    expect(selected()).toBe('text');
    key('ArrowLeft');
    expect(selected()).toBe('plain-language');
    key('Home');
    expect(selected()).toBe('text');
    key('End');
    expect(selected()).toBe('plain-language');
    key('x');
    expect(selected()).toBe('plain-language');
  });

  test('hashchange selects the tab and scrolls to the anchor', () => {
    start();
    setUrl(url('#packet-format'));
    window.dispatchEvent(new Event('hashchange'));
    expect(selected()).toBe('plain-language');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    setUrl(url('#plain-language'));
    window.dispatchEvent(new Event('hashchange'));
    expect(selected()).toBe('plain-language');
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
    click(el('#tab-plain-language'));
    expect(selected()).toBe('text');
  });
});
