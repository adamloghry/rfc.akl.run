// Sequence simulator client script; self-initializes on all matching figures.
import { disposer, listen, onReady, qs, qsa, storageGet, storageSet } from './dom';

type Lens = 'eli5' | 'std' | 'orig';
type NodeKind = 'client' | 'host' | 'server' | 'router';
type NodeStateInfo = { state?: string; label?: string };

interface SimNode {
  key: string;
  label: string;
  kind: NodeKind;
  x: number;
  failureX?: number;
}
interface SimRouter {
  key: string;
  label: string;
  toggleLabel: string;
  boundaryX: number;
  boundaryLabel: string;
  blockedThrough?: number;
}
interface SimStep {
  tag?: string;
  title: string;
  eli5?: string;
  spec?: string;
  orig?: string;
  why?: string;
  packetTitle?: string;
  packet?: Record<string, string | number | null | undefined>;
  highlight?: string[];
  nodes?: Record<string, NodeStateInfo>;
  packetPos: number;
  packetLabel?: string;
  packetColor?: string;
  packetOpacity?: number;
}
interface SimData {
  title?: string;
  packetTitle?: string;
  nodes: SimNode[];
  router?: SimRouter | null;
  packetFields?: Array<{ key: string; name: string }>;
  table?: { title: string; caption?: string; rows: string[][]; matchRow?: number; fromStep?: number };
  steps: SimStep[];
  failureSteps?: SimStep[];
  replacedBy?: Array<{ number: number; label: string }>;
  replacedNote?: string;
}

const LENSES: Array<[Lens, string]> = [
  ['eli5', 'Like I’m 5'],
  ['std', 'Engineer'],
  ['orig', 'RFC text'],
];
const GLYPH: Record<string, string> = { client: '?', host: 'H', server: 'S', router: 'R' };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string | null): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function button(cls: string, label?: string): HTMLButtonElement {
  const b = h('button', cls, label);
  b.type = 'button';
  return b;
}

function parseData(el: Element): SimData | null {
  try {
    const d = JSON.parse(el.textContent ?? '') as SimData;
    return d?.steps?.length ? d : null;
  } catch {
    return null;
  }
}

