/* RFC relationship graph: plain SVG, no library. Reads #n, fetches /data/graph.json. */
type GNode = { t?: string; y?: number | string; o?: number[]; ob?: number[]; u?: number[]; ub?: number[] };
type Col = { nodes: number[]; extra: number; more?: { x: number; y: number } };
type Pos = { x: number; y: number };

const graphRoot = document.getElementById("graph");
if (graphRoot) init(graphRoot);
export {};

function init(root: HTMLElement) {
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_PER_COL = 14, COL_W = 190, ROW_H = 40, NODE_W = 150, NODE_H = 28, PAD = 20;
  let data: Record<string, GNode> | null = null;

  function el(name: string, attrs: Record<string, string | number>, text?: string | null): SVGElement {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (text != null) e.textContent = text;
    return e;
  }
  const uniq = (a: number[]) => a.filter((x, i) => a.indexOf(x) === i);
  const node = (n: number): GNode => (data && data[n] ? data[n] : { o: [], ob: [], u: [], ub: [] });
  // Predecessors: what n obsoletes or updates. Successors: what obsoleted or updated n.
  const preds = (n: number) => { const d = node(n); return uniq((d.o || []).concat(d.u || [])); };
  const succs = (n: number) => { const d = node(n); return uniq((d.ob || []).concat(d.ub || [])); };

  // Collect columns by hop distance (1..2) in a direction.
  function walk(n: number, next: (n: number) => number[]) {
    const seen: Record<number, boolean> = { [n]: true };
    const cols: Col[] = [], edges: [number, number][] = [];
    let frontier = [n];
    for (let hop = 0; hop < 2; hop++) {
      let col: number[] = [], extra = 0;
      frontier.forEach((from) => {
        next(from).forEach((to) => {
          edges.push([from, to]);
          if (!seen[to]) { seen[to] = true; col.push(to); }
        });
      });
      col.sort((a, b) => a - b);
      if (col.length > MAX_PER_COL) { extra = col.length - MAX_PER_COL; col = col.slice(0, MAX_PER_COL); }
      cols.push({ nodes: col, extra });
      frontier = col;
    }
    return { cols, edges };
  }

  function msg(t: string) { const p = document.createElement('p'); p.className = 'graph-msg'; p.textContent = t; return p; }

  function render(n: number) {
    root.textContent = '';
    if (!n || n < 1) { root.appendChild(msg('Enter an RFC number to see its neighborhood.')); return; }
    if (!data) { root.appendChild(msg('Loading graph…')); return; }
    const L = walk(n, preds), R = walk(n, succs);
    const rows = Math.max(1, L.cols[0].nodes.length + (L.cols[0].extra ? 1 : 0), L.cols[1].nodes.length + (L.cols[1].extra ? 1 : 0),
      R.cols[0].nodes.length + (R.cols[0].extra ? 1 : 0), R.cols[1].nodes.length + (R.cols[1].extra ? 1 : 0));
    const W = PAD * 2 + NODE_W + COL_W * 4, H = PAD * 2 + rows * ROW_H;
    const cx = PAD + NODE_W / 2 + COL_W * 2;
    const pos: Record<number, Pos> = { [n]: { x: cx, y: H / 2 } };
    function place(side: number, cols: Col[]) {
      cols.forEach((c, i) => {
        const x = cx + side * COL_W * (i + 1);
        const total = c.nodes.length + (c.extra ? 1 : 0);
        c.nodes.forEach((m, j) => {
          if (!pos[m]) pos[m] = { x, y: H / 2 + (j - (total - 1) / 2) * ROW_H };
        });
        if (c.extra) c.more = { x, y: H / 2 + (total - 1 - (total - 1) / 2) * ROW_H };
      });
    }
    place(-1, L.cols); place(1, R.cols);

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'group', 'aria-label': 'Graph around RFC ' + n, class: 'graph-svg' });
    const gE = el('g', { class: 'graph-edges' });
    function edge(from: number, to: number) {
      const a = pos[from], b = pos[to];
      if (!a || !b) return;
      const left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
      const x1 = left.x + NODE_W / 2, x2 = right.x - NODE_W / 2, mx = (x1 + x2) / 2;
      gE.appendChild(el('path', { d: 'M' + x1 + ' ' + left.y + ' C' + mx + ' ' + left.y + ' ' + mx + ' ' + right.y + ' ' + x2 + ' ' + right.y, class: 'graph-edge' }));
    }
    // Pred edges go predecessor -> subject; successor edges subject -> successor.
    L.edges.forEach((e) => edge(e[1], e[0]));
    R.edges.forEach((e) => edge(e[0], e[1]));
    svg.appendChild(gE);

    Object.keys(pos).forEach((key) => {
      const k = +key;
      const p = pos[k], d = data![k], center = k === n;
      const g = el('g', { class: 'graph-node' + (center ? ' is-center' : ''), tabindex: '0', role: 'link', 'aria-label': 'RFC ' + k + (d && d.t ? ', ' + d.t : '') + (center ? ' (selected)' : '') });
      g.appendChild(el('rect', { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 4 }));
      g.appendChild(el('text', { x: p.x - NODE_W / 2 + 8, y: p.y + 4, class: 'graph-num' }, 'RFC ' + k));
      let label = d && d.t ? String(d.t) : '';
      if (label.length > 12) label = label.slice(0, 11) + '…';
      if (label) g.appendChild(el('text', { x: p.x + NODE_W / 2 - 8, y: p.y + 4, 'text-anchor': 'end', class: 'graph-label' }, label));
      g.appendChild(el('title', {}, (d && d.t ? d.t : 'RFC ' + k) + (d && d.y ? ' (' + d.y + ')' : '')));
      g.addEventListener('click', () => { if (!center) location.hash = '#' + k; });
      g.addEventListener('dblclick', () => { location.href = '/' + k + '/'; });
      g.addEventListener('keydown', (ev) => {
        if ((ev as KeyboardEvent).key === 'Enter') { if (center) location.href = '/' + k + '/'; else location.hash = '#' + k; }
      });
      svg.appendChild(g);
    });
    [L, R].forEach((S) => {
      S.cols.forEach((c) => {
        if (c.more) svg.appendChild(el('text', { x: c.more.x, y: c.more.y + 4, 'text-anchor': 'middle', class: 'graph-more' }, '+' + c.extra + ' more'));
      });
    });
    svg.appendChild(el('text', { x: PAD, y: 12, class: 'graph-axis' }, '← obsoleted / updated by this'));
    svg.appendChild(el('text', { x: W - PAD, y: 12, 'text-anchor': 'end', class: 'graph-axis' }, 'obsoleted / updated by →'));
    root.appendChild(svg);

    const none = !L.cols[0].nodes.length && !R.cols[0].nodes.length;
    const foot = document.createElement('p');
    foot.className = 'graph-foot';
    const a = document.createElement('a');
    a.href = '/' + n + '/'; a.textContent = 'Open RFC ' + n;
    foot.appendChild(a);
    if (none) foot.appendChild(document.createTextNode(' · No obsoletes or updates relations recorded.'));
    root.appendChild(foot);
  }

  function current(): number {
    const m = /^#(\d+)$/.exec(location.hash);
    if (m) return +m[1];
    const q = /[?&]n=(\d+)/.exec(location.search || '');
    if (q) {
      try { history.replaceState(null, '', location.pathname + '#' + q[1]); } catch (e) { location.hash = '#' + q[1]; }
      return +q[1];
    }
    return 0;
  }

  const form = document.getElementById('graph-form');
  const input = document.getElementById('graph-n') as HTMLInputElement | null;
  if (form) form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = parseInt(input!.value, 10);
    if (v > 0) location.hash = '#' + v;
  });
  window.addEventListener('hashchange', () => { const n = current(); if (input && n) input.value = String(n); render(n); });

  const n0 = current();
  if (input && n0) input.value = String(n0);
  render(n0);
  fetch('/data/graph.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((j) => { data = j; render(current()); })
    .catch(() => { root.textContent = ''; root.appendChild(msg('Could not load the graph data.')); });
}
