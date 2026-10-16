// Shared helpers for the happy-dom client-script tests. Markup comes from test/fixtures/html/, which is
// extracted from a real build (scripts/extract-client-fixtures.ts), so the tests see the real DOM contract.
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { must } from './helpers';

const HTML_DIR = path.join(process.cwd(), 'test', 'fixtures', 'html');

export function fixture(name: string): string {
  return fs.readFileSync(path.join(HTML_DIR, name), 'utf8');
}

/** Replace the document body with markup and return the body. */
export function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

/** Reset document-level state a previous test may have left behind. */
export function resetDocument(url = 'https://rfc.akl.run/'): void {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-level');
  setUrl(url);
  try {
    localStorage.clear();
  } catch {
    /* storage unavailable */
  }
}

/** Point `location` at a URL (path, query and hash) without navigating. */
export function setUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(url);
}

/**
 * setUrl, then wait out the `hashchange` happy-dom dispatches asynchronously when only the hash changes,
 * so it cannot land on listeners installed afterwards.
 */
export async function navigateTo(url: string): Promise<void> {
  setUrl(url);
  await new Promise((r) => setTimeout(r, 0));
}

/** Let promise chains and 0 ms timers settle. */
export async function tick(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

/** Wait until `cond` holds (polling real timers), failing after `ms`. */
export async function waitFor(cond: () => boolean, ms = 1000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 5));
  }
}

export function el<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  return must(root.querySelector<T>(selector), `element ${selector}`);
}

export function els<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function click(target: Element): void {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

type Route = unknown | ((url: string) => unknown);

/**
 * Stub `fetch` with JSON routes keyed by exact path. A route may be a value, a function of the URL,
 * `null` for a 404, or an Error instance to reject. Unknown paths respond 404. Returns the call log.
 */
export function stubFetch(routes: Record<string, Route>): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      calls.push(url);
      const route = routes[url];
      if (route instanceof Error) throw route;
      if (route === undefined || route === null) return new Response('not found', { status: 404 });
      const body = typeof route === 'function' ? (route as (u: string) => unknown)(url) : route;
      if (body instanceof Error) throw body;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
  return { calls };
}

/** Install a clipboard whose writeText records its argument (or rejects). */
export function stubClipboard(mode: 'ok' | 'reject' | 'absent' = 'ok'): string[] {
  const written: string[] = [];
  const clipboard =
    mode === 'absent'
      ? undefined
      : {
          writeText: vi.fn(async (t: string) => {
            if (mode === 'reject') throw new Error('denied');
            written.push(t);
          }),
        };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  return written;
}

/** matchMedia stub: `matches` decides every query; returns a handle to flip it and fire change listeners. */
export function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    addEventListener: (_t: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_t: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
  return {
    listeners,
    set(next: boolean) {
      mql.matches = next;
      for (const fn of [...listeners]) fn();
    },
  };
}

/** IntersectionObserver stub that lets a test deliver entries by hand. */
export function stubIntersectionObserver() {
  const instances: Array<{ cb: IntersectionObserverCallback; targets: Element[]; disconnected: boolean }> = [];
  class FakeIO {
    readonly state: (typeof instances)[number];
    constructor(cb: IntersectionObserverCallback) {
      this.state = { cb, targets: [], disconnected: false };
      instances.push(this.state);
    }
    observe(t: Element) {
      this.state.targets.push(t);
    }
    unobserve() {}
    disconnect() {
      this.state.disconnected = true;
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO;
  return {
    instances,
    /** Report which observed elements (by id) are intersecting. */
    deliver(visibleIds: string[], idx = 0) {
      const inst = must(instances[idx]);
      const entries = inst.targets.map((t) => ({ target: t, isIntersecting: visibleIds.includes(t.id) }) as IntersectionObserverEntry);
      inst.cb(entries, {} as IntersectionObserver);
    },
  };
}
