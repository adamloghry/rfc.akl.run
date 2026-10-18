// Small DOM helpers shared by the client scripts. No behaviour of its own; the scripts stay progressive enhancement.

/** The Document a ParentNode belongs to (the node itself when it is a Document). */
export function ownerDoc(root: ParentNode): Document {
  return (root as Node).nodeType === 9 ? (root as Document) : ((root as Node).ownerDocument ?? document);
}

export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

export function qsa<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** localStorage read that never throws (private mode, blocked storage). */
export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** localStorage write that never throws. */
export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Run `fn` now, or once the document has finished parsing. */
export function onReady(fn: () => void): void {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

/** Full-page navigation. A seam so tests can observe it (location.href assignment is not spy-able in every DOM). */
export const nav = {
  to(url: string): void {
    location.href = url;
  },
};

/** Collects teardown callbacks for the listeners a script attaches to window/document. */
export function disposer(): { add(off: () => void): void; run(): void } {
  const offs: Array<() => void> = [];
  return {
    add: (off) => {
      offs.push(off);
    },
    run: () => {
      while (offs.length) offs.pop()?.();
    },
  };
}

/** addEventListener that returns its own remover. Pass the event type as E for a typed handler. */
export function listen<E extends Event = Event>(target: EventTarget, type: string, fn: (e: E) => void): () => void {
  target.addEventListener(type, fn as EventListener);
  return () => target.removeEventListener(type, fn as EventListener);
}
