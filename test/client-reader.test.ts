// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init } from '../src/scripts/reader';
import { click, el, els, fixture, mount, resetDocument, setUrl, stubClipboard, stubIntersectionObserver, tick } from './dom-helpers';

let dispose: () => void = () => {};
beforeEach(() => {
  resetDocument('https://rfc.akl.run/rfc903');
  mount(fixture('rfc-903.html'));
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('reading level', () => {
  test('the control is revealed and starts on the standard level', () => {
    expect(el('.level-ctl').hidden).toBe(true);
    dispose = init();
    expect(el('.level-ctl').hidden).toBe(false);
    expect(el('[data-set-level="std"]').getAttribute('aria-pressed')).toBe('true');
    expect(el('[data-set-level="eli5"]').getAttribute('aria-pressed')).toBe('false');
  });

  test('a pre-set eli5 level (from the pre-paint script) is reflected in the buttons', () => {
    document.documentElement.setAttribute('data-level', 'eli5');
    dispose = init();
    expect(el('[data-set-level="eli5"]').getAttribute('aria-pressed')).toBe('true');
    expect(el('[data-set-level="std"]').getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('rfc-level')).toBeNull();
  });

  test('switching levels sets data-level, aria-pressed and persists the choice', () => {
    dispose = init();
    click(el('[data-set-level="eli5"]'));
    expect(document.documentElement.getAttribute('data-level')).toBe('eli5');
    expect(el('[data-set-level="eli5"]').getAttribute('aria-pressed')).toBe('true');
    expect(el('[data-set-level="std"]').getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('rfc-level')).toBe('eli5');
    click(el('[data-set-level="std"]'));
    expect(document.documentElement.hasAttribute('data-level')).toBe(false);
    expect(localStorage.getItem('rfc-level')).toBe('std');
  });

  test('?level in the URL is rewritten to follow the choice; a URL without it is untouched', () => {
    setUrl('https://rfc.akl.run/rfc903?level=std&x=1#introduction');
    dispose = init();
    click(el('[data-set-level="eli5"]'));
    expect(location.search).toBe('?level=eli5&x=1');
    expect(location.hash).toBe('#introduction');
    dispose();
    setUrl('https://rfc.akl.run/rfc903');
    dispose = init();
    click(el('[data-set-level="eli5"]'));
    expect(location.search).toBe('');
  });

  test('storage and history failures are swallowed', () => {
    setUrl('https://rfc.akl.run/rfc903?level=std');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(history, 'replaceState').mockImplementation(() => {
      throw new Error('denied');
    });
    dispose = init();
    click(el('[data-set-level="eli5"]'));
    expect(document.documentElement.getAttribute('data-level')).toBe('eli5');
  });

  test('without the control nothing is wired', () => {
    el('.level-ctl').remove();
    dispose = init();
    expect(document.documentElement.hasAttribute('data-level')).toBe(false);
  });
});

describe('copy link', () => {
  test('writes the permalink to the clipboard and flashes the label, then restores it', async () => {
    vi.useFakeTimers();
    const written = stubClipboard('ok');
    dispose = init();
    const btn = el('[data-copy]');
    expect(btn.textContent).toBe('Copy link');
    click(btn);
    await vi.advanceTimersByTimeAsync(0);
    expect(written).toEqual(['https://rfc.akl.run/rfc903']);
    expect(btn.textContent).toBe('Link copied');
    // a second click inside the window keeps the original label as the one to restore
    click(btn);
    await vi.advanceTimersByTimeAsync(1500);
    expect(btn.textContent).toBe('Link copied');
    await vi.advanceTimersByTimeAsync(200);
    expect(btn.textContent).toBe('Copy link');
  });

  test('when copying fails the permalink text is selected for manual copy', async () => {
    stubClipboard('reject');
    const exec = vi.fn(() => false);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    dispose = init();
    click(el('[data-copy]'));
    await tick();
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull(); // the fallback textarea is cleaned up
    expect(String(window.getSelection())).toBe(el('.permalink-note code').textContent);
  });

  test('without the async clipboard API the execCommand fallback is used', async () => {
    stubClipboard('absent');
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => true);
    dispose = init();
    const btn = el('[data-copy]');
    click(btn);
    await tick();
    expect(btn.textContent).toBe('Link copied');
  });

  test('a throwing execCommand counts as failure', async () => {
    stubClipboard('absent');
    (document as unknown as { execCommand: unknown }).execCommand = () => {
      throw new Error('unsupported');
    };
    dispose = init();
    click(el('[data-copy]'));
    await tick();
    expect(el('[data-copy]').textContent).toBe('Copy link');
  });

  test('with no permalink note, the citation text is selected on failure', async () => {
    stubClipboard('absent');
    (document as unknown as { execCommand: unknown }).execCommand = () => false;
    el('.permalink-note').remove();
    dispose = init();
    click(el('[data-copy]'));
    expect(String(window.getSelection())).toBe(el('.cite-text').textContent);
  });
});

describe('cite panel', () => {
  test('the Cite button toggles aria-expanded and the hidden panel', () => {
    dispose = init();
    const btn = el('[data-cite-toggle]');
    const panel = el('#cite');
    expect(panel.hidden).toBe(true);
    click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
  });

  test('citation COPY buttons copy their target text', async () => {
    const written = stubClipboard('ok');
    dispose = init();
    const [first, second] = els('[data-copy-target]');
    click(first as HTMLElement);
    await tick();
    expect(written[0]).toBe(el('#cite-rfced').textContent);
    expect(first?.textContent).toBe('COPIED');
    click(second as HTMLElement);
    await tick();
    expect(written[1]).toContain('@misc{rfc903,');
  });

  test('a failed citation copy selects the text; a missing target is ignored', async () => {
    stubClipboard('reject');
    (document as unknown as { execCommand: unknown }).execCommand = () => false;
    dispose = init();
    const [first, second] = els('[data-copy-target]');
    click(first as HTMLElement);
    await tick();
    expect(String(window.getSelection())).toBe(el('#cite-rfced').textContent);
    second?.setAttribute('data-copy-target', '#nope');
    const before = first?.textContent;
    click(second as HTMLElement);
    await tick();
    expect(first?.textContent).toBe(before);
  });
});

describe('prose code blocks', () => {
  // The built 903 page keeps its code in a viz figure; real prose <pre> blocks come from section HTML.
  beforeEach(() => {
    el('.prose').insertAdjacentHTML('beforeend', '<pre><code>RARP request\n  htype=1</code></pre>');
  });

  test('each pre in .prose is wrapped once with a floating COPY button', async () => {
    const written = stubClipboard('ok');
    dispose = init();
    const pre = el('.prose pre');
    const wrap = pre.parentElement as HTMLElement;
    expect(wrap.className).toBe('has-copy');
    const btn = el('.copy-btn-float', wrap);
    expect(btn.textContent).toBe('COPY');
    click(btn);
    await tick();
    expect(written).toEqual([pre.textContent]);
    expect(btn.textContent).toBe('COPIED');
    // a second init must not double-wrap
    dispose();
    dispose = init();
    expect(els('.has-copy', wrap.parentElement as HTMLElement).length).toBe(1);
    expect(els('.copy-btn-float').length).toBe(1);
  });

  test('a failed copy leaves the label alone', async () => {
    stubClipboard('absent');
    (document as unknown as { execCommand: unknown }).execCommand = () => false;
    dispose = init();
    const btn = el('.copy-btn-float');
    click(btn);
    await tick();
    expect(btn.textContent).toBe('COPY');
  });
});

describe('TOC scrollspy', () => {
  test('marks the first visible section, ignores repeats, follows changes', () => {
    const io = stubIntersectionObserver();
    dispose = init();
    const observer = io.instances[0];
    expect(observer?.targets.map((t) => t.id)).toEqual([
      'introduction',
      'motivation',
      'design',
      'packet-format',
      'protocol-operation',
      'implementation',
      'successors',
      'references',
    ]);
    const active = () => els('.toc a.is-active').map((a) => a.getAttribute('data-toc'));
    expect(active()).toEqual([]);
    io.deliver([]);
    expect(active()).toEqual([]);
    io.deliver(['design', 'packet-format']);
    expect(active()).toEqual(['design']);
    io.deliver(['design', 'packet-format']);
    expect(active()).toEqual(['design']);
    io.deliver(['packet-format']);
    expect(active()).toEqual(['packet-format']);
    io.deliver(['motivation', 'packet-format']);
    expect(active()).toEqual(['motivation']);
  });

  test('sections missing from the page are skipped; no observer, no scrollspy', () => {
    const io = stubIntersectionObserver();
    document.getElementById('design')?.remove();
    dispose = init();
    expect(io.instances[0]?.targets.map((t) => t.id)).not.toContain('design');
    dispose();
    expect(io.instances[0]?.disconnected).toBe(true);
    (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    expect(() => {
      dispose = init();
    }).not.toThrow();
  });

  test('a page without a TOC is a no-op', () => {
    const io = stubIntersectionObserver();
    for (const a of els('.toc a[data-toc]')) a.remove();
    dispose = init();
    expect(io.instances.length).toBe(0);
  });
});
