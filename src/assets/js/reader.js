(function () {
  'use strict';
  var root = document.documentElement;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else fallback();
  }

  function flash(btn, label) {
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old);
    btn.textContent = label;
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = old; }, 1600);
  }

  // Reading level
  var ctl = $('.level-ctl');
  function setLevel(l, persist) {
    if (l === 'eli5') root.setAttribute('data-level', 'eli5'); else root.removeAttribute('data-level');
    $$('[data-set-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-level') === l)); });
    if (persist) {
      store('rfc-level', l);
      try {
        var u = new URL(location.href);
        if (u.searchParams.has('level')) { u.searchParams.set('level', l); history.replaceState(null, '', u.toString()); }
      } catch (e) {}
    }
  }
  if (ctl) {
    ctl.hidden = false;
    setLevel(root.getAttribute('data-level') === 'eli5' ? 'eli5' : 'std', false);
    $$('[data-set-level]').forEach(function (b) {
      b.addEventListener('click', function () { setLevel(b.getAttribute('data-set-level'), true); });
    });
  }

  // Copy link + copy buttons
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-copy');
      copyText(url, function (ok) {
        if (ok) flash(b, 'Link copied');
        else {
          var f = $('.permalink-note code') || $('.cite-text');
          if (f) { var r = document.createRange(); r.selectNodeContents(f); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        }
      });
    });
  });
  $$('[data-copy-target]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = $(b.getAttribute('data-copy-target'));
      if (!el) return;
      copyText(el.textContent, function (ok) {
        if (ok) flash(b, 'COPIED');
        else { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      });
    });
  });

  // Cite toggle
  var citeBtn = $('[data-cite-toggle]');
  var cite = $('#cite');
  if (citeBtn && cite) {
    citeBtn.addEventListener('click', function () {
      var open = citeBtn.getAttribute('aria-expanded') !== 'true';
      citeBtn.setAttribute('aria-expanded', String(open));
      cite.hidden = !open;
    });
  }

  // Copy buttons on prose code blocks
  $$('.prose pre').forEach(function (pre) {
    if (pre.parentNode.classList.contains('has-copy')) return;
    var wrap = document.createElement('div');
    wrap.className = 'has-copy';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy-btn'; b.textContent = 'COPY';
    b.className = 'copy-btn copy-btn-float';
    b.addEventListener('click', function () {
      copyText(pre.textContent, function (ok) { if (ok) flash(b, 'COPIED'); });
    });
    wrap.appendChild(b);
  });

  // TOC scrollspy
  var links = $$('.toc a[data-toc]');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('data-toc')] = a; });
    var active = null;
    var visible = {};
    var order = links.map(function (a) { return a.getAttribute('data-toc'); });
    function mark() {
      var id = null;
      for (var i = 0; i < order.length; i++) if (visible[order[i]]) { id = order[i]; break; }
      if (!id || id === active) return;
      active = id;
      links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-toc') === id); });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      mark();
    }, { rootMargin: '-72px 0px -60% 0px' });
    order.forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
})();
