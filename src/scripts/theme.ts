// Theme toggle and the "/" search shortcut. Progressive enhancement: the pre-paint script in
// BaseLayout.astro (is:inline) sets data-theme before first paint; this wires the buttons.
import { disposer, listen, ownerDoc, qs, qsa, storageSet } from './dom';

/** Wire the theme buttons under `root` and the "/" shortcut. Returns a function that removes the document listener. */
export function init(root: ParentNode = document): () => void {
  const doc = ownerDoc(root);
  const html = doc.documentElement;
  const off = disposer();

  const current = (): 'dark' | 'light' => (html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  function toggle(): void {
    const next = current() === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    storageSet('rfc-theme', next);
    window.dispatchEvent(new CustomEvent('rfc:theme', { detail: next }));
  }

  for (const b of qsa('.theme-toggle', root)) off.add(listen(b, 'click', toggle));

  // "/" focuses the search field unless the user is typing somewhere.
  off.add(
    listen<KeyboardEvent>(doc, 'keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      const input = qs<HTMLInputElement>('.search-input', doc);
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select?.();
    }),
  );
  return off.run;
}

if (typeof document !== 'undefined') init();
