/** Datasheet client behaviour: reading level, copy buttons, cite toggle, prose-code copy, TOC scrollspy. Progressive enhancement. */
import { disposer, listen, ownerDoc, qs, qsa, storageSet } from './dom';

type Done = (ok: boolean) => void;

const flashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function copyText(doc: Document, text: string, done: Done): void {
  function fallback(): void {
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    doc.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      // execCommand is deprecated but is the only copy path without the async Clipboard API (insecure origins, old Safari).
      ok = (doc as unknown as { execCommand(cmd: string): boolean }).execCommand('copy');
    } catch {
      /* execCommand unavailable */
    }
    doc.body.removeChild(ta);
    done(ok);
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => done(true), fallback);
  } else fallback();
}

/** Temporarily replace a button's label (restores the original after 1.6 s). */
function flash(btn: HTMLElement, label: string): void {
  const old = btn.getAttribute('data-label') || btn.textContent || '';
  btn.setAttribute('data-label', old);
  btn.textContent = label;
  clearTimeout(flashTimers.get(btn));
  flashTimers.set(
    btn,
    setTimeout(() => {
      btn.textContent = old;
    }, 1600),
  );
}

function selectContents(doc: Document, el: Element): void {
  const r = doc.createRange();
  r.selectNodeContents(el);
  const s = doc.defaultView?.getSelection();
  if (!s) return;
  s.removeAllRanges();
  s.addRange(r);
}

/** Wire the reader behaviour under `root`. Returns a function that removes the window/document-level listeners. */
export function init(root: ParentNode = document): () => void {
  const doc = ownerDoc(root);
  const html = doc.documentElement;
  const off = disposer();

  // Reading level
  const ctl = qs('.level-ctl', root);
  function setLevel(l: string, persist: boolean): void {
    if (l === 'plain-language') html.setAttribute('data-level', 'plain-language');
    else html.removeAttribute('data-level');
    for (const b of qsa('[data-set-level]', root)) b.setAttribute('aria-pressed', String(b.getAttribute('data-set-level') === l));
    if (persist) {
      storageSet('rfc-level', l);
      try {
        const u = new URL(location.href);
        if (u.searchParams.has('level')) {
          u.searchParams.set('level', l);
          history.replaceState(null, '', u.toString());
        }
      } catch {
        /* history unavailable */
      }
    }
  }
  if (ctl) {
    ctl.hidden = false;
    setLevel(html.getAttribute('data-level') === 'plain-language' ? 'plain-language' : 'std', false);
    for (const b of qsa('[data-set-level]', root)) {
      off.add(listen(b, 'click', () => setLevel(b.getAttribute('data-set-level') ?? 'std', true)));
    }
  }

  // Copy link + copy buttons
  for (const b of qsa('[data-copy]', root)) {
    off.add(
      listen(b, 'click', () => {
        copyText(doc, b.getAttribute('data-copy') ?? '', (ok) => {
          if (ok) flash(b, 'Link copied');
          else {
            const f = qs('.permalink-note code', root) ?? qs('.cite-text', root);
            if (f) selectContents(doc, f);
          }
        });
      }),
    );
  }
  for (const b of qsa('[data-copy-target]', root)) {
    off.add(
      listen(b, 'click', () => {
        const el = qs(b.getAttribute('data-copy-target') ?? '', root);
        if (!el) return;
        copyText(doc, el.textContent ?? '', (ok) => {
          if (ok) flash(b, 'COPIED');
          else selectContents(doc, el);
        });
      }),
    );
  }

  // Cite toggle
  const citeBtn = qs('[data-cite-toggle]', root);
  const cite = qs('#cite', root);
  if (citeBtn && cite) {
    off.add(
      listen(citeBtn, 'click', () => {
        const open = citeBtn.getAttribute('aria-expanded') !== 'true';
        citeBtn.setAttribute('aria-expanded', String(open));
        cite.hidden = !open;
      }),
    );
  }

  // Copy buttons on prose code blocks
  for (const pre of qsa('.prose pre', root)) {
    const parent = pre.parentNode;
    if (!parent || (parent as Element).classList?.contains('has-copy')) continue;
    const wrap = doc.createElement('div');
    wrap.className = 'has-copy';
    parent.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'copy-btn copy-btn-float';
    b.textContent = 'COPY';
    b.addEventListener('click', () => {
      copyText(doc, pre.textContent ?? '', (ok) => {
        if (ok) flash(b, 'COPIED');
      });
    });
    wrap.appendChild(b);
  }

  // TOC scrollspy
  const links = qsa<HTMLAnchorElement>('.toc a[data-toc]', root);
  if (links.length && 'IntersectionObserver' in window) {
    const order = links.map((a) => a.getAttribute('data-toc') as string);
    const visible: Record<string, boolean> = {};
    let active: string | null = null;
    const mark = (): void => {
      const id = order.find((k) => visible[k]) ?? null;
      if (!id || id === active) return;
      active = id;
      for (const a of links) a.classList.toggle('is-active', a.getAttribute('data-toc') === id);
      // Long tables of contents (the RFC text) scroll inside their rail: keep the active entry in view.
      const cur = links.find((a) => a.getAttribute('data-toc') === id);
      const box = cur?.closest<HTMLElement>('.rt-toc');
      if (cur && box && (cur.offsetTop < box.scrollTop || cur.offsetTop + cur.offsetHeight > box.scrollTop + box.clientHeight)) {
        box.scrollTop = Math.max(0, cur.offsetTop - box.clientHeight / 3);
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible[e.target.id] = e.isIntersecting;
        mark();
      },
      { rootMargin: '-72px 0px -60% 0px' },
    );
    for (const id of order) {
      const s = doc.getElementById(id);
      if (s) io.observe(s);
    }
    off.add(() => io.disconnect());
  }
  return off.run;
}

if (typeof document !== 'undefined') init();
