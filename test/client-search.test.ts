// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nav } from '../src/scripts/dom';
import { init } from '../src/scripts/search';
import { click, el, els, fixture, key, mount, resetDocument, stubFetch, waitFor } from './dom-helpers';
import { must } from './helpers';
import { dataRoutes, fixtureSite } from './site-fixture';

const site = fixtureSite();
const routes = dataRoutes(site);

let dispose: () => void = () => {};
let go: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetDocument('https://rfc.akl.run/');
  mount(`${fixture('rfc-903.html')}${fixture('hero-search.html')}`);
  go = vi.spyOn(nav, 'to').mockImplementation(() => {});
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // A debounce timer from the test just finished may still fire; keep it off the real network.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('unexpected fetch after test')));
});

const header = () => el('.site-header .search-input, header .search-input') as HTMLInputElement;
const hero = () => el<HTMLInputElement>('.search-hero .search-input');
const popOf = (input: HTMLInputElement) => el('.search-pop', input.closest('.search-box') as HTMLElement);
const rows = (input: HTMLInputElement) => els<HTMLAnchorElement>('.search-row', popOf(input));
const rowText = (a: Element) => ({
  label: el('.sr-label', a).textContent,
  title: el('.sr-title', a).textContent,
  tag: el('.sr-tag', a).textContent,
  href: a.getAttribute('href'),
});

/** Type into an input and wait for the debounce + lookups to produce a final render. */
async function search(input: HTMLInputElement, q: string): Promise<void> {
  key(input, 'Escape'); // start from a closed popup so "visible" means "this query rendered"
  input.value = q;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => !popOf(input).hidden);
  // let the second (full-text) render land, if any
  await new Promise((r) => setTimeout(r, 30));
}

describe('wiring', () => {
  test('inputs become comboboxes bound to their listbox; a unique id per input', () => {
    stubFetch(routes);
    dispose = init();
    for (const input of [header(), hero()]) {
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      const list = el('[role="listbox"]', popOf(input));
      expect(input.getAttribute('aria-controls')).toBe(list.id);
    }
    expect(header().getAttribute('aria-controls')).not.toBe(hero().getAttribute('aria-controls'));
    expect(els('.search-empty').length).toBe(2);
  });

  test('a page without search inputs or fill buttons does nothing', () => {
    mount('<p>nothing</p>');
    const { calls } = stubFetch(routes);
    dispose = init();
    expect(calls).toEqual([]);
  });

  test('an input without its popup markup is skipped', () => {
    mount('<div class="search-box"><input class="search-input"></div>');
    stubFetch(routes);
    dispose = init();
    expect(el('.search-input').hasAttribute('role')).toBe(false);
  });

  test('focus pre-loads the index metadata, docs, prefix table and questions but no term shards', async () => {
    const { calls } = stubFetch(routes);
    dispose = init();
    header().dispatchEvent(new FocusEvent('focus'));
    await waitFor(() => calls.length >= 4);
    expect(calls.sort()).toEqual(['/data/questions.json', '/data/search/docs.json', '/data/search/meta.json', '/data/search/prefix.json']);
  });

  test('focus with unreachable data does not throw', async () => {
    stubFetch({});
    dispose = init();
    header().dispatchEvent(new FocusEvent('focus'));
    await new Promise((r) => setTimeout(r, 20));
    expect(popOf(header()).hidden).toBe(true);
  });
});

