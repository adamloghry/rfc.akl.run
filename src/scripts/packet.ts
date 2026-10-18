// Packet viewer client script; self-initializes on all matching figures.
import { disposer, listen, onReady, ownerDoc, qs, qsa } from './dom';

function setupPacket(fig: HTMLElement, off: ReturnType<typeof disposer>): void {
  const doc = ownerDoc(fig);
  const body = qs('.pk-body', fig);
  const cells = qsa<HTMLElement>('.pk-cell', fig);
  if (!body || !cells.length) return;
  const inspector = qs('.pk-inspector', fig);
  const seg = qs('.viz-seg', fig);
  const table = qs('.viz-packet-table', fig);
  const nName = inspector && qs('.pk-i-name', inspector);
  const nDesc = inspector && qs('.pk-i-desc', inspector);
  const nSize = inspector && qs('.pk-i-size', inspector);

  // The grid replaces the table visually; the table stays for screen readers.
  if (table) table.classList.add('visually-hidden');
  if (seg) seg.hidden = false;
  if (inspector) inspector.hidden = false;

  // One tab stop per field: continuation fragments are skipped.
  for (const c of cells) if (!c.id) c.setAttribute('tabindex', '-1');

  function select(key: string): boolean {
    let first: HTMLElement | null = null;
    for (const c of cells) {
      const on = c.getAttribute('data-key') === key;
      c.classList.toggle('is-selected', on);
      if (on && !first) first = c;
    }
    if (!first) return false;
    if (nName) nName.textContent = first.getAttribute('data-name') || key.toUpperCase();
    if (nDesc) nDesc.textContent = first.getAttribute('data-desc') || '';
    if (nSize) nSize.textContent = first.getAttribute('data-size') || '';
    return true;
  }

  function setMode(mode: string): void {
    body?.setAttribute('data-mode', mode);
    for (const c of cells) {
      c.classList.toggle('is-changed', c.getAttribute('data-changed') === mode);
      for (const v of qsa('.pk-v', c)) v.hidden = v.getAttribute('data-mode-val') !== mode;
    }
    if (seg) for (const b of qsa('button', seg)) b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false');
  }

  function remember(key: string): void {
    try {
      history.replaceState(null, '', `#field-${key}`);
    } catch {
      /* file:// etc. */
    }
  }

  for (const c of cells) {
    const key = c.getAttribute('data-key') ?? '';
    c.addEventListener('mouseenter', () => select(key));
    c.addEventListener('focus', () => {
      select(key);
      remember(key);
    });
    c.addEventListener('click', (e) => {
      e.preventDefault();
      select(key);
      remember(key);
    });
  }
  if (seg) {
    seg.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button[data-mode]') : null;
      if (b) setMode(b.getAttribute('data-mode') ?? '');
    });
  }

  function fromHash(): boolean {
    const m = /^#field-(.+)$/.exec(location.hash || '');
    if (!m?.[1]) return false;
    let key: string;
    try {
      key = decodeURIComponent(m[1]);
    } catch {
      return false;
    }
    const el = doc.getElementById(`field-${key}`);
    if (!el || !fig.contains(el)) return false;
    select(key);
    el.scrollIntoView({ block: 'center' });
    return true;
  }

  const firstMode = seg && qs('button[data-mode]', seg);
  if (seg && firstMode) setMode((qs('button[aria-pressed="true"]', seg) ?? firstMode).getAttribute('data-mode') ?? '');
  if (!fromHash()) {
    const start = cells.find((c) => c.hasAttribute('data-changed')) ?? cells[0];
    if (start) select(start.getAttribute('data-key') ?? '');
  }
  off.add(listen(window, 'hashchange', fromHash));
}

/** `code` viz: reveal and wire the COPY button. */
function setupCode(fig: HTMLElement): void {
  const btn = qs('.code-copy', fig);
  const pre = qs('pre', fig);
  if (!btn || !pre) return;
  btn.hidden = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  btn.addEventListener('click', () => {
    const text = pre.textContent ?? '';
    const done = (): void => {
      btn.textContent = 'COPIED';
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = 'COPY';
      }, 1600);
    };
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => {});
    } catch {
      /* clipboard unavailable */
    }
  });
}

/** Wire every packet and code figure under `root`. Returns a function that removes the window listeners. */
export function init(root: ParentNode = document): () => void {
  const off = disposer();
  for (const fig of qsa('figure[data-viz="packet"]', root)) setupPacket(fig, off);
  for (const fig of qsa('figure[data-viz="code"]', root)) setupCode(fig);
  return off.run;
}

onReady(() => {
  init();
});
