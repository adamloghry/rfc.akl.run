/* rfc.akl.run shared search: number jump, curated questions, Pagefind. Safe no-op without .search-input. */
(function () {
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
  var pagefind = null;
  function getPagefind() {
    if (!pagefind) {
      pagefind = import('/search/pagefind.js').then(function (m) {
        if (m.init) { try { m.init(); } catch (e) { /* ignore */ } }
        return m;
      });
      pagefind.catch(function () { /* degrade: numbers + questions only */ });
    }
    return pagefind;
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
          var needsPf = items.length < 6;
          render(items.slice(), q, !needsPf);
          if (!needsPf) return;
          return getPagefind().then(function (pf) {
            return pf.search(q);
          }).then(function (r) {
            if (my !== token) return;
            return Promise.all(r.results.slice(0, 5).map(function (x) { return x.data(); }));
          }).then(function (datas) {
            if (my !== token || !datas) return;
            datas.forEach(function (d) {
              var m = d.meta || {};
              var tier = m.tier || '';
              add({
                label: m.number ? 'RFC ' + m.number : tier === 'journey' ? 'JOURNEY' : 'PAGE',
                title: m.title || d.url,
                tag: tier === 'journey' ? 'JOURNEY' : tier.toUpperCase(),
                tier: tier,
                href: d.url,
              });
            });
            render(items.slice(), q, true);
          }).catch(function () {
            if (my === token) render(items.slice(), q, true);
          });
        });
      }).catch(function () { if (my === token) render(items.slice(), q, true); });
    }

    input.addEventListener('focus', function () { getPagefind().catch(function () {}); getJSON('/data/questions.json').catch(function () {}); });
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