describe('debounce', () => {
  test('lookups wait 80 ms after the last keystroke; typing again restarts the wait', async () => {
    vi.useFakeTimers();
    const { calls } = stubFetch(routes);
    dispose = init();
    const input = header();
    input.value = 'rar';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(79);
    expect(calls).toEqual([]);
    input.value = 'rarp';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(79);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toContain('/data/questions.json');
  });

  test('clearing the field closes the popup', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'rarp');
    expect(popOf(header()).hidden).toBe(false);
    header().value = '';
    header().dispatchEvent(new Event('input'));
    await waitFor(() => popOf(header()).hidden === true);
    expect(header().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('number jump', () => {
  test('a number shows its RFC first, with title and tier', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), '903');
    const first = rowText(must(rows(header())[0]));
    expect(first.href).toBe('/903/');
    expect(first.label).toBe('RFC 903');
    expect(first.title).toMatch(/Reverse Address Resolution/);
    expect(first.tag).toBe('EXPLAINER');
    expect(header().getAttribute('aria-expanded')).toBe('true');
  });

  test('summary and index tiers are tagged and styled by tier', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), '5952');
    const a = must(rows(header())[0]);
    expect(rowText(a).tag).toBe('SUMMARY');
    expect(el('.sr-tag', a).classList.contains('is-summary')).toBe(true);
    const indexOnly = must([...site.rfcs.values()].find((r) => r.tier === 'index')).number;
    await search(header(), String(indexOnly));
    const b = must(rows(header())[0]);
    expect(rowText(b).tag).toBe('INDEX');
    expect(el('.sr-tag', b).classList.contains('is-index')).toBe(true);
  });

  test('never-issued and reserved numbers say so and carry no tag', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), '14');
    expect(rowText(must(rows(header())[0]))).toMatchObject({ label: 'RFC 14', title: 'never issued', tag: '' });
    const reserved = [...Array(60).keys()].map((i) => i + 1).find((n) => !site.rfcs.has(n) && !site.notIssued.has(n));
    expect(reserved).toBeDefined();
    await search(header(), String(reserved));
    expect(rowText(must(rows(header())[0]))).toMatchObject({ title: 'number reserved, not yet published', tag: '' });
  });

  test('numbers beyond the highest RFC are not offered', async () => {
    stubFetch(routes);
    dispose = init();
    header().value = '99999';
    header().dispatchEvent(new Event('input'));
    await waitFor(() => !popOf(header()).hidden);
    await new Promise((r) => setTimeout(r, 20));
    expect(rows(header()).every((r) => r.getAttribute('href') !== '/99999/')).toBe(true);
    expect(el('.search-empty', popOf(header())).hidden).toBe(false);
  });

  test('without coverage data the number row is skipped but text results remain', async () => {
    stubFetch({ ...routes, '/data/coverage.json': null });
    dispose = init();
    await search(header(), '903');
    const hrefs = rows(header()).map((r) => r.getAttribute('href'));
    expect(hrefs).toContain('/903/');
    expect(rowText(must(rows(header())[0])).label).toBe('RFC 903'); // from the full-text index, not the number jump
  });

  test('a missing titles shard leaves the number row untitled instead of failing', async () => {
    stubFetch({ ...routes, '/data/titles/0.json': null });
    dispose = init();
    await search(header(), '903');
    expect(rowText(must(rows(header())[0]))).toMatchObject({ href: '/903/', title: '' });
  });
});

describe('questions and full text', () => {
  test('curated questions match when every word is in them, labelled by journey or RFC', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'diskless computer ip');
    const texts = rows(header()).map(rowText);
    const q = texts.find((t) => t.tag === 'QUESTION');
    expect(q).toBeDefined();
    expect(texts.some((t) => t.href === '/journeys/diskless-boot/')).toBe(true);
  });

  test('full-text hits come from the term shards of the query words only, ranked best first', async () => {
    const { calls } = stubFetch(routes);
    dispose = init();
    await search(header(), 'rarp');
    expect(rowText(must(rows(header())[0])).href).toBe('/903/');
    const shardCalls = calls.filter((c) => /\/data\/search\/t-\d\d\.json$/.test(c));
    expect(shardCalls.length).toBeGreaterThan(0);
    expect(shardCalls.length).toBeLessThanOrEqual(2);
    expect(new Set(shardCalls).size).toBe(shardCalls.length);
  });

  test('shards and meta are fetched once and reused across searches', async () => {
    const { calls } = stubFetch(routes);
    dispose = init();
    await search(header(), 'rarp');
    const before = calls.filter((c) => c.includes('/data/search/')).length;
    await search(header(), 'rarp');
    expect(calls.filter((c) => c.includes('/data/search/')).length).toBe(before);
  });

  test('prefix expansion finds words that are still being typed', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'reverse addr');
    expect(rows(header()).map((r) => r.getAttribute('href'))).toContain('/903/');
  });

  test('a trailing space turns prefix expansion off', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'revers ');
    expect(rows(header()).map((r) => r.getAttribute('href'))).not.toContain('/903/');
  });

  test('results are capped at six rows without duplicates', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'address');
    const hrefs = rows(header()).map((r) => r.getAttribute('href'));
    expect(hrefs.length).toBeLessThanOrEqual(6);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test('a failed shard degrades to whatever else matched', async () => {
    const failing: Record<string, unknown> = { ...routes };
    for (let k = 0; k < 64; k++) failing[`/data/search/t-${String(k).padStart(2, '0')}.json`] = null;
    stubFetch(failing);
    dispose = init();
    await search(header(), 'rarp');
    expect(el('.search-empty', popOf(header())).hidden).toBe(false);
  });

  test('a failing index leaves numbers and questions working, and the empty state explains', async () => {
    stubFetch({ ...routes, '/data/search/meta.json': null });
    dispose = init();
    await search(header(), '903');
    expect(rowText(must(rows(header())[0])).href).toBe('/903/');
    await search(header(), 'zzzzqqq');
    expect(el('.search-empty', popOf(header())).hidden).toBe(false);
  });

  test('a network error on questions is treated as no questions', async () => {
    stubFetch({ ...routes, '/data/questions.json': new Error('offline') });
    dispose = init();
    await search(header(), 'rarp');
    expect(rows(header()).length).toBeGreaterThan(0);
  });

  test('a late failure after the index loaded is retried on the next search', async () => {
    let fail = true;
    stubFetch({ ...routes, '/data/search/meta.json': () => (fail ? new Error('flaky') : routes['/data/search/meta.json']) });
    dispose = init();
    await search(header(), 'rarp');
    expect(rows(header()).length).toBe(0);
    fail = false;
    await search(header(), 'rarp ');
    expect(rows(header()).length).toBeGreaterThan(0);
  });
});

