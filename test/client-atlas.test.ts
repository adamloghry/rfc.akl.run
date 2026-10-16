// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { decode, init } from '../src/scripts/atlas';
import { nav } from '../src/scripts/dom';
import { click, el, els, fixture, key, mount, resetDocument, stubFetch, tick, waitFor } from './dom-helpers';
import { must } from './helpers';
import { dataRoutes, fixtureSite } from './site-fixture';

const site = fixtureSite();
const routes = dataRoutes(site);
const COLS = 200;
const WIDTH = 2000; // => 10 px cells, so (col, row) <-> pixel maths is easy to read

const STYLE: Record<string, string> = {
  '--accent': 'feat',
  '--accent-2': 'basic',
  '--map-empty': 'empty',
  '--map-feat-dim': 'featDim',
  '--map-basic-dim': 'basicDim',
  '--line-strong': 'line',
  '--ink': 'ink',
};

type Call = [string, ...unknown[]];
/** A 2D context that records what is drawn and which fillStyle each fillRect used. */
function makeContext() {
  const log: Call[] = [];
  const fills: Array<{ style: string; x: number; y: number; w: number; h: number }> = [];
  const strokes: Array<{ style: string; width: number; rect: [number, number, number, number] | null }> = [];
  let fillStyle = '';
  let strokeStyle = '';
  let lineWidth = 0;
  const ctx = {
    setTransform: (...a: unknown[]) => log.push(['setTransform', ...a]),
    clearRect: (...a: unknown[]) => log.push(['clearRect', ...a]),
    beginPath: () => log.push(['beginPath']),
    moveTo: (...a: unknown[]) => log.push(['moveTo', ...a]),
    lineTo: (...a: unknown[]) => log.push(['lineTo', ...a]),
    stroke: () => {
      log.push(['stroke']);
      strokes.push({ style: strokeStyle, width: lineWidth, rect: null });
    },
    fillRect: (x: number, y: number, w: number, h: number) => fills.push({ style: fillStyle, x, y, w, h }),
    strokeRect: (x: number, y: number, w: number, h: number) => strokes.push({ style: strokeStyle, width: lineWidth, rect: [x, y, w, h] }),
    set fillStyle(v: string) {
      fillStyle = v;
    },
    set strokeStyle(v: string) {
      strokeStyle = v;
    },
    set lineWidth(v: number) {
      lineWidth = v;
    },
  };
  return { ctx, log, fills, strokes, reset: () => (log.length = fills.length = strokes.length = 0) };
}

let drawing = makeContext();
let dispose: () => void = () => {};
let go: ReturnType<typeof vi.spyOn>;
let resizeCallbacks: Array<() => void> = [];

const canvas = () => el<HTMLCanvasElement>('#atlas-map');
const label = () => el('.at-cap-label').textContent;
const detail = () => el('.at-cap-detail').textContent;

/** Position of cell n (1-based) as a mouse event on the 10 px grid. */
function mouseAt(n: number, type = 'mousemove'): MouseEvent {
  const i = n - 1;
  return new MouseEvent(type, { clientX: (i % COLS) * 10 + 4, clientY: Math.floor(i / COLS) * 10 + 4, bubbles: true });
}

function layout(width = WIDTH): void {
  const c = canvas();
  Object.defineProperty(c, 'clientWidth', { configurable: true, value: width });
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 100, right: width, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
}

beforeEach(() => {
  resetDocument('https://rfc.akl.run/');
  for (const [prop, value] of Object.entries(STYLE)) document.documentElement.style.setProperty(prop, value);
  mount(fixture('atlas.html'));
  layout();
  drawing = makeContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => drawing.ctx) as never);
  go = vi.spyOn(nav, 'to').mockImplementation(() => {});
  resizeCallbacks = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resizeCallbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = globalThis.ResizeObserver;
});
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', () => Promise.reject(new Error('unexpected fetch after test')));
});

async function started(extra: Record<string, unknown> = {}) {
  const fetched = stubFetch({ ...routes, ...extra });
  dispose = init();
  await waitFor(() => drawing.fills.length > 0 || label() !== 'Hover the map' || detail().includes('unavailable'));
  return fetched;
}

describe('decode', () => {
  test('splits each byte into state (low 3 bits) and category (high 4 bits)', () => {
    const d = decode(Buffer.from([0x04 | (3 << 4), 0x00, 0x02 | (15 << 4), 0x05 | (11 << 4)]).toString('base64'));
    assert.deepEqual(Array.from(d.state), [4, 0, 2, 5]);
    assert.deepEqual(Array.from(d.cat), [3, 0, 15, 11]);
  });
  test('an empty string decodes to empty arrays', () => {
    const d = decode('');
    expect(d.state.length + d.cat.length).toBe(0);
  });
});

