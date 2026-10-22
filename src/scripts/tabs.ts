/**
 * RFC page tabs ("RFC text" / "ISO Plain Language"). Progressive enhancement: without JS both panels are in the page, in
 * order. With JS they become an ARIA tabs widget (arrow keys, Home/End). The URL hash picks the tab: `#plain-language` and any
 * anchor that lives inside the AI panel (#packet-format, #field-oper, #step-3) open ISO Plain Language; `#section-3`, no
 * hash and unknown hashes open RFC text. Switching tabs rewrites the hash with replaceState (`#plain-language`, or none).
 * The default is always RFC text; nothing is persisted.
 */
import { disposer, listen, ownerDoc, qs, qsa } from './dom';
import { isPlainLanguageName } from './legacy';

type Name = 'text' | 'plain-language';

/** Which tab the hash belongs to. */
export function tabForHash(doc: Document, hash: string): Name {
  let id = hash.replace(/^#/, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    /* keep the raw id */
  }
  if (!id) return 'text';
  if (isPlainLanguageName(id)) return 'plain-language';
  const el = doc.getElementById(id);
  const panel = el?.closest('[data-tab-panel]');
  return panel?.getAttribute('data-tab-panel') === 'plain-language' ? 'plain-language' : 'text';
}

/** Wire the tabs under `root`. Returns a function that removes the listeners. */
export function init(root: ParentNode = document): () => void {
  const doc = ownerDoc(root);
  const wrap = qs('[data-tabs]', root);
  const off = disposer();
  if (!wrap) return off.run;
  const list = qs('[role="tablist"]', wrap);
  const tabs = qsa<HTMLElement>('[role="tab"][data-tab]', wrap);
  const panels = new Map<string, HTMLElement>(
    qsa<HTMLElement>('[data-tab-panel]', wrap).map((p) => [p.getAttribute('data-tab-panel') ?? '', p]),
  );
  if (!list || tabs.length < 2 || panels.size < 2) return off.run;
  list.hidden = false;
  wrap.classList.add('tabs-on');

  function show(name: Name): void {
    doc.documentElement.setAttribute('data-tab', name);
    for (const t of tabs) {
      const on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    for (const [k, p] of panels) p.hidden = k !== name;
  }
  const bringTabsIntoView = (): void => {
    const r = list?.getBoundingClientRect();
    if (r && (r.top < 0 || r.top > (doc.defaultView?.innerHeight ?? 0))) list?.scrollIntoView({ block: 'start' });
  };
  function setHash(name: Name): void {
    try {
      const u = new URL(location.href);
      u.hash = name === 'plain-language' ? '#plain-language' : '';
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {
      /* history unavailable */
    }
  }
  function choose(name: Name, focus: boolean): void {
    show(name);
    setHash(name);
    if (focus) tabs.find((t) => t.getAttribute('data-tab') === name)?.focus();
    bringTabsIntoView();
  }
  /** Apply the URL hash: pick the tab and scroll to the anchor (which may have just become visible). */
  function fromHash(): void {
    const name = tabForHash(doc, location.hash);
    show(name);
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!id) return;
    if (isPlainLanguageName(id)) {
      // A legacy alias (#eli5) names the same panel: open it and leave the canonical hash behind.
      if (id !== 'plain-language') setHash('plain-language');
      bringTabsIntoView();
    } else doc.getElementById(id)?.scrollIntoView();
  }

  tabs.forEach((t, i) => {
    off.add(listen(t, 'click', () => choose(t.getAttribute('data-tab') === 'plain-language' ? 'plain-language' : 'text', false)));
    off.add(
      listen(t, 'keydown', (e) => {
        const k = (e as KeyboardEvent).key;
        const to = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
        if (to === null) return;
        e.preventDefault();
        const next = tabs[(to + tabs.length) % tabs.length];
        choose(next?.getAttribute('data-tab') === 'plain-language' ? 'plain-language' : 'text', true);
      }),
    );
  });
  off.add(listen(window, 'hashchange', fromHash));
  fromHash();
  return off.run;
}

if (typeof document !== 'undefined') init();