describe('empty state', () => {
  test('a miss longer than two characters offers to suggest the question', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'zzzzqqq');
    const empty = el('.search-empty', popOf(header()));
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toContain('No matching RFC or question');
    const a = el<HTMLAnchorElement>('a', empty);
    expect(a.textContent).toBe('suggest this question');
    expect(a.href).toContain('issues/new?template=question.yml&title=zzzzqqq');
    expect(rows(header()).length).toBe(0);
  });

  test('the suggestion link encodes the query', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'qqq & zzz?');
    expect(el<HTMLAnchorElement>('.search-empty a', popOf(header())).href).toContain('title=qqq%20%26%20zzz%3F');
  });

  test('a miss of one or two characters just closes the popup', async () => {
    stubFetch(routes);
    dispose = init();
    header().value = 'zq';
    header().dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 150));
    expect(popOf(header()).hidden).toBe(true);
  });

  test('the empty message is cleared when results come back', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'zzzzqqq');
    await search(header(), 'rarp');
    expect(el('.search-empty', popOf(header())).hidden).toBe(true);
    expect(el('.search-empty', popOf(header())).textContent).toBe('');
  });
});

describe('keyboard', () => {
  test('arrows move the active option with wrap-around and update aria-activedescendant', async () => {
    stubFetch(routes);
    dispose = init();
    const input = header();
    await search(input, 'address');
    const list = rows(input);
    expect(list.length).toBeGreaterThan(1);
    expect(list.every((r) => r.getAttribute('aria-selected') === 'false')).toBe(true);
    const down = key(input, 'ArrowDown');
    expect(down.defaultPrevented).toBe(true);
    expect(list[0]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(list[0]?.id);
    key(input, 'ArrowDown');
    expect(list[1]?.getAttribute('aria-selected')).toBe('true');
    expect(list[0]?.getAttribute('aria-selected')).toBe('false');
    key(input, 'ArrowUp');
    key(input, 'ArrowUp'); // wraps to the last
    expect(list.at(-1)?.getAttribute('aria-selected')).toBe('true');
    key(input, 'ArrowDown'); // wraps to the first
    expect(list[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('ArrowUp with nothing active selects the last option', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'address');
    key(header(), 'ArrowUp');
    expect(rows(header()).at(-1)?.getAttribute('aria-selected')).toBe('true');
  });

  test('arrows are ignored while the popup is closed', () => {
    stubFetch(routes);
    dispose = init();
    expect(key(header(), 'ArrowDown').defaultPrevented).toBe(false);
  });

  test('Enter opens the active option, or the first when none is active', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'address');
    const list = rows(header());
    const e = key(header(), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(go).toHaveBeenLastCalledWith(list[0]?.href);
    key(header(), 'ArrowDown');
    key(header(), 'ArrowDown');
    key(header(), 'Enter');
    expect(go).toHaveBeenLastCalledWith(list[1]?.href);
  });

  test('Enter before the debounce fires runs the search now and opens the best match', async () => {
    stubFetch(routes);
    dispose = init();
    header().value = '903';
    header().dispatchEvent(new Event('input'));
    const e = key(header(), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => go.mock.calls.length > 0);
    expect(go).toHaveBeenCalledWith('/903/');
  });

  test('typing again cancels a pending Enter-to-open', async () => {
    stubFetch(routes);
    dispose = init();
    header().value = '903';
    header().dispatchEvent(new Event('input'));
    key(header(), 'Enter');
    header().value = '90';
    header().dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 200));
    expect(go).not.toHaveBeenCalled();
  });

  test('Enter on a bare number with the popup closed jumps straight to the page', () => {
    stubFetch(routes);
    dispose = init();
    header().value = '1918';
    const e = key(header(), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(go).toHaveBeenCalledWith('/1918/');
  });

  test('Enter on non-numbers with the popup closed does nothing', () => {
    stubFetch(routes);
    dispose = init();
    header().value = 'tcp';
    expect(key(header(), 'Enter').defaultPrevented).toBe(false);
    header().value = '0';
    expect(key(header(), 'Enter').defaultPrevented).toBe(false);
    expect(go).not.toHaveBeenCalled();
  });

  test('Escape closes the popup', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'rarp');
    key(header(), 'Escape');
    expect(popOf(header()).hidden).toBe(true);
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(header().hasAttribute('aria-activedescendant')).toBe(false);
  });

  test('other keys are left alone', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'rarp');
    expect(key(header(), 'a').defaultPrevented).toBe(false);
    expect(popOf(header()).hidden).toBe(false);
  });

  test('hovering an option makes it active; the active option survives a re-render', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'address');
    const list = rows(header());
    const second = must(list[1]);
    second.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(second.getAttribute('aria-selected')).toBe('true');
    second.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); // no-op when already active
    expect(header().getAttribute('aria-activedescendant')).toBe(second.id);
  });

  test('clicking outside closes the popup; clicking inside the box does not', async () => {
    stubFetch(routes);
    dispose = init();
    await search(header(), 'rarp');
    header().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(popOf(header()).hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(popOf(header()).hidden).toBe(true);
  });
});