describe('drawing the map', () => {
  test('sizes the canvas for the pixel ratio and draws one cell per issued or in-progress RFC', async () => {
    window.devicePixelRatio = 2;
    await started();
    const max = (routes['/data/coverage.json'] as { max: number }).max;
    const rows = Math.ceil(max / COLS);
    expect(canvas().width).toBe(WIDTH * 2);
    expect(canvas().height).toBe(Math.ceil(rows * 10) * 2);
    expect(canvas().style.height).toBe(`${Math.ceil(rows * 10)}px`);
    expect(drawing.log).toContainEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    // state >= 2 -> filled cells; not-issued / reserved -> diagonal strike-through strokes
    const filled = site.rfcs.size;
    expect(drawing.fills.length).toBe(filled);
    const moves = drawing.log.filter((c) => c[0] === 'moveTo').length;
    expect(moves).toBe(max - filled);
    window.devicePixelRatio = 1;
  });

  test('cell geometry: 10 px pitch with a gap, positioned by column and row', async () => {
    await started();
    const at = (n: number) => must(drawing.fills.find((f) => f.x === ((n - 1) % COLS) * 10 && f.y === Math.floor((n - 1) / COLS) * 10));
    expect(at(903)).toMatchObject({ x: 1020, y: 40, w: 8.6, h: 8.6 }); // col 102, row 4
    expect(at(1)).toMatchObject({ x: 0, y: 0 });
  });

  test('fills use the theme colours by tier: explainer/interactive, summary, index', async () => {
    await started();
    const style = (n: number) =>
      must(drawing.fills.find((f) => f.x === ((n - 1) % COLS) * 10 && f.y === Math.floor((n - 1) / COLS) * 10)).style;
    expect(style(903)).toBe('feat');
    expect(style(826)).toBe('feat');
    expect(style(5952)).toBe('basic');
    expect(style(1)).toBe('empty');
  });

  test('a hovered cell gets an ink outline', async () => {
    await started();
    drawing.reset();
    canvas().dispatchEvent(mouseAt(903));
    const outline = must(drawing.strokes.find((s) => s.rect));
    expect(outline).toMatchObject({ style: 'ink', width: 1.5, rect: [1019, 39, 10.6, 10.6] });
  });

  test('does not draw while the canvas has no width', async () => {
    layout(0);
    const { calls } = stubFetch(routes);
    dispose = init();
    await waitFor(() => calls.includes('/data/coverage.json'));
    await tick(10);
    expect(drawing.fills.length).toBe(0);
  });

  test('redraws on theme changes and resizes', async () => {
    await started();
    drawing.reset();
    window.dispatchEvent(new CustomEvent('rfc:theme'));
    expect(drawing.fills.length).toBeGreaterThan(0);
    drawing.reset();
    for (const cb of resizeCallbacks) cb();
    expect(drawing.fills.length).toBeGreaterThan(0);
  });

  test('falls back to window resize when ResizeObserver is missing', async () => {
    vi.unstubAllGlobals();
    delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    await started();
    drawing.reset();
    window.dispatchEvent(new Event('resize'));
    expect(drawing.fills.length).toBeGreaterThan(0);
  });

  test('no 2D context means nothing is drawn but nothing breaks either', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    stubFetch(routes);
    dispose = init();
    await tick(10);
    expect(drawing.fills.length).toBe(0);
  });

  test('without a canvas (or without canvas support) init does nothing', () => {
    const { calls } = stubFetch(routes);
    mount('<p>no map</p>');
    dispose = init();
    expect(calls).toEqual([]);
    mount(fixture('atlas.html'));
    (canvas() as unknown as { getContext: unknown }).getContext = undefined;
    dispose();
    dispose = init();
    expect(calls).toEqual([]);
  });
});

