// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init } from '../src/scripts/sim';
import { click, el, els, fixture, mount, resetDocument, setUrl, stubMatchMedia } from './dom-helpers';

type Json = Record<string, unknown>;

let dispose: () => void = () => {};
let scrolled: Element[] = [];

beforeEach(() => {
  resetDocument('https://rfc.akl.run/rfc903');
  mount(fixture('rfc-903.html'));
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  // happy-dom ships a matchMedia; make the default explicit: motion allowed.
  stubMatchMedia(false);
});
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fig = () => el('figure[data-viz="sequence-sim"]');
const dataScript = () => el('script.sim-data', fig());
const readData = (): Json => JSON.parse(dataScript().textContent ?? '{}');
/** Rewrite the embedded sim data before init, as a component with different content would. */
function editData(fn: (d: Json) => void): void {
  const d = readData();
  fn(d);
  dataScript().textContent = JSON.stringify(d);
}

const primary = () => el<HTMLButtonElement>('.sim-primary', fig());
const prev = () => el<HTMLButtonElement>('.sim-btn', fig());
const segs = () => els<HTMLButtonElement>('.sim-seg', fig());
const eyebrow = () => el('.sim-eyebrow', fig()).textContent;
const title = () => el('.sim-step-title', fig()).textContent;
const sw = () => el<HTMLButtonElement>('.sim-switch', fig());
const nodeState = (label: string) => {
  const n = els('.sim-node', fig()).find((x) => el('.sim-name', x).textContent === label);
  if (!n) throw new Error(`no node ${label}`);
  return n;
};
const lensBody = (k: string) => el(`.sim-lensbody[data-level="${k}"]`, fig());
const row = (key: string) => els('.sim-row', fig()).find((r) => el('.k', r).textContent === key.toUpperCase()) as HTMLElement;

describe('structure', () => {
  test('builds the stage, controls, narrative, inspector, table and replaced-by card', () => {
    dispose = init();
    expect(els('.sim-node', fig()).map((n) => el('.sim-name', n).textContent)).toEqual([
      'Diskless client',
      'Host',
      'Host',
      'RARP server',
      'Router',
    ]);
    expect(segs().length).toBe(6);
    expect(segs()[2]?.getAttribute('aria-label')).toBe('Go to step 3: Ordinary hosts ignore it');
    expect(els('.sim-lens button', fig()).map((b) => b.getAttribute('data-lens'))).toEqual(['eli5', 'std', 'orig']);
    expect(els('.sim-row', fig()).length).toBe(9);
    expect(el('.sim-lookup-h b', fig()).textContent).toBe("Server's lookup table");
    expect(els('.sim-lrow', fig()).length).toBe(4);
    expect(els('.sim-rep', fig()).map((a) => a.getAttribute('href'))).toEqual(['/rfc951', '/rfc2131']);
    expect(el('.sim-switch', fig()).textContent).toBe('Put the server behind a router');
    expect(el('.sim-lensbody[data-level="orig"] a', fig()).getAttribute('href')).toBe('https://www.rfc-editor.org/rfc/rfc903');
  });

  test('the server <ol> fallback stays for assistive tech but is hidden and its links are inert', () => {
    dispose = init();
    const fb = el('.sim-fallback', fig());
    expect(fb.classList.contains('visually-hidden')).toBe(true);
    for (const r of els('.sim-replaced', fb)) {
      expect(r.hasAttribute('inert')).toBe(true);
      expect(r.getAttribute('aria-hidden')).toBe('true');
    }
  });

  test('a figure without data, with broken data or with no steps is left alone', () => {
    dataScript().textContent = '{not json';
    dispose = init();
    expect(document.querySelector('.sim-ui')).toBeNull();
    dispose();
    mount(fixture('rfc-903.html'));
    editData((d) => {
      d.steps = [];
    });
    dispose = init();
    expect(document.querySelector('.sim-ui')).toBeNull();
    dispose();
    mount(fixture('rfc-903.html'));
    dataScript().remove();
    dispose = init();
    expect(document.querySelector('.sim-ui')).toBeNull();
    dispose();
    mount(fixture('rfc-903.html'));
    el('.sim', fig()).remove();
    dispose = init();
    expect(document.querySelector('.sim-ui')).toBeNull();
  });

  test('optional parts are omitted when the data lacks them', () => {
    editData((d) => {
      d.router = null;
      d.failureSteps = [];
      d.table = undefined;
      d.replacedBy = undefined;
      d.packetFields = undefined;
    });
    el('.sim', fig()).removeAttribute('data-rfc');
    el('.viz-cap-bar', fig()).remove();
    dispose = init();
    expect(document.querySelector('.sim-switch')).toBeNull();
    expect(document.querySelector('.sim-lower2')).toBeNull();
    expect(els('.sim-row').length).toBe(0);
    expect(document.querySelector('.sim-lensbody[data-level="orig"] a')).toBeNull();
    expect(els('.sim-node').length).toBe(4);
  });

  test('a replaced-by card without a lookup table is laid out as a single column; the note is shown', () => {
    editData((d) => {
      d.table = undefined;
      d.replacedNote = 'BOOTP and DHCP took over.';
    });
    dispose = init();
    expect(el('.sim-lower2', fig()).classList.contains('is-single')).toBe(true);
    expect(el('.sim-replaced-card p', fig()).textContent).toBe('BOOTP and DHCP took over.');
  });

  test('a lookup table without replacements, and a table caption', () => {
    editData((d) => {
      d.replacedBy = [];
      (d.table as Json).caption = 'by MAC';
    });
    dispose = init();
    expect(document.querySelector('.sim-replaced-card')).toBeNull();
    expect(el('.sim-lookup-h span', fig()).textContent).toBe('by MAC');
  });
});

