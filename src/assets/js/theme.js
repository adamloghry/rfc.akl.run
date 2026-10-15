(function () {
  'use strict';
  var root = document.documentElement;

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rfc-theme', next); } catch (e) {}
    window.dispatchEvent(new CustomEvent('rfc:theme', { detail: next }));
  }

  var btns = document.querySelectorAll('.theme-toggle');
  for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', toggle);

  // "/" focuses the search field unless the user is typing somewhere.
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    var input = document.querySelector('.search-input');
    if (!input) return;
    e.preventDefault();
    input.focus();
    if (input.select) input.select();
  });
})();
