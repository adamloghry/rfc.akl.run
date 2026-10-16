/* RFC relationship graph: plain SVG, no library. Reads #n, fetches /data/graph.json. */
import { disposer, listen, nav, qs } from './dom';

type GNode = { t?: string; y?: number | string; o?: number[]; ob?: number[]; u?: number[]; ub?: number[] };
type Col = { nodes: number[]; extra: number; more?: { x: number; y: number } };
type Pos = { x: number; y: number };
type Walk = { cols: Col[]; edges: Array<[number, number]> };

const NS = 'http://www.w3.org/2000/svg';
const MAX_PER_COL = 14;
const COL_W = 190;
const ROW_H = 40;
const NODE_W = 150;
const NODE_H = 28;
const PAD = 20;

function el(name: string, attrs: Record<string, string | number>, text?: string | null): SVGElement {
  const e = document.createElementNS(NS, name);
  for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  return e;
}

function msg(t: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'graph-msg';
  p.textContent = t;
  return p;
}

const uniq = (a: number[]): number[] => a.filter((x, i) => a.indexOf(x) === i);

/** Render the graph into #graph under `scope`. No-op without it. Returns a function that removes the window listener. */
export function init(scope: ParentNode = document): () => void {
  const root = qs('#graph', scope);
  const off = disposer();
  if (!root) return off.run;
  const stage: HTMLElement = root;
  let data: Record<string, GNode> | null = null;

  const node = (n: number): GNode => data?.[n] ?? { o: [], ob: [], u: [], ub: [] };
  // Predecessors: what n obsoletes or updates. Successors: what obsoleted or updated n.
  const preds = (n: number): number[] => {
    const d = node(n);
    return uniq((d.o || []).concat(d.u || []));
  };
  const succs = (n: number): number[] => {
    const d = node(n);
    return uniq((d.ob || []).concat(d.ub || []));
  };

  // Collect columns by hop distance (1..2) in a direction.
  function walk(n: number, next: (n: number) => number[]): Walk {
    const seen: Record<number, boolean> = { [n]: true };
    const cols: Col[] = [];
    const edges: Array<[number, number]> = [];
    let frontier = [n];
    for (let hop = 0; hop < 2; hop++) {
      let col: number[] = [];
      let extra = 0;
      for (const from of frontier) {
        for (const to of next(from)) {
          edges.push([from, to]);
          if (!seen[to]) {
            seen[to] = true;
            col.push(to);
          }
        }
      }
      col.sort((a, b) => a - b);
      if (col.length > MAX_PER_COL) {
        extra = col.length - MAX_PER_COL;
        col = col.slice(0, MAX_PER_COL);
      }
      cols.push({ nodes: col, extra });
      frontier = col;
    }
    return { cols, edges };
  }

  const slots = (c: Col | undefined): number => (c ? c.nodes.length + (c.extra ? 1 : 0) : 0);

  function render(n: number): void {
    stage.textContent = '';
    if (!n || n < 1) {
      stage.appendChild(msg('Enter an RFC number to see its neighborhood.'));
      return;
    }
    if (!data) {
      stage.appendChild(msg('Loading graph…'));
      return;
    }
    const known = data;
    const L = walk(n, preds);
    const R = walk(n, succs);
    const rows = Math.max(1, slots(L.cols[0]), slots(L.cols[1]), slots(R.cols[0]), slots(R.cols[1]));
    const W = PAD * 2 + NODE_W + COL_W * 4;
    const H = PAD * 2 + rows * ROW_H;
    const cx = PAD + NODE_W / 2 + COL_W * 2;
    const pos: Record<number, Pos> = { [n]: { x: cx, y: H / 2 } };
    function place(side: number, cols: Col[]): void {
      cols.forEach((c, i) => {
        const x = cx + side * COL_W * (i + 1);
        const total = slots(c);
        c.nodes.forEach((m, j) => {
          if (!pos[m]) pos[m] = { x, y: H / 2 + (j - (total - 1) / 2) * ROW_H };
        });
        if (c.extra) c.more = { x, y: H / 2 + (total - 1 - (total - 1) / 2) * ROW_H };
      });
    }
    place(-1, L.cols);
    place(1, R.cols);

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      width: '100%',
      role: 'group',
      'aria-label': `Graph around RFC ${n}`,
      class: 'graph-svg',
    });
    const gE = el('g', { class: 'graph-edges' });
    function edge(from: number, to: number): void {
      const a = pos[from];
      const b = pos[to];
      if (!a || !b) return;
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      const x1 = left.x + NODE_W / 2;
      const x2 = right.x - NODE_W / 2;
      const mx = (x1 + x2) / 2;
      gE.appendChild(el('path', { d: `M${x1} ${left.y} C${mx} ${left.y} ${mx} ${right.y} ${x2} ${right.y}`, class: 'graph-edge' }));
    }
    // Pred edges go predecessor -> subject; successor edges subject -> successor.
    for (const e of L.edges) edge(e[1], e[0]);
    for (const e of R.edges) edge(e[0], e[1]);
    svg.appendChild(gE);

    for (const key of Object.keys(pos)) {
      const k = +key;
      const p = pos[k] as Pos;
      const d = known[k];
      const center = k === n;
      const g = el('g', {
        class: `graph-node${center ? ' is-center' : ''}`,
        tabindex: '0',
        role: 'link',
        'aria-label': `RFC ${k}${d?.t ? `, ${d.t}` : ''}${center ? ' (selected)' : ''}`,
      });
      g.appendChild(el('rect', { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 4 }));
      g.appendChild(el('text', { x: p.x - NODE_W / 2 + 8, y: p.y + 4, class: 'graph-num' }, `RFC ${k}`));
      let label = d?.t ? String(d.t) : '';
      if (label.length > 12) label = `${label.slice(0, 11)}…`;
      if (label) g.appendChild(el('text', { x: p.x + NODE_W / 2 - 8, y: p.y + 4, 'text-anchor': 'end', class: 'graph-label' }, label));
      g.appendChild(el('title', {}, (d?.t ? d.t : `RFC ${k}`) + (d?.y ? ` (${d.y})` : '')));
      g.addEventListener('click', () => {
        if (!center) location.hash = `#${k}`;
      });
      g.addEventListener('dblclick', () => nav.to(`/${k}/`));
      g.addEventListener('keydown', (ev) => {
        if ((ev as KeyboardEvent).key !== 'Enter') return;
        if (center) nav.to(`/${k}/`);
        else location.hash = `#${k}`;
      });
      svg.appendChild(g);
    }
    for (const side of [L, R]) {
      for (const c of side.cols) {
        if (c.more)
          svg.appendChild(el('text', { x: c.more.x, y: c.more.y + 4, 'text-anchor': 'middle', class: 'graph-more' }, `+${c.extra} more`));
      }
    }
    svg.appendChild(el('text', { x: PAD, y: 12, class: 'graph-axis' }, '← obsoleted / updated by this'));
    svg.appendChild(el('text', { x: W - PAD, y: 12, 'text-anchor': 'end', class: 'graph-axis' }, 'obsoleted / updated by →'));
    stage.appendChild(svg);

    const none = !L.cols[0]?.nodes.length && !R.cols[0]?.nodes.length;
    const foot = document.createElement('p');
    foot.className = 'graph-foot';
    const a = document.createElement('a');
    a.href = `/${n}/`;
    a.textContent = `Open RFC ${n}`;
    foot.appendChild(a);
    if (none) foot.appendChild(document.createTextNode(' · No obsoletes or updates relations recorded.'));
    stage.appendChild(foot);
  }

  /** The RFC number requested by `#<n>` or, normalised to a hash, by `?n=<n>`; 0 when none. */
  function current(): number {
    const m = /^#(\d+)$/.exec(location.hash);
    if (m?.[1]) return +m[1];
    const q = /[?&]n=(\d+)/.exec(location.search || '');
    if (q?.[1]) {
      try {
        history.replaceState(null, '', `${location.pathname}#${q[1]}`);
      } catch {
        location.hash = `#${q[1]}`;
      }
      return +q[1];
    }
    return 0;
  }

  const form = qs('#graph-form', scope);
  const input = qs<HTMLInputElement>('#graph-n', scope);
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = Number.parseInt(input?.value ?? '', 10);
    if (v > 0) location.hash = `#${v}`;
  });
  off.add(
    listen(window, 'hashchange', () => {
      const n = current();
      if (input && n) input.value = String(n);
      render(n);
    }),
  );

  const n0 = current();
  if (input && n0) input.value = String(n0);
  render(n0);
  fetch('/data/graph.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Record<string, GNode>>;
    })
    .then((j) => {
      data = j;
      render(current());
    })
    .catch(() => {
      stage.textContent = '';
      stage.appendChild(msg('Could not load the graph data.'));
    });
  return off.run;
}

if (typeof document !== 'undefined') init();