describe('stepping', () => {
  test('starts at step 1 with Previous disabled and the first step described', () => {
    dispose = init();
    expect(eyebrow()).toBe('step 1 of 6 · boot');
    expect(title()).toBe('A workstation powers on knowing only its MAC');
    expect(prev().disabled).toBe(true);
    expect(primary().textContent).toBe('Play step 1 →');
    expect(segs()[0]?.getAttribute('aria-current')).toBe('step');
    expect(segs().map((s) => s.classList.contains('is-on'))).toEqual([true, false, false, false, false, false]);
    expect(el('.sim-permalink', fig()).textContent).toBe('rfc.akl.run/rfc903#step-1');
    expect(el('.sim-permalink', fig()).getAttribute('href')).toBe('#step-1');
  });

  test('Next advances, updates the hash, node states, packet and inspector', () => {
    dispose = init();
    click(primary());
    expect(eyebrow()).toBe('step 2 of 6 · broadcast');
    expect(location.hash).toBe('#step-2');
    expect(prev().disabled).toBe(false);
    expect(primary().textContent).toBe('Next step →');
    expect(nodeState('Host').getAttribute('data-state')).toBe('hears');
    expect(el('.sim-pill', fig()).textContent).toBe('op 3 · broadcast');
    expect(el('.sim-packet', fig()).style.left).toBe('88%');
    expect(el('.sim-packet', fig()).style.opacity).toBe('1');
    expect(row('oper').classList.contains('is-hl')).toBe(true);
    expect(row('htype').classList.contains('is-hl')).toBe(false);
    expect(row('htype').querySelector('.v')?.textContent).toBe('1');
    expect(el('.sim-insp-h span', fig()).textContent).toBe('RARP request · 28 bytes');
  });

  test('a step with a packet opacity and ignoring hosts', () => {
    dispose = init();
    click(segs()[2] as HTMLElement);
    expect(el('.sim-packet', fig()).style.opacity).toBe('0.35');
    expect(nodeState('Host').getAttribute('data-state')).toBe('ignores');
    expect(el('.sim-tile', nodeState('Host')).textContent).toBe('–');
  });

  test('a step without a packet label hides the packet but keeps its position and colour', () => {
    dispose = init();
    click(segs()[3] as HTMLElement);
    expect(el('.sim-packet', fig()).style.opacity).toBe('0');
    expect(el('.sim-packet', fig()).style.getPropertyValue('--c')).toBe('var(--sim-violet)');
  });

  test('Previous steps back and cannot go before step 1', () => {
    dispose = init();
    click(segs()[3] as HTMLElement);
    click(prev());
    expect(eyebrow()).toMatch(/^step 3 of 6/);
    click(prev());
    click(prev());
    expect(eyebrow()).toMatch(/^step 1 of 6/);
    expect(prev().disabled).toBe(true);
    click(prev()); // a disabled button's click handler still clamps
    expect(eyebrow()).toMatch(/^step 1 of 6/);
  });

  test('the last step offers Restart, which returns to step 1; the client shows a check mark when done', () => {
    dispose = init();
    click(segs()[5] as HTMLElement);
    expect(primary().textContent).toBe('Restart');
    expect(el('.sim-tile', nodeState('Diskless client')).textContent).toBe('✓');
    click(primary());
    expect(eyebrow()).toMatch(/^step 1 of 6/);
    expect(el('.sim-tile', nodeState('Diskless client')).textContent).toBe('?');
    expect(location.hash).toBe('#step-1');
  });

  test('segments jump to any step; aria-current follows; the lookup row matches from the configured step', () => {
    dispose = init();
    click(segs()[4] as HTMLElement);
    expect(segs().filter((s) => s.hasAttribute('aria-current')).length).toBe(1);
    expect(segs()[4]?.getAttribute('aria-current')).toBe('step');
    expect(els('.sim-lrow', fig())[0]?.classList.contains('is-match')).toBe(true); // fromStep 4, now on step 5
    click(segs()[1] as HTMLElement);
    expect(els('.sim-lrow', fig())[0]?.classList.contains('is-match')).toBe(false);
  });

  test('a history failure does not stop stepping', () => {
    vi.spyOn(history, 'replaceState').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    dispose = init();
    click(primary());
    expect(eyebrow()).toMatch(/^step 2/);
  });

  test('the permalink chip does not navigate', () => {
    dispose = init();
    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    el('.sim-permalink', fig()).dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  test('the eyebrow omits the tag separator when a step has no tag; why row hides when absent', () => {
    editData((d) => {
      const steps = d.steps as Json[];
      delete (steps[0] as Json).tag;
      delete (steps[0] as Json).why;
    });
    dispose = init();
    expect(eyebrow()).toBe('step 1 of 6');
    expect(el('.sim-whyrow', fig()).hidden).toBe(true);
    click(primary());
    expect(el('.sim-whyrow', fig()).hidden).toBe(false);
    expect(el('.sim-whytext', fig()).textContent).toContain('shouting');
  });

  test('packet fields missing from a step read as an em dash; inspector title falls back to the data title', () => {
    editData((d) => {
      const steps = d.steps as Json[];
      (steps[0] as Json).packet = { htype: '1' };
      delete (steps[0] as Json).packetTitle;
      delete d.packetTitle;
    });
    dispose = init();
    expect(row('htype').querySelector('.v')?.textContent).toBe('1');
    expect(row('oper').querySelector('.v')?.textContent).toBe('—');
    expect(el('.sim-insp-h span', fig()).textContent).toBe('RARP on one Ethernet segment');
  });
});

describe('URL hash', () => {
  test('#step-N opens at that step and scrolls the figure into view', () => {
    setUrl('https://rfc.akl.run/rfc903#step-4');
    dispose = init();
    expect(eyebrow()).toMatch(/^step 4 of 6/);
    expect(scrolled).toEqual([fig()]);
  });

  test('out-of-range steps clamp to the last; zero and garbage are ignored', () => {
    setUrl('https://rfc.akl.run/rfc903#step-99');
    dispose = init();
    expect(eyebrow()).toMatch(/^step 6 of 6/);
    for (const h of ['#step-0', '#step-x', '#other', '']) {
      dispose();
      mount(fixture('rfc-903.html'));
      setUrl(`https://rfc.akl.run/rfc903${h}`);
      scrolled = [];
      dispose = init();
      expect(eyebrow()).toMatch(/^step 1 of 6/);
      expect(scrolled).toEqual([]);
    }
  });

  test('hashchange moves the simulator; an unrelated hash leaves it alone', () => {
    dispose = init();
    setUrl('https://rfc.akl.run/rfc903#step-3');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(eyebrow()).toMatch(/^step 3/);
    setUrl('https://rfc.akl.run/rfc903#elsewhere');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(eyebrow()).toMatch(/^step 3/);
  });

  test('dispose removes the hashchange listener', () => {
    dispose = init();
    dispose();
    setUrl('https://rfc.akl.run/rfc903#step-3');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(eyebrow()).toMatch(/^step 1/);
  });
});

describe('explanation lens', () => {
  test('defaults to the engineer lens', () => {
    dispose = init();
    expect(lensBody('std').hidden).toBe(false);
    expect(lensBody('eli5').hidden).toBe(true);
    expect(lensBody('orig').hidden).toBe(true);
    expect(el('.sim-lens button[data-lens="std"]', fig()).getAttribute('aria-pressed')).toBe('true');
    expect(lensBody('std').textContent).toContain('48-bit Ethernet address');
  });

  test('buttons switch the lens, persist it, and the text follows', () => {
    dispose = init();
    click(el('.sim-lens button[data-lens="eli5"]', fig()));
    expect(lensBody('eli5').hidden).toBe(false);
    expect(lensBody('std').hidden).toBe(true);
    expect(lensBody('eli5').textContent).toContain('The computer wakes up');
    expect(localStorage.getItem('rfc-lens')).toBe('eli5');
    click(el('.sim-lens button[data-lens="orig"]', fig()));
    expect(lensBody('orig').textContent).toContain('Network hosts such as diskless workstations');
    click(primary());
    expect(lensBody('orig').textContent).toContain('Read in RFC 903');
    expect(el('.sim-lens button[data-lens="orig"]', fig()).getAttribute('aria-pressed')).toBe('true');
    expect(el('.sim-lens button[data-lens="eli5"]', fig()).getAttribute('aria-pressed')).toBe('false');
  });

  test('a stored lens wins; otherwise the page reading level decides', () => {
    localStorage.setItem('rfc-lens', 'orig');
    localStorage.setItem('rfc-level', 'eli5');
    dispose = init();
    expect(lensBody('orig').hidden).toBe(false);
    dispose();
    localStorage.setItem('rfc-lens', 'bogus');
    mount(fixture('rfc-903.html'));
    dispose = init();
    expect(lensBody('eli5').hidden).toBe(false);
    dispose();
    localStorage.clear();
    mount(fixture('rfc-903.html'));
    dispose = init();
    expect(lensBody('std').hidden).toBe(false);
  });

  test('unreadable storage falls back to the engineer lens and ignores write failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    dispose = init();
    expect(lensBody('std').hidden).toBe(false);
    click(el('.sim-lens button[data-lens="eli5"]', fig()));
    expect(lensBody('eli5').hidden).toBe(false);
  });
});

describe('router failure branch', () => {
  test('the toggle is a switch that starts off with the router hidden', () => {
    dispose = init();
    expect(sw().getAttribute('role')).toBe('switch');
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(nodeState('Router').style.display).toBe('none');
    expect(el('.sim-boundary', fig()).style.display).toBe('none');
    expect(nodeState('RARP server').style.left).toBe('68%');
    expect(el('.sim-bus', fig()).style.right).toBe('5%');
  });

  test('on step 1 enabling the router moves the server and shows the boundary but keeps the base step', () => {
    dispose = init();
    click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(nodeState('Router').style.display).toBe('');
    expect(nodeState('RARP server').style.left).toBe('90%');
    expect(el('.sim-boundary', fig()).style.left).toBe('79%');
    expect(el('.sim-boundary-label', fig()).style.left).toBe('80%');
    expect(el('.sim-bus2', fig()).style.left).toBe('82%');
    expect(el('.sim-bus', fig()).style.right).toBe('21%');
    expect(el('.sim-boundary-label', fig()).textContent).toBe('other subnet');
    expect(title()).toBe('A workstation powers on knowing only its MAC');
    expect(segs().some((s) => s.classList.contains('is-fail'))).toBe(false);
  });

  test('from step 2 the failure step replaces the normal one, the packet dies at the router with an X', () => {
    dispose = init();
    click(sw());
    click(primary());
    expect(title()).toBe('The request dies at the router');
    expect(nodeState('Router').getAttribute('data-state')).toBe('dropped');
    expect(el('.sim-sub', nodeState('Router')).textContent).toBe('drops broadcasts');
    expect(el('.sim-x', fig()).style.display).toBe('');
    expect(el('.sim-x', fig()).style.left).toBe('79%');
    expect(segs()[1]?.classList.contains('is-fail')).toBe(true);
    expect(segs()[0]?.classList.contains('is-fail')).toBe(false);
    // the lookup row never matches on the failure branch
    expect(els('.sim-lrow', fig()).some((r) => r.classList.contains('is-match'))).toBe(false);
  });

  test('past blockedThrough (default 2) the packet is held back and the X disappears', () => {
    dispose = init();
    click(sw());
    click(segs()[2] as HTMLElement);
    expect(el('.sim-packet', fig()).style.opacity).toBe('1');
    expect(el('.sim-x', fig()).style.display).toBe('');
    click(segs()[3] as HTMLElement);
    expect(el('.sim-packet', fig()).style.opacity).toBe('0');
    expect(el('.sim-x', fig()).style.display).toBe('none');
    // later steps keep reusing the single failure step
    click(segs()[5] as HTMLElement);
    expect(title()).toBe('The request dies at the router');
  });

  test('a configured blockedThrough moves that boundary', () => {
    editData((d) => {
      (d.router as Json).blockedThrough = 0;
    });
    dispose = init();
    click(sw());
    click(segs()[1] as HTMLElement);
    expect(el('.sim-packet', fig()).style.opacity).toBe('0');
    expect(el('.sim-x', fig()).style.display).toBe('none');
  });

  test('switching the router off restores the normal walk-through', () => {
    dispose = init();
    click(sw());
    click(segs()[1] as HTMLElement);
    click(sw());
    expect(title()).toBe('It shouts a RARP request to everyone');
    expect(nodeState('Router').style.display).toBe('none');
    expect(nodeState('RARP server').style.left).toBe('68%');
  });

  test('no switch is built when there are no failure steps', () => {
    editData((d) => {
      d.failureSteps = [];
    });
    dispose = init();
    expect(document.querySelector('.sim-switch')).toBeNull();
    expect(nodeState('Router').style.display).toBe('none');
  });

  test('the router label falls back to the first failure step that names it', () => {
    editData((d) => {
      const f = (d.failureSteps as Json[])[0] as { nodes: Record<string, Json> };
      const router = f.nodes.router as Json;
      f.nodes = { ...f.nodes };
      delete f.nodes.router;
      (d.failureSteps as Json[]).push({ ...(d.failureSteps as Json[])[0], nodes: { router } });
    });
    dispose = init();
    expect(el('.sim-sub', nodeState('Router')).textContent).toBe('drops broadcasts');
  });
});

describe('reduced motion', () => {
  test('the figure is marked when the user prefers reduced motion, and follows changes', () => {
    const mm = stubMatchMedia(true);
    dispose = init();
    expect(fig().classList.contains('is-reduced')).toBe(true);
    mm.set(false);
    expect(fig().classList.contains('is-reduced')).toBe(false);
    mm.set(true);
    expect(fig().classList.contains('is-reduced')).toBe(true);
    dispose();
    expect(mm.listeners.size).toBe(0);
  });

  test('without matchMedia the figure is never marked', () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    dispose = init();
    expect(fig().classList.contains('is-reduced')).toBe(false);
  });
});