describe('suggestion pills', () => {
  test('clicking a pill fills the hero search, focuses it and runs the query', async () => {
    stubFetch(routes);
    dispose = init();
    click(el('[data-search-fill="2119"]'));
    expect(hero().value).toBe('2119');
    expect(document.activeElement).toBe(hero());
    await waitFor(() => !popOf(hero()).hidden);
    expect(rowText(must(rows(hero())[0])).label).toBe('RFC 2119');
  });

  test('a pill with a question runs the question search', async () => {
    stubFetch(routes);
    dispose = init();
    const pill = el('[data-search-fill]');
    pill.setAttribute('data-search-fill', 'diskless computer');
    click(pill);
    await waitFor(() => !popOf(hero()).hidden);
    expect(hero().value).toBe('diskless computer');
  });

  test('without a hero input the first input is used; with no input nothing happens', async () => {
    stubFetch(routes);
    el('.search-hero').classList.remove('search-hero');
    dispose = init();
    click(el('[data-search-fill="2119"]'));
    expect(els<HTMLInputElement>('.search-input').filter((i) => i.value === '2119').length).toBe(1);
    dispose();
    mount(fixture('hero-search.html'));
    for (const i of els('.search-input')) i.remove();
    dispose = init();
    expect(() => click(el('[data-search-fill]'))).not.toThrow();
  });

  test('a pill without a data value falls back to its text', async () => {
    stubFetch(routes);
    dispose = init();
    const pill = el('[data-search-fill]');
    pill.setAttribute('data-search-fill', '');
    click(pill);
    expect(hero().value).toBe(pill.textContent);
  });
});

describe('stale responses', () => {
  test('an older, slower lookup never overwrites a newer one', async () => {
    let releaseOld: () => void = () => {};
    const gate = new Promise<void>((r) => {
      releaseOld = r;
    });
    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = routes[url];
      if (body === undefined) return new Response('nf', { status: 404 });
      if (url === '/data/coverage.json' && fetchSpy.mock.calls.filter((c) => String(c[0]) === url).length === 1) await gate;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    dispose = init();
    const input = header();
    input.value = '903';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => fetchSpy.mock.calls.length > 0);
    await new Promise((r) => setTimeout(r, 120)); // old lookup is now blocked inside getCoverage
    input.value = 'rarp';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => !popOf(input).hidden);
    await new Promise((r) => setTimeout(r, 30));
    const shown = rows(input).map((r) => r.getAttribute('href'));
    releaseOld();
    await new Promise((r) => setTimeout(r, 50));
    expect(rows(input).map((r) => r.getAttribute('href'))).toEqual(shown);
  });
});
