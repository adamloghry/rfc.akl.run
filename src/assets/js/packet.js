(function () {
  'use strict';

  function setupPacket(fig) {
    var body = fig.querySelector('.pk-body');
    var cells = Array.prototype.slice.call(fig.querySelectorAll('.pk-cell'));
    if (!body || !cells.length) return;
    var inspector = fig.querySelector('.pk-inspector');
    var seg = fig.querySelector('.viz-seg');
    var table = fig.querySelector('.viz-packet-table');
    var nName = inspector && inspector.querySelector('.pk-i-name');
    var nDesc = inspector && inspector.querySelector('.pk-i-desc');
    var nSize = inspector && inspector.querySelector('.pk-i-size');
    var selected = null;

    // The grid replaces the table visually; the table stays for screen readers.
    if (table) table.classList.add('visually-hidden');
    if (seg) seg.hidden = false;
    if (inspector) inspector.hidden = false;

    // One tab stop per field: continuation fragments are skipped.
    cells.forEach(function (c) { if (!c.id) c.setAttribute('tabindex', '-1'); });

    function select(key) {
      var first = null;
      cells.forEach(function (c) {
        var on = c.getAttribute('data-key') === key;
        c.classList.toggle('is-selected', on);
        if (on && !first) first = c;
      });
      if (!first) return false;
      selected = key;
      if (nName) nName.textContent = first.getAttribute('data-name') || key.toUpperCase();
      if (nDesc) nDesc.textContent = first.getAttribute('data-desc') || '';
      if (nSize) nSize.textContent = first.getAttribute('data-size') || '';
      return true;
    }

    function setMode(mode) {
      body.setAttribute('data-mode', mode);
      cells.forEach(function (c) {
        c.classList.toggle('is-changed', c.getAttribute('data-changed') === mode);
        Array.prototype.forEach.call(c.querySelectorAll('.pk-v'), function (v) {
          v.hidden = v.getAttribute('data-mode-val') !== mode;
        });
      });
      if (seg) {
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false');
        });
      }
    }

    function remember(key) {
      try { history.replaceState(null, '', '#field-' + key); } catch (e) { /* file:// etc. */ }
    }

    cells.forEach(function (c) {
      var key = c.getAttribute('data-key');
      c.addEventListener('mouseenter', function () { select(key); });
      c.addEventListener('focus', function () { select(key); remember(key); });
      c.addEventListener('click', function (e) { e.preventDefault(); select(key); remember(key); });
    });
    if (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button[data-mode]');
        if (b) setMode(b.getAttribute('data-mode'));
      });
    }

    function fromHash() {
      var m = /^#field-(.+)$/.exec(location.hash || '');
      if (!m) return false;
      var key;
      try { key = decodeURIComponent(m[1]); } catch (e) { return false; }
      var el = document.getElementById('field-' + key);
      if (!el || !fig.contains(el)) return false;
      select(key);
      el.scrollIntoView({ block: 'center' });
      return true;
    }

    var firstMode = seg && seg.querySelector('button[data-mode]');
    if (firstMode) setMode((seg.querySelector('button[aria-pressed="true"]') || firstMode).getAttribute('data-mode'));
    if (!fromHash()) {
      var firstChanged = cells.filter(function (c) { return c.hasAttribute('data-changed'); })[0];
      select((firstChanged || cells[0]).getAttribute('data-key'));
    }
    window.addEventListener('hashchange', fromHash);
  }

  // `code` viz: reveal and wire the COPY button.
  function setupCode(fig) {
    var btn = fig.querySelector('.code-copy');
    var pre = fig.querySelector('pre');
    if (!btn || !pre) return;
    btn.hidden = false;
    var timer = null;
    btn.addEventListener('click', function () {
      var text = pre.textContent;
      var done = function () {
        btn.textContent = 'COPIED';
        clearTimeout(timer);
        timer = setTimeout(function () { btn.textContent = 'COPY'; }, 1600);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
      } catch (e) { /* clipboard unavailable */ }
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('figure[data-viz="packet"]'), setupPacket);
    Array.prototype.forEach.call(document.querySelectorAll('figure[data-viz="code"]'), setupCode);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
