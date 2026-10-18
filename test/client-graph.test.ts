// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nav } from '../src/scripts/dom';
import { init } from '../src/scripts/graph';
import { el, els, fixture, key, mount, navigateTo, resetDocument, setUrl, stubFetch, tick, waitFor } from './dom-helpers';
import { dataRoutes, fixtureSite } from './site-fixture';

const routes = dataRoutes(fixtureSite());
const realGraph = routes['/data/graph.json'];

let dispose: () => void = () => {};
let go: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetDocument('https://rfc.akl.run/graph');
  mount(fixture('graph.html'));
  go = vi.spyOn(nav, 'to').mockImplementation(() => {});
});
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', () => Promise.reject(new Error('unexpected fetch after test')));
});

const stage = () => el('#graph');
const input = () => el<HTMLInputElement>('#graph-n');
const nodes = () => els<SVGGElement>('g.graph-node', stage() as unknown as ParentNode);
const nodeNums = () => nodes().map((g) => el('.graph-num', g as unknown as ParentNode).textContent);
const edges = () => els('path.graph-edge', stage() as unknown as ParentNode).length;
const msg = () => stage().querySelector('.graph-msg')?.textContent;

/** A hand-made neighbourhood: 1542 obsoletes 1497, updates 951 and 1084 (which obsoletes 900); 2131 and 2132 replace it (2131 is replaced by 3000). */
const G = {
  '1542': { o: [1497], ob: [2131, 2132], u: [951, 1084], ub: [], t: 'Clarifications', y: 1993 },
  '1497': { o: [1084], ob: [1542], u: [951], ub: [], t: 'BOOTP Vendor', y: 1993 },
  '1084': { o: [900], ob: [1497], u: [], ub: [1542], t: 'Vendor Ext', y: 1988 },
  '951': { o: [], ob: [], u: [], ub: [1497, 1542], t: 'Bootstrap Protocol', y: 1985 },
  '900': { o: [], ob: [1084], u: [], ub: [], t: 'Old', y: 1984 },
  '2131': { o: [1542], ob: [3000], u: [], ub: [], t: 'DHCP', y: 1997 },
  '2132': { o: [1542], ob: [], u: [], ub: [], t: 'DHCP Options and BOOTP Vendor Extensions', y: 1997 },
  '3000': { o: [2131], ob: [], u: [], ub: [], t: 'Next', y: 2000 },
};

/** Open /graph/<hash> with the given graph.json and wait for the first graph render (or a message). */
async function start(hash: string, graph: unknown = G): Promise<void> {
  await navigateTo(`https://rfc.akl.run/graph${hash}`);
  stubFetch({ '/data/graph.json': graph });
  dispose = init();
  await waitFor(() => msg() !== 'Loading graph…');
  await tick();
}

