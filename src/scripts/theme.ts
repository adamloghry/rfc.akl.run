// Theme toggle and the "/" search shortcut. Progressive enhancement: the pre-paint script in
// BaseLayout.astro (is:inline) sets data-theme before first paint; this wires the buttons.
const root = document.documentElement;

function current(): 'dark' | 'light' {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function toggle(): void {
  const next = current() === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('rfc-theme', next); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent('rfc:theme', { detail: next }));
}

document.querySelectorAll('.theme-toggle').forEach((b) => b.addEventListener('click', toggle));

// "/" focuses the search field unless the user is typing somewhere.
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  const tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
  const input = document.querySelector<HTMLInputElement>('.search-input');
  if (!input) return;
  e.preventDefault();
  input.focus();
  input.select?.();
});
