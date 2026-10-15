/* RFC relationship graph: plain SVG, no library. Reads #n, fetches /data/graph.json. */
(function () {
  'use strict';
  var root = document.getElementById('graph');
  if (!root) return;
  var NS = 'http://www.w3.org/2000/svg';
  var MAX_PER_COL = 14, COL_W = 190, ROW_H = 40, NODE_W = 150, NODE_H = 28, PAD = 20;
  var data = null;

  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function node(n) { return data && data[n] ? data[n] : { o: [], ob: [], u: [], ub: [] }; }
  // Predecessors: what n obsoletes or updates. Successors: what obsoleted or updated n.
  function preds(n) { var d = node(n); return uniq((d.o || []).concat(d.u || [])); }
  function succs(n) { var d = node(n); return uniq((d.ob || []).concat(d.ub || [])); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // Collect columns by hop distance (1..2) in a direction.
  function walk(n, next) {
    var seen = {}; seen[n] = true;
    var cols = [], edges = [], frontier = [n];
    for (var hop = 0; hop < 2; hop++) {
      var col = [], extra = 0;
      frontier.forEach(function (from) {
        next(from).forEach(function (to) {
          edges.push([from, to]);
          if (!seen[to]) { seen[to] = true; col.push(to); }
        });
      });
      col.sort(function (a, b) { return a - b; });
      if (col.length > MAX_PER_COL) { extra = col.length - MAX_PER_COL; col = col.slice(0, MAX_PER_COL); }
      cols.push({ nodes: col, extra: extra });
      frontier = col;
    }
    return { cols: cols, edges: edges };
  }

  function render(n) {
    root.textContent = '';
    if (!n || n < 1) { root.appendChild(msg('Enter an RFC number to see its neighborhood.')); return; }
    if (!data) { root.appendChild(msg('Loading graph…')); return; }
    var L = walk(n, preds), R = walk(n, succs);
    var rows = Math.max(1, L.cols[0].nodes.length + (L.cols[0].extra ? 1 : 0), L.cols[1].nodes.length + (L.cols[1].extra ? 1 : 0),
      R.cols[0].nodes.length + (R.cols[0].extra ? 1 : 0), R.cols[1].nodes.length + (R.cols[1].extra ? 1 : 0));
    var W = PAD * 2 + NODE_W + COL_W * 4, H = PAD * 2 + rows * ROW_H;
    var cx = PAD + NODE_W / 2 + COL_W * 2;
    var pos = {};
    pos[n] = { x: cx, y: H / 2 };
    function place(side, cols) {
      cols.forEach(function (c, i) {
        var x = cx + side * COL_W * (i + 1);
        var total = c.nodes.length + (c.extra ? 1 : 0);
        c.nodes.forEach(function (m, j) {
          if (!pos[m]) pos[m] = { x: x, y: H / 2 + (j - (total - 1) / 2) * ROW_H };
        });
        if (c.extra) c.more = { x: x, y: H / 2 + (total - 1 - (total - 1) / 2) * ROW_H };
      });
    }
    place(-1, L.cols); place(1, R.cols);

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'group', 'aria-label': 'Graph around RFC ' + n, 'class': 'graph-svg' });
    var gE = el('g', { 'class': 'graph-edges' });
    function edge(from, to, dirPred) {
      var a = pos[from], b = pos[to];
      if (!a || !b) return;
      var left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
      var x1 = left.x + NODE_W / 2, x2 = right.x - NODE_W / 2, mx = (x1 + x2) / 2;
      gE.appendChild(el('path', { d: 'M' + x1 + ' ' + left.y + ' C' + mx + ' ' + left.y + ' ' + mx + ' ' + right.y + ' ' + x2 + ' ' + right.y, 'class': 'graph-edge' }));
    }
    // Pred edges go predecessor -> subject; successor edges subject -> successor.
    L.edges.forEach(function (e) { edge(e[1], e[0]); });
    R.edges.forEach(function (e) { edge(e[0], e[1]); });
    svg.appendChild(gE);

    Object.keys(pos).forEach(function (k) {
      k = +k;
      var p = pos[k], d = data[k], center = k === n;
      var g = el('g', { 'class': 'graph-node' + (center ? ' is-center' : ''), tabindex: '0', role: 'link', 'aria-label': 'RFC ' + k + (d && d.t ? ', ' + d.t : '') + (center ? ' (selected)' : '') });
      g.appendChild(el('rect', { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 4 }));
      g.appendChild(el('text', { x: p.x - NODE_W / 2 + 8, y: p.y + 4, 'class': 'graph-num' }, 'RFC ' + k));
      var label = d && d.t ? String(d.t) : '';
      if (label.length > 12) label = label.slice(0, 11) + '…';
      if (label) g.appendChild(el('text', { x: p.x + NODE_W / 2 - 8, y: p.y + 4, 'text-anchor': 'end', 'class': 'graph-label' }, label));
      var title = el('title', {}, (d && d.t ? d.t : 'RFC ' + k) + (d && d.y ? ' (' + d.y + ')' : ''));
      g.appendChild(title);
      g.addEventListener('click', function () { if (!center) location.hash = '#' + k; });
      g.addEventListener('dblclick', function () { location.href = '/' + k + '/'; });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { if (center) location.href = '/' + k + '/'; else location.hash = '#' + k; }
      });
      svg.appendChild(g);
    });
    [L, R].forEach(function (S) {
      S.cols.forEach(function (c) {
        if (c.more) svg.appendChild(el('text', { x: c.more.x, y: c.more.y + 4, 'text-anchor': 'middle', 'class': 'graph-more' }, '+' + c.extra + ' more'));
      });
    });
    svg.appendChild(el('text', { x: PAD, y: 12, 'class': 'graph-axis' }, '← obsoleted / updated by this'));
    svg.appendChild(el('text', { x: W - PAD, y: 12, 'text-anchor': 'end', 'class': 'graph-axis' }, 'obsoleted / updated by →'));
    root.appendChild(svg);

    var none = !L.cols[0].nodes.length && !R.cols[0].nodes.length;
    var foot = document.createElement('p');
    foot.className = 'graph-foot';
    var a = document.createElement('a');
    a.href = '/' + n + '/'; a.textContent = 'Open RFC ' + n;
    foot.appendChild(a);
    if (none) foot.appendChild(document.createTextNode(' · No obsoletes or updates relations recorded.'));
    root.appendChild(foot);
  }

  function msg(t) { var p = document.createElement('p'); p.className = 'graph-msg'; p.textContent = t; return p; }
  function current() {
    var m = /^#(\d+)$/.exec(location.hash);
    if (m) return +m[1];
    var q = /[?&]n=(\d+)/.exec(location.search || '');
    if (q) {
      try { history.replaceState(null, '', location.pathname + '#' + q[1]); } catch (e) { location.hash = '#' + q[1]; }
      return +q[1];
    }
    return 0;
  }

  var form = document.getElementById('graph-form'), input = document.getElementById('graph-n');
  if (form) form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = parseInt(input.value, 10);
    if (v > 0) location.hash = '#' + v;
  });
  window.addEventListener('hashchange', function () { var n = current(); if (input && n) input.value = n; render(n); });

  var n0 = current();
  if (input && n0) input.value = n0;
  render(n0);
  fetch('/data/graph.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) { data = j; render(current()); })
    .catch(function () { root.textContent = ''; root.appendChild(msg('Could not load the graph data.')); });
})();