describe('what is shown', () => {
  test('without a number, prompts for one', async () => {
    await start('');
    expect(msg()).toBe('Enter an RFC number to see its neighborhood.');
    expect(nodes().length).toBe(0);
  });

  test('shows "Loading graph…" until the data arrives', async () => {
    await navigateTo('https://rfc.akl.run/graph#1542');
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    dispose = init();
    expect(msg()).toBe('Loading graph…');
  });

  test('renders the subject with predecessors on the left and successors on the right, two hops deep', async () => {
    await start('#1542');
    expect(nodeNums().sort()).toEqual(['RFC 1084', 'RFC 1497', 'RFC 1542', 'RFC 2131', 'RFC 2132', 'RFC 3000', 'RFC 900', 'RFC 951']);
    const center = el('g.is-center', stage() as unknown as ParentNode);
    expect(el('.graph-num', center as unknown as ParentNode).textContent).toBe('RFC 1542');
    expect(center.getAttribute('aria-label')).toMatch(/^RFC 1542.*\(selected\)$/);
    const x = (n: string) =>
      Number(
        el(
          'rect',
          nodes().find((g) => el('.graph-num', g as unknown as ParentNode).textContent === n) as unknown as ParentNode,
        ).getAttribute('x'),
      );
    expect(x('RFC 1497')).toBeLessThan(x('RFC 1542'));
    expect(x('RFC 2131')).toBeGreaterThan(x('RFC 1542'));
    expect(edges()).toBe(9); // left: 3 + 3 relations walked, right: 2 + 1
    expect(el('svg', stage() as unknown as ParentNode).getAttribute('aria-label')).toBe('Graph around RFC 1542');
    expect(stage().textContent).toContain('← obsoleted / updated by this');
    expect(stage().textContent).toContain('obsoleted / updated by →');
    expect(el<HTMLAnchorElement>('.graph-foot a').getAttribute('href')).toBe('/rfc1542');
    expect(el('.graph-foot a').textContent).toBe('Open RFC 1542');
    expect(el('.graph-foot').textContent).not.toContain('No obsoletes');
  });

  test('labels carry the short title (truncated), and the tooltip has title and year', async () => {
    await start('#1542');
    const long = nodes().find((g) => g.getAttribute('aria-label')?.startsWith('RFC 2132'));
    expect(long?.querySelector('title')?.textContent).toBe('DHCP Options and BOOTP Vendor Extensions (1997)');
    expect(long?.querySelector('.graph-label')?.textContent).toBe('DHCP Option…');
    for (const label of els('.graph-label', stage() as unknown as ParentNode))
      expect((label.textContent ?? '').length).toBeLessThanOrEqual(12);
  });

  test('the real built graph data renders too (RFC 951 and the RFCs that updated it)', async () => {
    await start('#951', realGraph);
    expect(nodeNums()).toContain('RFC 951');
    expect(nodeNums()).toContain('RFC 1542');
    expect(el('g.is-center', stage() as unknown as ParentNode).getAttribute('aria-label')).toContain('Bootstrap Protocol');
  });

  test('an RFC with no relations says so', async () => {
    await start('#903');
    expect(nodeNums()).toEqual(['RFC 903']);
    expect(el('.graph-foot').textContent).toContain('No obsoletes or updates relations recorded.');
    expect(edges()).toBe(0);
  });

  test('relations to numbers missing from the data still render as bare nodes', async () => {
    await start('#5', { '5': { o: [4], ob: [], u: [], ub: [], t: 'Five', y: 1970 } });
    expect(nodeNums().sort()).toEqual(['RFC 4', 'RFC 5']);
    const bare = nodes().find((g) => g.getAttribute('aria-label') === 'RFC 4');
    expect(bare?.querySelector('title')?.textContent).toBe('RFC 4');
    expect(bare?.querySelector('.graph-label')).toBeNull();
  });

  test('crowded columns are capped at 14 with a "+N more" marker', async () => {
    const many = Array.from({ length: 20 }, (_, i) => 100 + i);
    await start('#1', { '1': { o: many, ob: [], u: [], ub: [], t: 'Hub' } });
    expect(nodes().length).toBe(1 + 14);
    expect(stage().textContent).toContain('+6 more');
  });

  test('cycles and duplicate links do not loop or duplicate nodes', async () => {
    await start('#1', { '1': { o: [2, 2], u: [2], ob: [2], ub: [], t: 'A' }, '2': { o: [1], u: [], ob: [1], ub: [1], t: 'B' } });
    expect(nodeNums().sort()).toEqual(['RFC 1', 'RFC 2']);
  });
});