function setup(fig: HTMLElement, off: ReturnType<typeof disposer>): void {
  const root = qs('.sim', fig);
  const dataEl = qs('script.sim-data', fig);
  if (!root || !dataEl) return;
  const data = parseData(dataEl);
  if (!data) return;

  const rfc = root.getAttribute('data-rfc') || '';
  const total = data.steps.length;
  const router = data.router || null;
  const fails = data.failureSteps || [];
  const blockedThrough = router && typeof router.blockedThrough === 'number' ? router.blockedThrough : 2;
  const state: { step: number; router: boolean; lens: Lens } = { step: 0, router: false, lens: 'std' };

  const stored = storageGet('rfc-lens');
  state.lens = stored === 'eli5' || stored === 'std' || stored === 'orig' ? stored : storageGet('rfc-level') === 'eli5' ? 'eli5' : 'std';

  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const applyMotion = (): void => {
    fig.classList.toggle('is-reduced', !!mq?.matches);
  };
  applyMotion();
  mq?.addEventListener?.('change', applyMotion);

  // ---- build UI -------------------------------------------------------
  const ui = h('div', 'sim-ui');

  // permalink chip in the figure caption bar
  const chip = h('a', 'sim-permalink');
  chip.addEventListener('click', (e) => e.preventDefault());
  qs('.viz-cap-bar', fig)?.appendChild(chip);

  // stage
  const wrap = h('div', 'sim-stage-wrap');
  const stage = h('div', 'sim-stage');
  wrap.appendChild(stage);
  const bus = h('div', 'sim-bus');
  const bus2 = h('div', 'sim-bus2');
  const boundary = h('div', 'sim-boundary');
  const bLabel = h('span', 'sim-boundary-label', router ? router.boundaryLabel : '');
  stage.append(boundary, bLabel, bus, bus2);

  type NodeEls = { el: HTMLElement; tile: HTMLElement; sub: HTMLElement; def: SimNode };
  const nodeEls: Record<string, NodeEls> = {};
  const nodeList: SimNode[] = data.nodes.slice();
  if (router) nodeList.push({ key: router.key, label: router.label, kind: 'router', x: router.boundaryX });
  for (const n of nodeList) {
    const el = h('div', 'sim-node');
    el.setAttribute('data-kind', n.kind);
    const tile = h('div', 'sim-tile', GLYPH[n.kind] || '');
    el.appendChild(tile);
    el.appendChild(h('div', 'sim-stem'));
    el.appendChild(h('span', 'sim-name', n.label));
    const sub = h('span', 'sim-sub');
    el.appendChild(sub);
    stage.appendChild(el);
    nodeEls[n.key] = { el, tile, sub, def: n };
  }
  const pkt = h('div', 'sim-packet');
  const pill = h('div', 'sim-pill');
  pkt.appendChild(pill);
  stage.appendChild(pkt);
  const xMark = h('div', 'sim-x', '✕');
  xMark.setAttribute('aria-hidden', 'true');
  stage.appendChild(xMark);

  // controls
  const controls = h('div', 'sim-controls');
  const prev = button('sim-btn', '←');
  prev.setAttribute('aria-label', 'Previous step');
  const primary = button('sim-primary');
  const segsEl = h('div', 'sim-segs');
  const segs = data.steps.map((s, i) => {
    const b = button('sim-seg');
    b.setAttribute('aria-label', `Go to step ${i + 1}: ${s.title}`);
    b.addEventListener('click', () => go(i));
    segsEl.appendChild(b);
    return b;
  });
  controls.append(prev, primary, segsEl);
  let sw: HTMLButtonElement | null = null;
  if (router && fails.length) {
    sw = button('sim-switch');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', 'false');
    sw.appendChild(h('span', 'sim-track'));
    sw.appendChild(h('span', '', router.toggleLabel));
    sw.addEventListener('click', () => {
      state.router = !state.router;
      render();
    });
    controls.appendChild(sw);
  }
  prev.addEventListener('click', () => go(Math.max(0, state.step - 1)));
  primary.addEventListener('click', () => go(state.step >= total - 1 ? 0 : state.step + 1));

  // narrative + inspector
  const lower = h('div', 'sim-lower');
  const narr = h('div', 'sim-card sim-narr');
  const top = h('div', 'sim-narr-top');
  const eyebrow = h('span', 'sim-eyebrow');
  const lensBox = h('div', 'sim-lens');
  lensBox.setAttribute('role', 'group');
  lensBox.setAttribute('aria-label', 'Explanation level');
  const lensBtns = LENSES.map(([key, label]) => {
    const b = button('', label);
    b.setAttribute('data-lens', key);
    b.addEventListener('click', () => {
      state.lens = key;
      storageSet('rfc-lens', key);
      render();
    });
    lensBox.appendChild(b);
    return b;
  });
  top.append(eyebrow, lensBox);
  const title = h('h3', 'sim-step-title');
  const eli5Body = h('p');
  const stdBody = h('p');
  const origText = document.createTextNode('');
  const lensWraps: Record<Lens, HTMLElement> = {
    eli5: h('div', 'sim-lensbody'),
    std: h('div', 'sim-lensbody'),
    orig: h('div', 'sim-lensbody'),
  };
  for (const k of ['eli5', 'std', 'orig'] as const) {
    const d = lensWraps[k];
    d.setAttribute('data-level', k);
    if (k === 'orig') {
      const box = h('div', 'sim-orig');
      box.appendChild(origText);
      box.appendChild(document.createElement('br'));
      if (rfc) {
        const a = h('a', '', `Read in RFC ${rfc} ↗`);
        a.href = `https://www.rfc-editor.org/rfc/rfc${rfc}`;
        box.appendChild(a);
      }
      d.appendChild(box);
    } else d.appendChild(k === 'eli5' ? eli5Body : stdBody);
    narr.appendChild(d);
  }
  // order: top, title, bodies, why
  narr.insertBefore(title, narr.firstChild);
  narr.insertBefore(top, narr.firstChild);
  const whyRow = h('div', 'sim-whyrow');
  whyRow.appendChild(h('span', 'sim-whybadge', 'WHY'));
  const whyText = h('span', 'sim-whytext');
  whyRow.appendChild(whyText);
  narr.appendChild(whyRow);

  const insp = h('div', 'sim-card sim-insp');
  const inspH = h('div', 'sim-insp-h');
  inspH.appendChild(h('b', '', 'Packet on the wire'));
  const inspTitle = h('span');
  inspH.appendChild(inspTitle);
  const rowsEl = h('div', 'sim-rows');
  const rowEls = (data.packetFields || []).map((f) => {
    const r = h('div', 'sim-row');
    const v = h('span', 'v');
    r.append(h('span', 'k', f.key.toUpperCase()), h('span', 'n', f.name), v);
    rowsEl.appendChild(r);
    return { key: f.key, el: r, v };
  });
  insp.appendChild(inspH);
  insp.appendChild(rowsEl);
  insp.appendChild(h('span', 'sim-foot', 'Highlighted fields matter in this step.'));
  lower.append(narr, insp);

  // lookup table + replaced
  let lower2: HTMLElement | null = null;
  const lookupRows: HTMLElement[] = [];
  const table = data.table;
  if (table || data.replacedBy?.length) {
    lower2 = h('div', 'sim-lower2');
    if (table) {
      const lk = h('div', 'sim-card sim-lookup');
      const lh = h('div', 'sim-lookup-h');
      lh.appendChild(h('b', '', table.title));
      if (table.caption) lh.appendChild(h('span', '', table.caption));
      const lb = h('div', 'sim-lookup-b');
      lb.setAttribute('role', 'table');
      lb.setAttribute('aria-label', table.title);
      for (const row of table.rows) {
        const r = h('div', 'sim-lrow');
        r.setAttribute('role', 'row');
        for (const c of row) {
          const s = h('span', '', c);
          s.setAttribute('role', 'cell');
          r.appendChild(s);
        }
        lb.appendChild(r);
        lookupRows.push(r);
      }
      lk.append(lh, lb);
      lower2.appendChild(lk);
    } else {
      lower2.className += ' is-single';
    }
    if (data.replacedBy?.length) {
      const rc = h('div', 'sim-card sim-replaced-card');
      rc.appendChild(h('b', '', 'What replaced it'));
      for (const r of data.replacedBy) {
        const a = h('a', 'sim-rep');
        a.href = `/${r.number}/`;
        a.append(h('span', '', r.label), h('span', '', `RFC ${r.number}`));
        rc.appendChild(a);
      }
      if (data.replacedNote) rc.appendChild(h('p', '', data.replacedNote));
      lower2.appendChild(rc);
    }
  }

  ui.append(wrap, controls, lower);
  if (lower2) ui.appendChild(lower2);
  root.appendChild(ui);
  // keep the <ol> fallback for screen readers only
  const fb = qs('.sim-fallback', root);
  if (fb) {
    fb.classList.add('visually-hidden');
    // no invisible tab stops: the visible UI has its own replaced-by links
    for (const r of qsa('.sim-replaced', fb)) {
      r.setAttribute('inert', '');
      r.setAttribute('aria-hidden', 'true');
    }
  }

  // ---- render ---------------------------------------------------------
  function current(): { s: SimStep; fail: boolean } {
    const fail = state.router && fails.length > 0 && state.step >= 1;
    const s = (fail ? fails[Math.min(state.step - 1, fails.length - 1)] : data?.steps[state.step]) as SimStep;
    return { s, fail };
  }

  function render(): void {
    const c = current();
    const s = c.s;
    const i = state.step;
    chip.textContent = `rfc.akl.run/${rfc}/#step-${i + 1}`;
    chip.href = `#step-${i + 1}`;

    // bus + boundary
    const rd = state.router ? '' : 'none';
    boundary.style.display = rd;
    bLabel.style.display = rd;
    bus2.style.display = rd;
    if (router) {
      boundary.style.left = `${router.boundaryX}%`;
      bLabel.style.left = `${router.boundaryX + 1}%`;
      bus2.style.left = `${router.boundaryX + 3}%`;
    }
    bus.style.right = state.router && router ? `${100 - router.boundaryX}%` : '5%';

    // nodes
    let routerLabel = '';
    for (const f of fails) if (!routerLabel && router && f.nodes?.[router.key]) routerLabel = f.nodes[router.key]?.label || '';
    for (const k of Object.keys(nodeEls)) {
      const n = nodeEls[k] as NodeEls;
      const def = n.def;
      const isRouter = !!router && k === router.key;
      const st: NodeStateInfo = s.nodes?.[k] || (isRouter ? { state: 'idle', label: routerLabel } : { state: 'idle', label: '' });
      n.el.style.display = !isRouter || state.router ? '' : 'none';
      let x = def.x;
      if (state.router && def.failureX !== undefined) x = def.failureX;
      n.el.style.left = `${x}%`;
      n.el.setAttribute('data-state', st.state || 'idle');
      n.sub.textContent = st.label || '';
      let g = GLYPH[def.kind] || '';
      if (def.kind === 'client' && st.state === 'done') g = '✓';
      if (def.kind === 'host' && st.state === 'ignores') g = '–';
      n.tile.textContent = g;
    }

    // packet
    const held = c.fail && i > blockedThrough;
    const shown = !!s.packetLabel && !held;
    pkt.style.left = `${s.packetPos}%`;
    pkt.style.opacity = String(shown ? (s.packetOpacity !== undefined ? s.packetOpacity : 1) : 0);
    pkt.style.setProperty('--c', `var(--sim-${s.packetColor || 'cyan'})`);
    pill.style.setProperty('--c', `var(--sim-${s.packetColor || 'cyan'})`);
    if (s.packetLabel) pill.textContent = s.packetLabel;
    const dropped = c.fail && router && s.nodes?.[router.key]?.state === 'dropped' && i <= blockedThrough;
    xMark.style.display = dropped ? '' : 'none';
    if (router) xMark.style.left = `${router.boundaryX}%`;

    // controls
    prev.disabled = i === 0;
    primary.textContent = i === 0 ? 'Play step 1 →' : i >= total - 1 ? 'Restart' : 'Next step →';
    segs.forEach((b, k) => {
      b.classList.toggle('is-on', k <= i);
      b.classList.toggle('is-fail', k <= i && c.fail && k >= 1);
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    sw?.setAttribute('aria-checked', state.router ? 'true' : 'false');

    // narrative
    eyebrow.textContent = `step ${i + 1} of ${total}${s.tag ? ` · ${s.tag}` : ''}`;
    title.textContent = s.title;
    eli5Body.textContent = s.eli5 || '';
    stdBody.textContent = s.spec || '';
    origText.nodeValue = s.orig || '';
    for (const k of ['eli5', 'std', 'orig'] as const) lensWraps[k].hidden = state.lens !== k;
    for (const b of lensBtns) b.setAttribute('aria-pressed', b.getAttribute('data-lens') === state.lens ? 'true' : 'false');
    whyText.textContent = s.why || '';
    whyRow.hidden = !s.why;

    // inspector
    inspTitle.textContent = s.packetTitle || data?.packetTitle || data?.title || '';
    const hl = s.highlight || [];
    for (const r of rowEls) {
      const v = s.packet?.[r.key];
      r.v.textContent = v === undefined || v === null ? '—' : String(v);
      r.el.classList.toggle('is-hl', hl.includes(r.key));
    }

    // lookup table
    if (table) {
      const on = !c.fail && i + 1 >= (table.fromStep || 1);
      lookupRows.forEach((r, k) => {
        r.classList.toggle('is-match', on && k === table.matchRow);
      });
    }
  }

  function go(i: number): void {
    state.step = Math.max(0, Math.min(total - 1, i));
    render();
    try {
      history.replaceState(null, '', `#step-${state.step + 1}`);
    } catch {
      /* ignore */
    }
  }

  function fromHash(): boolean {
    const m = /^#step-(\d+)$/.exec(location.hash || '');
    if (!m?.[1]) return false;
    const n = Number.parseInt(m[1], 10);
    if (!(n >= 1)) return false;
    state.step = Math.min(total - 1, n - 1);
    return true;
  }

  const had = fromHash();
  render();
  if (had) fig.scrollIntoView({ block: 'start' });
  off.add(
    listen(window, 'hashchange', () => {
      if (fromHash()) render();
    }),
  );
  off.add(() => mq?.removeEventListener?.('change', applyMotion));
}

/** Build the simulator for every sequence-sim figure under `root`. Returns a function that removes the window listeners. */
export function init(root: ParentNode = document): () => void {
  const off = disposer();
  for (const fig of qsa('figure[data-viz="sequence-sim"]', root)) setup(fig, off);
  return off.run;
}

onReady(() => {
  init();
});