describe('hover caption', () => {
  test('starts with the idle caption; hovering shows the number at once and the title when the shard arrives', async () => {
    const idleLabel = label();
    const idleDetail = detail();
    await started();
    canvas().dispatchEvent(mouseAt(903));
    expect(label()).toBe('RFC 903');
    expect(detail()).toContain('index page');
    await waitFor(() => label() !== 'RFC 903');
    expect(label()).toBe('RFC 903 · RARP');
    expect(detail()).toBe('— deep explainer · Core Protocols · 1984');
    canvas().dispatchEvent(new MouseEvent('mouseleave'));
    expect(label()).toBe(idleLabel);
    expect(detail()).toBe(idleDetail);
  });

  test('summary pages are described as summaries; index pages keep the RFC Editor description', async () => {
    await started();
    canvas().dispatchEvent(mouseAt(5952));
    await waitFor(() => label() !== 'RFC 5952');
    expect(detail()).toMatch(/^— summary page · Core Protocols · 2010/);
    canvas().dispatchEvent(mouseAt(1));
    await waitFor(() => label() === 'RFC 1 · Host Software');
    expect(detail()).toMatch(/^— index page: Host Software, authors, status and lineage/);
  });

  test('never-issued and reserved numbers are explained; no shard is fetched for them', async () => {
    const { calls } = await started();
    const before = calls.length;
    const notIssued = must([...site.notIssued][0]);
    canvas().dispatchEvent(mouseAt(notIssued));
    expect(detail()).toBe('— never issued');
    canvas().dispatchEvent(mouseAt(15));
    expect(detail()).toBe('— number reserved, not yet published');
    expect(calls.length).toBe(before);
  });

  test('moving off the grid clears the hover; unchanged cells are not redrawn', async () => {
    await started();
    canvas().dispatchEvent(mouseAt(903));
    drawing.reset();
    canvas().dispatchEvent(mouseAt(903));
    expect(drawing.log.length).toBe(0);
    canvas().dispatchEvent(new MouseEvent('mousemove', { clientX: WIDTH + 50, clientY: 4 }));
    expect(label()).toBe('Hover the map');
    canvas().dispatchEvent(new MouseEvent('mousemove', { clientX: 4, clientY: 99999 }));
    expect(label()).toBe('Hover the map');
    canvas().dispatchEvent(new MouseEvent('mousemove', { clientX: -5, clientY: 4 }));
    expect(label()).toBe('Hover the map');
  });

  test('a late title does not overwrite a caption the pointer has since left', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/data/titles/')) await gate;
        return new Response(JSON.stringify(routes[url] ?? {}), { status: 200 });
      }),
    );
    dispose = init();
    await waitFor(() => drawing.fills.length > 0);
    canvas().dispatchEvent(mouseAt(903));
    canvas().dispatchEvent(mouseAt(1)); // moved on
    release();
    await tick(10);
    await new Promise((r) => setTimeout(r, 10));
    expect(label()).not.toBe('RFC 903 · RARP');
  });

  test('a failed shard keeps the plain caption and is retried on the next hover', async () => {
    let ok = false;
    const { calls } = await started({ '/data/titles/0.json': () => (ok ? routes['/data/titles/0.json'] : new Error('offline')) });
    canvas().dispatchEvent(mouseAt(903));
    await tick(10);
    expect(label()).toBe('RFC 903');
    ok = true;
    canvas().dispatchEvent(mouseAt(1));
    canvas().dispatchEvent(mouseAt(903));
    await waitFor(() => label() === 'RFC 903 · RARP');
    expect(calls.filter((c) => c === '/data/titles/0.json').length).toBeGreaterThan(1);
  });

  test('shards are cached per thousand', async () => {
    const { calls } = await started();
    canvas().dispatchEvent(mouseAt(903));
    canvas().dispatchEvent(mouseAt(826));
    await waitFor(() => label() === 'RFC 826 · ARP');
    expect(calls.filter((c) => c === '/data/titles/0.json').length).toBe(1);
  });

  test('a number missing from its shard keeps the plain caption', async () => {
    const shard0 = routes['/data/titles/0.json'] as Record<string, unknown>;
    const saved = shard0['1'];
    delete shard0['1'];
    try {
      await started();
      canvas().dispatchEvent(mouseAt(1));
      await tick(10);
      expect(label()).toBe('RFC 1');
    } finally {
      shard0['1'] = saved;
    }
  });
});

