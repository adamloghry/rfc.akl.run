// @ts-nocheck
// Ported verbatim from the legacy src/assets/js/sim.js; self-initializes on all matching figures.
(function () {
  'use strict';

  var LENSES = [['eli5', 'Like I’m 5'], ['std', 'Engineer'], ['orig', 'RFC text']];
  var GLYPH = { client: '?', host: 'H', server: 'S', router: 'R' };

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function setup(fig) {
    var root = fig.querySelector('.sim');
    var dataEl = fig.querySelector('script.sim-data');
    if (!root || !dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!data.steps || !data.steps.length) return;

    var rfc = root.getAttribute('data-rfc') || '';
    var total = data.steps.length;
    var router = data.router || null;
    var fails = data.failureSteps || [];
    var blockedThrough = router && typeof router.blockedThrough === 'number' ? router.blockedThrough : 2;
    var state = { step: 0, router: false, lens: 'std' };

    var lens = store('rfc-lens');
    if (lens !== 'eli5' && lens !== 'std' && lens !== 'orig') lens = store('rfc-level') === 'eli5' ? 'eli5' : 'std';
    state.lens = lens;

    var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    function applyMotion() { fig.classList.toggle('is-reduced', !!(mq && mq.matches)); }
    applyMotion();
    if (mq && mq.addEventListener) mq.addEventListener('change', applyMotion);

    // ---- build UI -------------------------------------------------------
    var ui = h('div', 'sim-ui');

    // permalink chip in the figure caption bar
    var chip = h('a', 'sim-permalink');
    chip.addEventListener('click', function (e) { e.preventDefault(); });
    var bar = fig.querySelector('.viz-cap-bar');
    if (bar) bar.appendChild(chip);

    // stage
    var wrap = h('div', 'sim-stage-wrap');
    var stage = h('div', 'sim-stage');
    wrap.appendChild(stage);
    var bus = h('div', 'sim-bus');
    var bus2 = h('div', 'sim-bus2');
    var boundary = h('div', 'sim-boundary');
    var bLabel = h('span', 'sim-boundary-label', router ? router.boundaryLabel : '');
    stage.appendChild(boundary); stage.appendChild(bLabel); stage.appendChild(bus); stage.appendChild(bus2);

    var nodeEls = {};
    var nodeList = data.nodes.slice();
    if (router) nodeList.push({ key: router.key, label: router.label, kind: 'router', x: router.boundaryX });
    nodeList.forEach(function (n) {
      var el = h('div', 'sim-node');
      el.setAttribute('data-kind', n.kind);
      var tile = h('div', 'sim-tile', GLYPH[n.kind] || '');
      el.appendChild(tile);
      el.appendChild(h('div', 'sim-stem'));
      el.appendChild(h('span', 'sim-name', n.label));
      var sub = h('span', 'sim-sub');
      el.appendChild(sub);
      stage.appendChild(el);
      nodeEls[n.key] = { el: el, tile: tile, sub: sub, def: n };
    });
    var pkt = h('div', 'sim-packet');
    var pill = h('div', 'sim-pill');
    pkt.appendChild(pill);
    stage.appendChild(pkt);
    var xMark = h('div', 'sim-x', '✕');
    xMark.setAttribute('aria-hidden', 'true');
    stage.appendChild(xMark);

    // controls
    var controls = h('div', 'sim-controls');
    var prev = h('button', 'sim-btn', '←');
    prev.type = 'button'; prev.setAttribute('aria-label', 'Previous step');
    var primary = h('button', 'sim-primary');
    primary.type = 'button';
    var segsEl = h('div', 'sim-segs');
    var segs = data.steps.map(function (s, i) {
      var b = h('button', 'sim-seg');
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to step ' + (i + 1) + ': ' + s.title);
      b.addEventListener('click', function () { go(i); });
      segsEl.appendChild(b);
      return b;
    });
    controls.appendChild(prev); controls.appendChild(primary); controls.appendChild(segsEl);
    var sw = null;
    if (router && fails.length) {
      sw = h('button', 'sim-switch');
      sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', 'false');
      sw.appendChild(h('span', 'sim-track'));
      sw.appendChild(h('span', '', router.toggleLabel));
      sw.addEventListener('click', function () { state.router = !state.router; render(); });
      controls.appendChild(sw);
    }
    prev.addEventListener('click', function () { go(Math.max(0, state.step - 1)); });
    primary.addEventListener('click', function () { go(state.step >= total - 1 ? 0 : state.step + 1); });

    // narrative + inspector
    var lower = h('div', 'sim-lower');
    var narr = h('div', 'sim-card sim-narr');
    var top = h('div', 'sim-narr-top');
    var eyebrow = h('span', 'sim-eyebrow');
    var lensBox = h('div', 'sim-lens');
    lensBox.setAttribute('role', 'group'); lensBox.setAttribute('aria-label', 'Explanation level');
    var lensBtns = LENSES.map(function (l) {
      var b = h('button', '', l[1]);
      b.type = 'button'; b.setAttribute('data-lens', l[0]);
      b.addEventListener('click', function () { state.lens = l[0]; store('rfc-lens', l[0]); render(); });
      lensBox.appendChild(b);
      return b;
    });
    top.appendChild(eyebrow); top.appendChild(lensBox);
    var title = h('h3', 'sim-step-title');
    var body = {};
    ['eli5', 'std', 'orig'].forEach(function (k) {
      var d = h('div', 'sim-lensbody'); d.setAttribute('data-level', k);
      if (k === 'orig') {
        var box = h('div', 'sim-orig');
        body.origText = document.createTextNode('');
        box.appendChild(body.origText);
        box.appendChild(document.createElement('br'));
        if (rfc) {
          var a = h('a', '', 'Read in RFC ' + rfc + ' \u2197');
          a.href = 'https://www.rfc-editor.org/rfc/rfc' + rfc;
          box.appendChild(a);
        }
        d.appendChild(box);
      } else {
        body[k] = h('p'); d.appendChild(body[k]);
      }
      body[k + 'Wrap'] = d;
      narr.appendChild(d);
    });
    // order: top, title, bodies, why
    narr.insertBefore(title, narr.firstChild);
    narr.insertBefore(top, narr.firstChild);
    var whyRow = h('div', 'sim-whyrow');
    whyRow.appendChild(h('span', 'sim-whybadge', 'WHY'));
    var whyText = h('span', 'sim-whytext');
    whyRow.appendChild(whyText);
    narr.appendChild(whyRow);

    var insp = h('div', 'sim-card sim-insp');
    var inspH = h('div', 'sim-insp-h');
    inspH.appendChild(h('b', '', 'Packet on the wire'));
    var inspTitle = h('span');
    inspH.appendChild(inspTitle);
    var rowsEl = h('div', 'sim-rows');
    var rowEls = (data.packetFields || []).map(function (f) {
      var r = h('div', 'sim-row');
      var k = h('span', 'k', f.key.toUpperCase());
      var n = h('span', 'n', f.name);
      var v = h('span', 'v');
      r.appendChild(k); r.appendChild(n); r.appendChild(v);
      rowsEl.appendChild(r);
      return { key: f.key, el: r, v: v };
    });
    insp.appendChild(inspH); insp.appendChild(rowsEl);
    insp.appendChild(h('span', 'sim-foot', 'Highlighted fields matter in this step.'));
    lower.appendChild(narr); lower.appendChild(insp);

    // lookup table + replaced
    var lower2 = null;
    var lookupRows = [];
    if (data.table || (data.replacedBy && data.replacedBy.length)) {
      lower2 = h('div', 'sim-lower2');
      if (data.table) {
        var lk = h('div', 'sim-card sim-lookup');
        var lh = h('div', 'sim-lookup-h');
        lh.appendChild(h('b', '', data.table.title));
        if (data.table.caption) lh.appendChild(h('span', '', data.table.caption));
        var lb = h('div', 'sim-lookup-b');
        lb.setAttribute('role', 'table'); lb.setAttribute('aria-label', data.table.title);
        data.table.rows.forEach(function (row) {
          var r = h('div', 'sim-lrow'); r.setAttribute('role', 'row');
          row.forEach(function (c) { var s = h('span', '', c); s.setAttribute('role', 'cell'); r.appendChild(s); });
          lb.appendChild(r); lookupRows.push(r);
        });
        lk.appendChild(lh); lk.appendChild(lb);
        lower2.appendChild(lk);
      } else {
        lower2.className += ' is-single';
      }
      if (data.replacedBy && data.replacedBy.length) {
        var rc = h('div', 'sim-card sim-replaced-card');
        rc.appendChild(h('b', '', 'What replaced it'));
        data.replacedBy.forEach(function (r) {
          var a = h('a', 'sim-rep');
          a.href = '/' + r.number + '/';
          a.appendChild(h('span', '', r.label));
          a.appendChild(h('span', '', 'RFC ' + r.number));
          rc.appendChild(a);
        });
        if (data.replacedNote) rc.appendChild(h('p', '', data.replacedNote));
        lower2.appendChild(rc);
      }
    }

    ui.appendChild(wrap); ui.appendChild(controls); ui.appendChild(lower);
    if (lower2) ui.appendChild(lower2);
    root.appendChild(ui);
    // keep the <ol> fallback for screen readers only
    var fb = root.querySelector('.sim-fallback');
    if (fb) {
      fb.classList.add('visually-hidden');
      // no invisible tab stops: the visible UI has its own replaced-by links
      Array.prototype.forEach.call(fb.querySelectorAll('.sim-replaced'), function (r) {
        r.setAttribute('inert', '');
        r.setAttribute('aria-hidden', 'true');
      });
    }

    // ---- render ---------------------------------------------------------
    function current() {
      var fail = state.router && fails.length && state.step >= 1;
      var s = fail ? fails[Math.min(state.step - 1, fails.length - 1)] : data.steps[state.step];
      return { s: s, fail: !!fail };
    }

    function render() {
      var c = current(), s = c.s, i = state.step;
      chip.textContent = 'rfc.akl.run/' + rfc + '/#step-' + (i + 1);
      chip.href = '#step-' + (i + 1);

      // bus + boundary
      var rd = state.router ? '' : 'none';
      boundary.style.display = rd; bLabel.style.display = rd; bus2.style.display = rd;
      if (router) {
        boundary.style.left = router.boundaryX + '%';
        bLabel.style.left = (router.boundaryX + 1) + '%';
        bus2.style.left = (router.boundaryX + 3) + '%';
      }
      bus.style.right = state.router && router ? (100 - router.boundaryX) + '%' : '5%';

      // nodes
      var routerLabel = '';
      fails.forEach(function (f) { if (!routerLabel && router && f.nodes && f.nodes[router.key]) routerLabel = f.nodes[router.key].label || ''; });
      Object.keys(nodeEls).forEach(function (k) {
        var n = nodeEls[k], def = n.def;
        var st = (s.nodes && s.nodes[k]) || (router && k === router.key ? { state: 'idle', label: routerLabel } : { state: 'idle', label: '' });
        var visible = !(router && k === router.key) || state.router;
        n.el.style.display = visible ? '' : 'none';
        var x = def.x;
        if (state.router && def.failureX !== undefined) x = def.failureX;
        n.el.style.left = x + '%';
        n.el.setAttribute('data-state', st.state || 'idle');
        n.sub.textContent = st.label || '';
        var g = GLYPH[def.kind] || '';
        if (def.kind === 'client' && st.state === 'done') g = '✓';
        if (def.kind === 'host' && st.state === 'ignores') g = '–';
        n.tile.textContent = g;
      });

      // packet
      var held = c.fail && i > blockedThrough;
      var shown = !!s.packetLabel && !held;
      pkt.style.left = s.packetPos + '%';
      pkt.style.opacity = shown ? (s.packetOpacity !== undefined ? s.packetOpacity : 1) : 0;
      pkt.style.setProperty('--c', 'var(--sim-' + (s.packetColor || 'cyan') + ')');
      pill.style.setProperty('--c', 'var(--sim-' + (s.packetColor || 'cyan') + ')');
      if (s.packetLabel) pill.textContent = s.packetLabel;
      var dropped = c.fail && router && s.nodes && s.nodes[router.key] && s.nodes[router.key].state === 'dropped' && i <= blockedThrough;
      xMark.style.display = dropped ? '' : 'none';
      if (router) xMark.style.left = router.boundaryX + '%';

      // controls
      prev.disabled = i === 0;
      primary.textContent = i === 0 ? 'Play step 1 →' : i >= total - 1 ? 'Restart' : 'Next step →';
      segs.forEach(function (b, k) {
        b.classList.toggle('is-on', k <= i);
        b.classList.toggle('is-fail', k <= i && c.fail && k >= 1);
        if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      if (sw) sw.setAttribute('aria-checked', state.router ? 'true' : 'false');

      // narrative
      eyebrow.textContent = 'step ' + (i + 1) + ' of ' + total + (s.tag ? ' · ' + s.tag : '');
      title.textContent = s.title;
      body.eli5.textContent = s.eli5 || '';
      body.std.textContent = s.spec || '';
      body.origText.nodeValue = s.orig || '';
      ['eli5', 'std', 'orig'].forEach(function (k) { body[k + 'Wrap'].hidden = state.lens !== k; });
      lensBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lens') === state.lens ? 'true' : 'false'); });
      whyText.textContent = s.why || '';
      whyRow.hidden = !s.why;

      // inspector
      inspTitle.textContent = s.packetTitle || data.packetTitle || data.title || '';
      var hl = s.highlight || [];
      rowEls.forEach(function (r) {
        var v = s.packet && s.packet[r.key];
        r.v.textContent = v === undefined || v === null ? '—' : v;
        r.el.classList.toggle('is-hl', hl.indexOf(r.key) >= 0);
      });

      // lookup table
      if (data.table) {
        var on = !c.fail && i + 1 >= (data.table.fromStep || 1);
        lookupRows.forEach(function (r, k) { r.classList.toggle('is-match', on && k === data.table.matchRow); });
      }
    }

    function go(i) {
      state.step = Math.max(0, Math.min(total - 1, i));
      render();
      try { history.replaceState(null, '', '#step-' + (state.step + 1)); } catch (e) { /* ignore */ }
    }

    function fromHash() {
      var m = /^#step-(\d+)$/.exec(location.hash || '');
      if (!m) return false;
      var n = parseInt(m[1], 10);
      if (!(n >= 1)) return false;
      state.step = Math.min(total - 1, n - 1);
      return true;
    }

    var had = fromHash();
    render();
    if (had) fig.scrollIntoView({ block: 'start' });
    window.addEventListener('hashchange', function () { if (fromHash()) render(); });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('figure[data-viz="sequence-sim"]'), setup);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
export {};
