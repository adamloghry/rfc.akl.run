/* rfc.akl.run shared search: number jump, curated questions, static full-text index (/data/search/).
   The pure functions below are also exported for node tests; the DOM part is a safe no-op without .search-input. */
var RarpSearchCore = (function () {
  'use strict';

  function parseNumber(q, max) {
    if (!/^\d+$/.test(q)) return null;
    var n = parseInt(q, 10);
    return n >= 1 && n <= max ? n : null;
  }

  function matchQuestions(q, list) {
    var words = String(q).toLowerCase().split(/\s+/).filter(function (w) { return w.length >= 3; });
    if (!words.length || !list) return [];
    return list.filter(function (item) {
      var s = String(item.q).toLowerCase();
      return words.every(function (w) { return s.indexOf(w) !== -1; });
    });
  }

  /* Keep tokenize/shardOf in sync with scripts/lib/search-index.js (test/search-index.test.js checks parity). */
  var STOP = {};
  'a an and are as at be by do does for from how in is it of on or rfc that the this to was what when where which who why with'
    .split(' ').forEach(function (w) { STOP[w] = 1; });

  function tokenize(text) {
    var s = String(text == null ? '' : text);
    if (s.normalize) s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    var out = [], parts = s.toLowerCase().split(/[^a-z0-9]+/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length >= 2 && !STOP[parts[i]]) out.push(parts[i]);
    }
    return out;
  }

  function shardOf(term, n) {
    var h = 0x811c9dc5;
    for (var i = 0; i < term.length; i++) {
      h ^= term.charCodeAt(i) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h >>> 0) % n;
  }

  /* Query -> {slots: [[{term, w}, ...], ...]}; one slot per distinct token, the last one also
     expands through the 3-char prefix table (weight 0.6) so partially typed words match. */
  function plan(q, prefixMap) {
    var toks = [], seen = {};
    tokenize(q).forEach(function (t) { if (!seen[t]) { seen[t] = 1; toks.push(t); } });
    var slots = toks.map(function (t) { return [{ term: t, w: 1 }]; });
    // Expand the last token as typed (not the last de-duplicated one) only when the query does not end in a space.
    var raw = String(q), endsOpen = !/\s$/.test(raw);
    var all = tokenize(q), last = all.length ? all[all.length - 1] : null;
    if (endsOpen && last && last.length >= 3 && prefixMap) {
      var slot = slots[toks.indexOf(last)];
      (prefixMap[last.slice(0, 3)] || []).forEach(function (t) {
        if (t !== last && t.indexOf(last) === 0) slot.push({ term: t, w: 0.6 });
      });
    }
    return { slots: slots };
  }

  function termsOf(p) {
    var out = [];
    p.slots.forEach(function (slot) { slot.forEach(function (c) { if (out.indexOf(c.term) < 0) out.push(c.term); }); });
    return out;
  }

  function shardsOf(p, n) {
    var out = [];
    termsOf(p).forEach(function (t) { var k = shardOf(t, n); if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }

  /* postings: {term: [[docId, score], ...]}. Docs matching every slot come first; if none do, only the
     docs matching the most slots are returned. Returns [{id, score, hits}] best first. */
  function rank(p, postings, limit) {
    var n = p.slots.length;
    if (!n) return [];
    var acc = {};
    p.slots.forEach(function (slot) {
      var best = {};
      slot.forEach(function (c) {
        (postings[c.term] || []).forEach(function (e) {
          var v = e[1] * c.w;
          if (!(best[e[0]] >= v)) best[e[0]] = v;
        });
      });
      Object.keys(best).forEach(function (id) {
        var a = acc[id] || (acc[id] = { id: +id, score: 0, hits: 0 });
        a.score += best[id];
        a.hits++;
      });
    });
    var list = Object.keys(acc).map(function (id) { return acc[id]; });
    var top = 0;
    list.forEach(function (a) { if (a.hits > top) top = a.hits; });
    list = list.filter(function (a) { return a.hits === top; });
    list.sort(function (a, b) { return b.score - a.score || a.id - b.id; });
    return limit ? list.slice(0, limit) : list;
  }

  /* doc row [url, number|null, title, shortTitle|null, tier] -> result row */
  function docRow(d) {
    var tier = d[4] || '';
    return {
      label: d[1] ? 'RFC ' + d[1] : tier === 'journey' ? 'JOURNEY' : 'PAGE',
      title: d[3] ? d[3] + ': ' + d[2] : d[2],
      tag: tier === 'journey' ? 'JOURNEY' : tier.toUpperCase(),
      tier: tier === 'journey' ? '' : tier,
      href: d[0],
    };
  }

  return { parseNumber: parseNumber, matchQuestions: matchQuestions, tokenize: tokenize, shardOf: shardOf, plan: plan, termsOf: termsOf, shardsOf: shardsOf, rank: rank, docRow: docRow };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RarpSearchCore;

(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var parseNumber = RarpSearchCore.parseNumber, matchQuestions = RarpSearchCore.matchQuestions;
  window.RarpSearch = { parseNumber: parseNumber, matchQuestions: matchQuestions };

  var inputs = document.querySelectorAll('.search-input');
  var fills = document.querySelectorAll('[data-search-fill]');
  if (!inputs.length && !fills.length) return;

  /* ---- shared lazy data ---- */
  var cache = {};
  function getJSON(url) {
    if (!cache[url]) {
      cache[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return r.json();
      });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  }
  function decodeStates(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 7;
    return out;
  }
  var coveragePromise = null;
  function getCoverage() {
    if (!coveragePromise) {
      coveragePromise = getJSON('/data/coverage.json').then(function (c) {
        return { max: c.max, states: decodeStates(c.cells) };
      });
      coveragePromise.catch(function () { coveragePromise = null; });
    }
    return coveragePromise;
  }
  /* full-text index: meta + docs + prefix table up front (on first focus), term shards on demand */
  var ftPromise = null;
  function getFullText() {
    if (!ftPromise) {
      ftPromise = Promise.all([
        getJSON('/data/search/meta.json'), getJSON('/data/search/docs.json'),
        getJSON('/data/search/prefix.json').catch(function () { return {}; }),
      ]).then(function (r) { return { shards: r[0].shards, docs: r[1], prefix: r[2] }; });
      ftPromise.catch(function () { ftPromise = null; }); // degrade: numbers + questions only
    }
    return ftPromise;
  }
  function fullTextSearch(q, limit) {
    return getFullText().then(function (ft) {
      var p = RarpSearchCore.plan(q, ft.prefix);
      var ks = RarpSearchCore.shardsOf(p, ft.shards);
      return Promise.all(ks.map(function (k) {
        return getJSON('/data/search/t-' + (k < 10 ? '0' : '') + k + '.json').catch(function () { return {}; });
      })).then(function (shards) {
        var postings = {};
        shards.forEach(function (sh) { Object.keys(sh).forEach(function (t) { postings[t] = sh[t]; }); });
        return RarpSearchCore.rank(p, postings, limit).map(function (r) { return RarpSearchCore.docRow(ft.docs[r.id]); });
      });
    });
  }

  var TIERS = ['NOT ISSUED', 'RESERVED', 'INDEX', 'SUMMARY', 'EXPLAINER', 'EXPLAINER'];

  function numberRow(n, cov) {
    var row = { label: 'RFC ' + n, title: '', tag: '', tier: '', href: '/' + n + '/' };
    var st = cov ? cov.states[n - 1] : 2;
    row.tag = TIERS[st] || 'INDEX';
    row.tier = st >= 4 ? 'explainer' : st === 3 ? 'summary' : 'index';
    if (st === 0) { row.title = 'never issued'; row.tag = ''; return Promise.resolve(row); }
    if (st === 1) { row.title = 'number reserved, not yet published'; row.tag = ''; return Promise.resolve(row); }
    var k = Math.floor((n - 1) / 1000);
    return getJSON('/data/titles/' + k + '.json').then(function (shard) {
      var t = shard[String(n)];
      if (t) row.title = t[0] ? t[0] + ': ' + t[1] : t[1];
      return row;
    }, function () { return row; });
  }

  /* ---- one controller per input ---- */
  var uid = 0;
  function attach(input) {
    var box = input.closest('.search-box');
    var pop = box && box.querySelector('.search-pop');
    var list = pop && pop.querySelector('[role="listbox"]');
    if (!pop || !list) return;
    var id = 'sr' + (++uid);
    list.id = list.id || id + '-list';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);

    var flushEnter = false, timer = null, token = 0, active = -1, rows = [];
    var empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.hidden = true;
    pop.appendChild(empty);

    function close() {
      pop.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function setActive(i) {
      var els = list.querySelectorAll('.search-row');
      if (!els.length) { active = -1; return; }
      active = (i + els.length) % els.length;
      for (var j = 0; j < els.length; j++) els[j].setAttribute('aria-selected', j === active ? 'true' : 'false');
      input.setAttribute('aria-activedescendant', els[active].id);
    }
    function make(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function render(items, q, final) {
      rows = items;
      var keep = active >= 0 ? list.querySelectorAll('.search-row')[active] : null;
      var keepHref = keep ? keep.getAttribute('href') : null;
      list.textContent = '';
      empty.textContent = '';
      empty.hidden = true;
      active = -1;
      input.removeAttribute('aria-activedescendant');
      if (!items.length) {
        if (!(final && q.length > 2)) { close(); return; }
        empty.hidden = false;
        empty.appendChild(document.createTextNode('No matching RFC or question. Try a protocol name or a number, or '));
        var a = make('a', null, 'suggest this question');
        a.href = 'https://github.com/adamloghry/rfc.akl.run/issues/new?template=question.yml&title=' + encodeURIComponent(q);
        empty.appendChild(a);
        empty.appendChild(document.createTextNode('.'));
      } else {
        items.forEach(function (it, i) {
          var a = make('a', 'search-row');
          a.id = id + '-' + i;
          a.href = it.href;
          a.setAttribute('role', 'option');
          a.setAttribute('aria-selected', 'false');
          a.appendChild(make('span', 'sr-label', it.label));
          a.appendChild(make('span', 'sr-title', it.title));
          a.appendChild(make('span', 'sr-tag' + (it.tier ? ' is-' + it.tier : ''), it.tag || ''));
          a.addEventListener('mousemove', function () { if (active !== i) setActive(i); });
          list.appendChild(a);
          if (keepHref && a.getAttribute('href') === keepHref) setActive(i);
        });
      }
      pop.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (flushEnter && items.length) { flushEnter = false; location.href = items[0].href; }
    }

    function run(q) {
      var my = ++token;
      if (!q) { close(); return; }
      var items = [];
      var seen = {};
      function add(it) {
        if (seen[it.href] || items.length >= 6) return;
        seen[it.href] = 1;
        items.push(it);
      }
      var covP = /^\d+$/.test(q) ? getCoverage().catch(function () { return null; }) : Promise.resolve(null);
      var qsP = getJSON('/data/questions.json').catch(function () { return []; });
      Promise.all([covP, qsP]).then(function (res) {
        if (my !== token) return;
        var cov = res[0], qs = res[1];
        var n = cov ? parseNumber(q, cov.max) : null;
        var numP = n ? numberRow(n, cov) : Promise.resolve(null);
        return numP.then(function (nr) {
          if (my !== token) return;
          if (nr) add(nr);
          matchQuestions(q, qs).forEach(function (m) {
            add({ label: m.label || 'JOURNEY', title: m.title || m.q, tag: 'QUESTION', tier: '', href: m.href });
          });
          var needsFt = items.length < 6;
          render(items.slice(), q, !needsFt);
          if (!needsFt) return;
          return fullTextSearch(q, 6).then(function (rs) {
            if (my !== token) return;
            rs.forEach(add);
            render(items.slice(), q, true);
          }).catch(function () {
            if (my === token) render(items.slice(), q, true);
          });
        });
      }).catch(function () { if (my === token) render(items.slice(), q, true); });
    }

    input.addEventListener('focus', function () { getFullText().catch(function () {}); getJSON('/data/questions.json').catch(function () {}); });
    input.addEventListener('input', function () {
      clearTimeout(timer);
      flushEnter = false;
      var q = input.value.trim();
      timer = setTimeout(function () { timer = null; run(q); }, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (pop.hidden) return;
        e.preventDefault();
        setActive(active < 0 ? (e.key === 'ArrowDown' ? 0 : -1) : active + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Enter') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
          e.preventDefault();
          flushEnter = true;
          run(input.value.trim());
          return;
        }
        var els = list.querySelectorAll('.search-row');
        if (!pop.hidden && els.length) {
          e.preventDefault();
          location.href = els[active >= 0 ? active : 0].href;
        } else {
          var n = parseNumber(input.value.trim(), 99999);
          if (n) { e.preventDefault(); location.href = '/' + n + '/'; }
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });
    document.addEventListener('mousedown', function (e) { if (!box.contains(e.target)) close(); });
    input.fillQuery = function (q) {
      input.value = q;
      input.focus();
      clearTimeout(timer);
      run(q.trim());
    };
  }

  Array.prototype.forEach.call(inputs, attach);

  Array.prototype.forEach.call(fills, function (btn) {
    btn.addEventListener('click', function () {
      var target = document.querySelector('.search-hero .search-input') || inputs[0];
      if (target && target.fillQuery) target.fillQuery(btn.getAttribute('data-search-fill') || btn.textContent);
    });
  });
})();
