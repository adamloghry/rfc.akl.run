/* rfc.akl.run Atlas coverage map: 200-column canvas, one cell per RFC number. */
(function () {
  'use strict';

  /* byte per number: low 3 bits state, high 4 bits category index (15 = none) */
  function decode(b64) {
    var bin = atob(b64), n = bin.length;
    var state = new Uint8Array(n), cat = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      var b = bin.charCodeAt(i);
      state[i] = b & 7;
      cat[i] = b >> 4;
    }
    return { state: state, cat: cat };
  }
  window.RarpAtlas = { decode: decode };

  var canvas = document.getElementById('atlas-map');
  if (!canvas || !canvas.getContext) return;

  var COLS = 200;
  var NAMES = {};
  var chips = document.querySelectorAll('.at-chip');
  var capLabel = document.querySelector('.at-cap-label');
  var capDetail = document.querySelector('.at-cap-detail');
  var idleLabel = capLabel ? capLabel.textContent : '';
  var idleDetail = capDetail ? capDetail.textContent : '';

  var data = null, cats = [], max = Number(canvas.getAttribute('data-max')) || 0;
  var filterKey = '';       // category key or '' (resolved to an index at draw time)
  var hover = 0;            // RFC number under mouse/cursor, 0 = none
  var cursor = 1;           // keyboard cursor
  var kbd = false;          // cursor visible
  var shards = {};
  var metrics = { w: 0, cell: 0, gap: 0 };

  Array.prototype.forEach.call(chips, function (c) { NAMES[c.getAttribute('data-cat')] = c.textContent; });

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw() {
    if (!data) return;
    var w = canvas.clientWidth;
    if (!w) return;
    var cell = w / COLS, rows = Math.ceil(max / COLS), h = Math.ceil(rows * cell);
    var gap = Math.max(0.6, cell * 0.14);
    metrics = { w: w, cell: cell, gap: gap };
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    var x = canvas.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    var col = {
      feat: css('--accent'), basic: css('--accent-2'), empty: css('--map-empty'),
      featDim: css('--map-feat-dim'), basicDim: css('--map-basic-dim'), line: css('--line-strong'), ink: css('--ink'),
    };
    var size = cell - gap;
    var filterIdx = filterKey ? cats.indexOf(filterKey) : -1;
    x.beginPath();
    for (var n = 1; n <= max; n++) {
      var i = n - 1, st = data.state[i];
      if (st > 1) continue;
      var cx = (i % COLS) * cell, cy = Math.floor(i / COLS) * cell;
      x.moveTo(cx, cy + size);
      x.lineTo(cx + size, cy);
    }
    x.strokeStyle = col.line;
    x.lineWidth = 0.8;
    x.stroke();
    for (var m = 1; m <= max; m++) {
      var j = m - 1, s = data.state[j];
      if (s < 2) continue;
      var dim = filterIdx >= 0 && data.cat[j] !== filterIdx;
      x.fillStyle = s >= 4 ? (dim ? col.featDim : col.feat) : s === 3 ? (dim ? col.basicDim : col.basic) : col.empty;
      x.fillRect((j % COLS) * cell, Math.floor(j / COLS) * cell, size, size);
    }
    var sel = hover || (kbd ? cursor : 0);
    if (sel) {
      var k = sel - 1;
      x.strokeStyle = col.ink;
      x.lineWidth = 1.5;
      x.strokeRect((k % COLS) * cell - 1, Math.floor(k / COLS) * cell - 1, size + 2, size + 2);
    }
  }

  function numAt(e) {
    var b = canvas.getBoundingClientRect(), cell = b.width / COLS;
    if (!cell) return 0;
    var col = Math.floor((e.clientX - b.left) / cell);
    var n = Math.floor((e.clientY - b.top) / cell) * COLS + col + 1;
    return col >= 0 && col < COLS && n >= 1 && n <= max ? n : 0;
  }

  function shard(n) {
    var k = Math.floor((n - 1) / 1000);
    if (!shards[k]) {
      shards[k] = fetch('/data/titles/' + k + '.json').then(function (r) {
        if (!r.ok) throw new Error('shard');
        return r.json();
      }).catch(function () { delete shards[k]; return {}; });
    }
    return shards[k];
  }

  function caption(n) {
    if (!capLabel || !capDetail) return;
    if (!n) { capLabel.textContent = idleLabel; capDetail.textContent = idleDetail; return; }
    var i = n - 1, st = data.state[i];
    if (st === 0) { capLabel.textContent = 'RFC ' + n; capDetail.textContent = '— never issued'; return; }
    if (st === 1) { capLabel.textContent = 'RFC ' + n; capDetail.textContent = '— number reserved, not yet published'; return; }
    capLabel.textContent = 'RFC ' + n;
    capDetail.textContent = '— index page: title, authors, status and lineage from the RFC Editor · rfc.akl.run/' + n + '/';
    shard(n).then(function (sh) {
      if (hover !== n && !(kbd && cursor === n && !hover)) return;
      var t = sh[String(n)];
      if (!t) return;
      var name = t[0] || t[1];
      var catKey = cats[data.cat[i]];
      var tier = st >= 4 ? 'deep explainer' : st === 3 ? 'summary page' : 'index page';
      capLabel.textContent = 'RFC ' + n + ' · ' + name;
      if (st >= 3) {
        capDetail.textContent = '— ' + tier + ' · ' + (NAMES[catKey] || catKey || '') + ' · ' + t[2];
      } else {
        capDetail.textContent = '— index page: ' + t[1] + ', authors, status and lineage from the RFC Editor · rfc.akl.run/' + n + '/';
      }
    });
  }

  function setHover(n) {
    if (n === hover) return;
    hover = n;
    caption(hover || (kbd ? cursor : 0));
    draw();
  }

  canvas.addEventListener('mousemove', function (e) { kbd = false; setHover(numAt(e)); });
  canvas.addEventListener('mouseleave', function () { setHover(0); });
  canvas.addEventListener('click', function (e) {
    var n = numAt(e);
    if (n) location.href = '/' + n + '/';
  });
  canvas.addEventListener('focus', function () { kbd = true; caption(cursor); draw(); });
  canvas.addEventListener('blur', function () { kbd = false; caption(0); draw(); });
  canvas.addEventListener('keydown', function (e) {
    var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
    if (d) {
      e.preventDefault();
      kbd = true;
      hover = 0;
      cursor = Math.min(max, Math.max(1, cursor + d));
      caption(cursor);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      location.href = '/' + cursor + '/';
    }
  });

  Array.prototype.forEach.call(chips, function (chip) {
    chip.addEventListener('click', function () {
      var key = chip.getAttribute('data-cat');
      filterKey = key || '';
      Array.prototype.forEach.call(chips, function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      draw();
    });
  });

  if (window.ResizeObserver) new ResizeObserver(draw).observe(canvas);
  else window.addEventListener('resize', draw);
  window.addEventListener('rfc:theme', draw);

  fetch('/data/coverage.json').then(function (r) {
    if (!r.ok) throw new Error('coverage');
    return r.json();
  }).then(function (c) {
    max = c.max;
    cats = c.categories;
    data = decode(c.cells);
    draw();
  }).catch(function () {
    if (capDetail) capDetail.textContent = '— map data unavailable; browse by area instead.';
  });
})();