describe('click and keyboard', () => {
  test('clicking a cell opens its page; clicking empty space does nothing', async () => {
    await started();
    canvas().dispatchEvent(mouseAt(903, 'click'));
    expect(go).toHaveBeenCalledWith('/903/');
    go.mockClear();
    canvas().dispatchEvent(new MouseEvent('click', { clientX: WIDTH + 20, clientY: 1 }));
    expect(go).not.toHaveBeenCalled();
  });

  test('focus starts the keyboard cursor at RFC 1 with an outline; blur clears it', async () => {
    await started();
    drawing.reset();
    canvas().dispatchEvent(new FocusEvent('focus'));
    expect(label()).toBe('RFC 1');
    expect(drawing.strokes.some((s) => s.rect !== null)).toBe(true);
    drawing.reset();
    canvas().dispatchEvent(new FocusEvent('blur'));
    expect(label()).toBe('Hover the map');
    expect(drawing.strokes.some((s) => s.rect !== null)).toBe(false);
  });

  test('arrow keys move by one cell or one row, clamped to the first and last RFC; Enter opens it', async () => {
    await started();
    const max = (routes['/data/coverage.json'] as { max: number }).max;
    canvas().dispatchEvent(new FocusEvent('focus'));
    const e = key(canvas(), 'ArrowRight');
    expect(e.defaultPrevented).toBe(true);
    expect(label()).toBe('RFC 2');
    key(canvas(), 'ArrowDown');
    expect(label()).toBe('RFC 202');
    key(canvas(), 'ArrowLeft');
    expect(label()).toBe('RFC 201');
    key(canvas(), 'ArrowUp');
    expect(label()).toBe('RFC 1');
    key(canvas(), 'ArrowUp');
    key(canvas(), 'ArrowLeft');
    expect(label()).toBe('RFC 1');
    key(canvas(), 'Enter');
    expect(go).toHaveBeenLastCalledWith('/1/');
    for (let i = 0; i < Math.ceil(max / COLS) + 2; i++) key(canvas(), 'ArrowDown');
    expect(label()).toBe(`RFC ${max}`);
    key(canvas(), 'Enter');
    expect(go).toHaveBeenLastCalledWith(`/${max}/`);
  });

  test('other keys are ignored', async () => {
    await started();
    expect(key(canvas(), 'a').defaultPrevented).toBe(false);
    expect(go).not.toHaveBeenCalled();
  });

  test('the keyboard cursor caption shows the title after the shard loads', async () => {
    await started();
    canvas().dispatchEvent(new FocusEvent('focus'));
    await waitFor(() => label() === 'RFC 1 · Host Software');
  });

  test('mouse movement takes over from the keyboard cursor', async () => {
    await started();
    canvas().dispatchEvent(new FocusEvent('focus'));
    key(canvas(), 'ArrowRight');
    canvas().dispatchEvent(mouseAt(903));
    expect(label()).toBe('RFC 903');
    canvas().dispatchEvent(new MouseEvent('mouseleave'));
    expect(label()).toBe('Hover the map');
  });
});

describe('area chips', () => {
  test('selecting a chip presses it alone and dims other categories', async () => {
    await started();
    drawing.reset();
    const chips = els('.at-chip');
    click(must(chips.find((c) => c.getAttribute('data-cat') === 'core')));
    expect(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.getAttribute('data-cat'))).toEqual(['core']);
    const style = (n: number) =>
      must(drawing.fills.find((f) => f.x === ((n - 1) % COLS) * 10 && f.y === Math.floor((n - 1) / COLS) * 10)).style;
    expect(style(903)).toBe('feat'); // core
    expect(style(748)).toBe('empty'); // index tier is never dimmed
    expect(style(5952)).toBe('basic'); // core summary
    // an explainer in another category would be featDim; summaries basicDim
    drawing.reset();
    click(must(chips.find((c) => c.getAttribute('data-cat') === 'dns')));
    expect(style(903)).toBe('featDim');
    expect(style(5952)).toBe('basicDim');
    drawing.reset();
    click(must(chips.find((c) => c.getAttribute('data-cat') === '')));
    expect(style(903)).toBe('feat');
    expect(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.getAttribute('data-cat'))).toEqual(['']);
  });

  test('an unknown category dims nothing', async () => {
    await started();
    const chip = must(els('.at-chip')[1]);
    chip.setAttribute('data-cat', 'not-a-category');
    drawing.reset();
    click(chip);
    expect(must(drawing.fills.find((f) => f.x === 1020 && f.y === 40)).style).toBe('feat');
  });
});

describe('failures', () => {
  test('missing coverage data leaves a friendly message', async () => {
    const { calls } = await started({ '/data/coverage.json': null });
    expect(detail()).toBe('— map data unavailable; browse by area instead.');
    expect(calls).toContain('/data/coverage.json');
    expect(drawing.fills.length).toBe(0);
  });

  test('a network error is handled the same way', async () => {
    await started({ '/data/coverage.json': new Error('offline') });
    expect(detail()).toContain('unavailable');
  });

  test('interaction before the data arrives is harmless', async () => {
    stubFetch({ ...routes });
    dispose = init();
    canvas().dispatchEvent(mouseAt(903));
    canvas().dispatchEvent(new FocusEvent('focus'));
    expect(label()).toBe('Hover the map');
    await waitFor(() => drawing.fills.length > 0);
  });

  test('without caption elements the map still draws', async () => {
    el('.at-cap-label').remove();
    el('.at-cap-detail').remove();
    stubFetch(routes);
    dispose = init();
    await waitFor(() => drawing.fills.length > 0);
    canvas().dispatchEvent(mouseAt(903));
    canvas().dispatchEvent(new FocusEvent('focus'));
    canvas().dispatchEvent(new FocusEvent('blur'));
  });
});
