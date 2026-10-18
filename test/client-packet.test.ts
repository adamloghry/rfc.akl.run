// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init } from '../src/scripts/packet';
import { click, el, els, fixture, mount, resetDocument, setUrl, stubClipboard, tick } from './dom-helpers';

let dispose: () => void = () => {};
let scrolled: Element[] = [];

beforeEach(() => {
  resetDocument('https://rfc.akl.run/rfc903');
  mount(fixture('rfc-903.html'));
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fig = () => el('figure[data-viz="packet"]');
const inspector = () => ({
  name: el('.pk-i-name', fig()).textContent,
  desc: el('.pk-i-desc', fig()).textContent,
  size: el('.pk-i-size', fig()).textContent,
});
const selectedKeys = () => els('.pk-cell.is-selected', fig()).map((c) => c.getAttribute('data-key'));
const cell = (key: string) => el(`.pk-cell[data-key="${key}"]`, fig());

describe('packet viewer', () => {
  test('reveals the controls, hides the fallback table, and selects the first changed field', () => {
    dispose = init();
    expect(el('.viz-seg', fig()).hidden).toBe(false);
    expect(el('.pk-inspector', fig()).hidden).toBe(false);
    expect(el('.viz-packet-table', fig()).classList.contains('visually-hidden')).toBe(true);
    expect(selectedKeys()).toEqual(['oper']);
    expect(inspector().name).toBe('Operation');
    expect(inspector().size).toBe('2 bytes');
    expect(inspector().desc).toContain('ar$op');
  });

  test('continuation fragments (no id) are not tab stops; primary cells are untouched', () => {
    dispose = init();
    const frags = els('.pk-cell', fig()).filter((c) => !c.id);
    expect(frags.length).toBeGreaterThan(0);
    for (const c of frags) expect(c.getAttribute('tabindex')).toBe('-1');
    for (const c of els('.pk-cell[id]', fig())) expect(c.hasAttribute('tabindex')).toBe(false);
  });

  test('hover selects every fragment of a field and updates the inspector', () => {
    dispose = init();
    cell('tha').dispatchEvent(new MouseEvent('mouseenter'));
    expect(els('.pk-cell.is-selected', fig()).length).toBe(2); // tha spans two rows
    expect(inspector().name).toBe('Target HW Addr');
    expect(inspector().size).toBe('6 bytes');
  });

  test('focus selects and records the field in the URL hash', () => {
    dispose = init();
    cell('plen').dispatchEvent(new FocusEvent('focus'));
    expect(selectedKeys()).toEqual(['plen']);
    expect(location.hash).toBe('#field-plen');
  });

  test('click (Enter on the anchor) selects without following the link and updates the hash', () => {
    dispose = init();
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    cell('hlen').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(selectedKeys()).toEqual(['hlen']);
    expect(location.hash).toBe('#field-hlen');
  });

  test('a history failure (file://) does not break selection', () => {
    vi.spyOn(history, 'replaceState').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    dispose = init();
    cell('hlen').dispatchEvent(new FocusEvent('focus'));
    expect(selectedKeys()).toEqual(['hlen']);
  });

  test('a missing inspector name/description falls back to the key', () => {
    cell('hlen').removeAttribute('data-name');
    cell('hlen').removeAttribute('data-desc');
    cell('hlen').removeAttribute('data-size');
    dispose = init();
    cell('hlen').dispatchEvent(new MouseEvent('mouseenter'));
    expect(inspector()).toEqual({ name: 'HLEN', desc: '', size: '' });
  });

  describe('mode toggle', () => {
    test('starts in the pressed mode and shows only that mode values', () => {
      dispose = init();
      expect(el('.pk-body', fig()).getAttribute('data-mode')).toBe('req');
      expect(el('[data-mode="req"]', el('.viz-seg', fig())).getAttribute('aria-pressed')).toBe('true');
      expect(els('.pk-v[data-mode-val="req"]', fig()).every((v) => !v.hidden)).toBe(true);
      expect(els('.pk-v[data-mode-val="rep"]', fig()).every((v) => v.hidden)).toBe(true);
      expect(els('.pk-cell.is-changed', fig())).toEqual([]);
    });

    test('switching to the reply marks changed fields and swaps values', () => {
      dispose = init();
      click(el('button[data-mode="rep"]', fig()));
      expect(el('.pk-body', fig()).getAttribute('data-mode')).toBe('rep');
      expect(el('button[data-mode="rep"]', fig()).getAttribute('aria-pressed')).toBe('true');
      expect(el('button[data-mode="req"]', fig()).getAttribute('aria-pressed')).toBe('false');
      const changed = new Set(els('.pk-cell.is-changed', fig()).map((c) => c.getAttribute('data-key')));
      expect([...changed].sort()).toEqual(['oper', 'sha', 'spa', 'tpa']);
      expect(els('.pk-v[data-mode-val="rep"]', fig()).every((v) => !v.hidden)).toBe(true);
      expect(els('.pk-v[data-mode-val="req"]', fig()).every((v) => v.hidden)).toBe(true);
      click(el('button[data-mode="req"]', fig()));
      expect(els('.pk-cell.is-changed', fig())).toEqual([]);
    });

    test('clicks that are not on a mode button are ignored', () => {
      dispose = init();
      click(el('.viz-seg', fig()));
      expect(el('.pk-body', fig()).getAttribute('data-mode')).toBe('req');
    });

    test('the initial mode follows aria-pressed even when it is not the first button', () => {
      el('button[data-mode="req"]', fig()).setAttribute('aria-pressed', 'false');
      el('button[data-mode="rep"]', fig()).setAttribute('aria-pressed', 'true');
      dispose = init();
      expect(el('.pk-body', fig()).getAttribute('data-mode')).toBe('rep');
    });

    test('a figure without a mode switch keeps its fixed mode and still works', () => {
      el('.viz-seg', fig()).remove();
      dispose = init();
      expect(el('.pk-body', fig()).getAttribute('data-mode')).toBe('req');
      expect(selectedKeys()).toEqual(['oper']);
    });
  });

  describe('URL hash', () => {
    test('a #field-<key> hash wins over the default selection and scrolls to it', () => {
      setUrl('https://rfc.akl.run/rfc903#field-tpa');
      dispose = init();
      expect(selectedKeys()).toEqual(['tpa']);
      expect(scrolled).toEqual([el('#field-tpa')]);
    });

    test('hashchange re-selects', () => {
      dispose = init();
      setUrl('https://rfc.akl.run/rfc903#field-ptype');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(selectedKeys()).toEqual(['ptype']);
    });

    test('unknown keys, undecodable hashes and ids outside the figure fall back to the default', () => {
      for (const hash of ['#field-nope', '#field-%E0%A4%A', '#field-', '#introduction', '#field-introduction']) {
        setUrl(`https://rfc.akl.run/rfc903${hash}`);
        dispose();
        dispose = init();
        expect(selectedKeys()).toEqual(['oper']);
      }
      expect(scrolled).toEqual([]);
    });

    test('a field id that lives outside this figure does not select', () => {
      document.body.insertAdjacentHTML('beforeend', '<a id="field-elsewhere"></a>');
      setUrl('https://rfc.akl.run/rfc903#field-elsewhere');
      dispose = init();
      expect(selectedKeys()).toEqual(['oper']);
    });

    test('percent-encoded keys are decoded before lookup', () => {
      cell('hlen').setAttribute('data-key', 'h len');
      document.getElementById('field-hlen')?.setAttribute('id', 'field-h len');
      setUrl('https://rfc.akl.run/rfc903#field-h%20len');
      dispose = init();
      expect(selectedKeys()).toEqual(['h len']);
    });
  });

  test('without any cells the figure is left alone', () => {
    for (const c of els('.pk-cell', fig())) c.remove();
    dispose = init();
    expect(el('.viz-seg', fig()).hidden).toBe(true);
  });

  test('dispose stops listening to hashchange', () => {
    dispose = init();
    dispose();
    setUrl('https://rfc.akl.run/rfc903#field-ptype');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(selectedKeys()).toEqual(['oper']);
  });
});

describe('code viz copy button', () => {
  beforeEach(() => {
    mount(fixture('code-fig.html'));
  });

  test('is revealed and copies the code, flashing COPIED then COPY', async () => {
    vi.useFakeTimers();
    const written = stubClipboard('ok');
    dispose = init();
    const btn = el('.code-copy');
    expect(btn.hidden).toBe(false);
    click(btn);
    await vi.advanceTimersByTimeAsync(0);
    expect(written).toEqual([el('figure[data-viz="code"] pre').textContent]);
    expect(btn.textContent).toBe('COPIED');
    click(btn);
    await vi.advanceTimersByTimeAsync(1000);
    expect(btn.textContent).toBe('COPIED');
    await vi.advanceTimersByTimeAsync(700);
    expect(btn.textContent).toBe('COPY');
  });

  test('clipboard rejection and a missing clipboard leave the label alone', async () => {
    stubClipboard('reject');
    dispose = init();
    click(el('.code-copy'));
    await tick();
    expect(el('.code-copy').textContent).toBe('COPY');
    dispose();
    stubClipboard('absent');
    dispose = init();
    click(el('.code-copy'));
    await tick();
    expect(el('.code-copy').textContent).toBe('COPY');
  });

  test('a throwing clipboard getter is tolerated', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    dispose = init();
    expect(() => click(el('.code-copy'))).not.toThrow();
  });

  test('a code figure without a button or pre is skipped', () => {
    el('.code-copy').remove();
    dispose = init();
    expect(document.querySelector('.code-copy')).toBeNull();
  });
});