describe('hash and query handling', () => {
  test('?n= is normalised to #n and fills the form', async () => {
    await start('?n=1542');
    expect(location.hash).toBe('#1542');
    expect(location.search).toBe('');
    expect(input().value).toBe('1542');
    expect(nodeNums()).toContain('RFC 1542');
  });

  test('#n fills the form too; a hash wins over ?n=', async () => {
    await start('?n=1#903');
    expect(input().value).toBe('903');
    expect(nodeNums()).toEqual(['RFC 903']);
  });

  test('non-numeric hashes and queries are ignored', async () => {
    await start('?n=abc#top');
    expect(msg()).toBe('Enter an RFC number to see its neighborhood.');
    expect(input().value).toBe('');
  });

  test('if history cannot be rewritten the hash is set directly', async () => {
    vi.spyOn(history, 'replaceState').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    await start('?n=903');
    expect(location.hash).toBe('#903');
  });

  test('hashchange re-renders around the new number and updates the form', async () => {
    await start('#1542');
    setUrl('https://rfc.akl.run/graph#951');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(input().value).toBe('951');
    expect(nodeNums()).toContain('RFC 951');
    expect(el('g.is-center', stage() as unknown as ParentNode).getAttribute('aria-label')).toMatch(/^RFC 951/);
    setUrl('https://rfc.akl.run/graph#');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(msg()).toBe('Enter an RFC number to see its neighborhood.');
    expect(input().value).toBe('951'); // an empty hash leaves the typed value alone
  });

  test('dispose stops following the hash', async () => {
    await start('#1542');
    dispose();
    setUrl('https://rfc.akl.run/graph#951');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(el('g.is-center', stage() as unknown as ParentNode).getAttribute('aria-label')).toMatch(/^RFC 1542/);
  });
});

describe('form', () => {
  test('submitting a positive number sets the hash; anything else is ignored', async () => {
    await start('');
    input().value = '1084';
    const ev = new Event('submit', { cancelable: true, bubbles: true });
    el('#graph-form').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(location.hash).toBe('#1084');
    for (const bad of ['', '0', '-3', 'abc']) {
      setUrl('https://rfc.akl.run/graph');
      input().value = bad;
      el('#graph-form').dispatchEvent(new Event('submit', { cancelable: true }));
      expect(location.hash).toBe('');
    }
  });
});

describe('interaction', () => {
  test('clicking a neighbour re-centres via the hash; clicking the centre does nothing', async () => {
    await start('#1542');
    const find = (num: string) => nodes().find((g) => g.getAttribute('aria-label')?.startsWith(num)) as SVGGElement;
    find('RFC 1542').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(location.hash).toBe('#1542');
    find('RFC 2131').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(location.hash).toBe('#2131');
  });

  test('double-click opens the RFC page', async () => {
    await start('#1542');
    nodes()[0]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(go).toHaveBeenCalledWith(expect.stringMatching(/^\/rfc\d+$/));
  });

  test('Enter re-centres on a neighbour and opens the centre; other keys do nothing', async () => {
    await start('#1542');
    const find = (num: string) => nodes().find((g) => g.getAttribute('aria-label')?.startsWith(num)) as SVGGElement;
    key(find('RFC 2132'), 'Enter');
    expect(location.hash).toBe('#2132');
    expect(go).not.toHaveBeenCalled();
    key(find('RFC 1542'), 'Enter');
    expect(go).toHaveBeenCalledWith('/rfc1542');
    go.mockClear();
    key(find('RFC 1542'), ' ');
    expect(go).not.toHaveBeenCalled();
  });

  test('nodes are focusable links for keyboard users', async () => {
    await start('#1542');
    for (const g of nodes()) {
      expect(g.getAttribute('tabindex')).toBe('0');
      expect(g.getAttribute('role')).toBe('link');
    }
  });
});

describe('failures', () => {
  test('an HTTP error shows a message instead of the graph', async () => {
    await navigateTo('https://rfc.akl.run/graph#1542');
    stubFetch({});
    dispose = init();
    await waitFor(() => msg() === 'Could not load the graph data.');
    expect(nodes().length).toBe(0);
  });

  test('a network error is reported the same way', async () => {
    await navigateTo('https://rfc.akl.run/graph#1542');
    stubFetch({ '/data/graph.json': new Error('offline') });
    dispose = init();
    await waitFor(() => msg() === 'Could not load the graph data.');
  });

  test('pages without #graph are left alone; a missing form is tolerated', async () => {
    mount('<p>hi</p>');
    const { calls } = stubFetch(routes);
    dispose = init();
    expect(calls).toEqual([]);
    mount('<div id="graph"></div>');
    await navigateTo('https://rfc.akl.run/graph#903');
    stubFetch({ '/data/graph.json': realGraph });
    dispose = init();
    await waitFor(() => stage().querySelector('svg') !== null);
  });
});
