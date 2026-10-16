/* rfc.akl.run shared search: number jump, curated questions, static full-text index (/data/search/).
   Included on every page via the header search box; a no-op without .search-input. Data loads lazily on first focus. */
import { disposer, listen, nav, ownerDoc, qs, qsa } from './dom';
import {
  type DocRowIn,
  docRow,
  matchQuestions,
  type Postings,
  parseNumber,
  plan,
  type Question,
  type Row,
  rank,
  shardsOf,
} from './search-core';

type Cov = { max: number; states: Uint8Array };
type CoverageJson = { max: number; cells: string };
type SearchMeta = { shards: number };
/** Titles shard (data/titles/<k>.json): RFC number -> [short title | null, title, year, status]. */
type TitlesShard = Record<string, [string | null, string, number?, string?]>;
type FullText = { shards: number; docs: DocRowIn[]; prefix: Record<string, string[]> };
type SearchInput = HTMLInputElement & { fillQuery?: (q: string) => void };

const TIERS = ['NOT ISSUED', 'RESERVED', 'INDEX', 'SUMMARY', 'EXPLAINER', 'EXPLAINER'];
const DEBOUNCE_MS = 80;
const MAX_ROWS = 6;

function decodeStates(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 7;
  return out;
}

/** Lazy, memoised data access for one search instance. Failed loads are forgotten so a later attempt can retry. */
function createLoader() {
  const cache = new Map<string, Promise<unknown>>();
  function getJSON<T>(url: string): Promise<T> {
    let p = cache.get(url);
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url} ${r.status}`);
        return r.json();
      });
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return p as Promise<T>;
  }

  let coveragePromise: Promise<Cov> | null = null;
  function getCoverage(): Promise<Cov> {
    if (!coveragePromise) {
      const p = getJSON<CoverageJson>('/data/coverage.json').then((c) => ({ max: c.max, states: decodeStates(c.cells) }));
      p.catch(() => {
        coveragePromise = null;
      });
      coveragePromise = p;
    }
    return coveragePromise;
  }

  /* full-text index: meta + docs + prefix table up front (on first focus), term shards on demand */
  let ftPromise: Promise<FullText> | null = null;
  function getFullText(): Promise<FullText> {
    if (!ftPromise) {
      const p = Promise.all([
        getJSON<SearchMeta>('/data/search/meta.json'),
        getJSON<DocRowIn[]>('/data/search/docs.json'),
        getJSON<Record<string, string[]>>('/data/search/prefix.json').catch(() => ({}) as Record<string, string[]>),
      ]).then(([meta, docs, prefix]) => ({ shards: meta.shards, docs, prefix }));
      p.catch(() => {
        ftPromise = null; // degrade: numbers + questions only
      });
      ftPromise = p;
    }
    return ftPromise;
  }

  async function fullTextSearch(q: string, limit: number): Promise<Row[]> {
    const ft = await getFullText();
    const p = plan(q, ft.prefix);
    const ks = shardsOf(p, ft.shards);
    const shards = await Promise.all(
      ks.map((k) => getJSON<Postings>(`/data/search/t-${k < 10 ? '0' : ''}${k}.json`).catch(() => ({}) as Postings)),
    );
    const postings: Postings = {};
    for (const sh of shards) Object.assign(postings, sh);
    const out: Row[] = [];
    for (const r of rank(p, postings, limit)) {
      const d = ft.docs[r.id];
      if (d) out.push(docRow(d));
    }
    return out;
  }

  async function numberRow(n: number, cov: Cov | null): Promise<Row> {
    const row: Row = { label: `RFC ${n}`, title: '', tag: '', tier: '', href: `/${n}/` };
    const st = cov ? (cov.states[n - 1] ?? 2) : 2;
    row.tag = TIERS[st] || 'INDEX';
    row.tier = st >= 4 ? 'explainer' : st === 3 ? 'summary' : 'index';
    if (st === 0) {
      row.title = 'never issued';
      row.tag = '';
      return row;
    }
    if (st === 1) {
      row.title = 'number reserved, not yet published';
      row.tag = '';
      return row;
    }
    try {
      const shard = await getJSON<TitlesShard>(`/data/titles/${Math.floor((n - 1) / 1000)}.json`);
      const t = shard[String(n)];
      if (t) row.title = t[0] ? `${t[0]}: ${t[1]}` : t[1];
    } catch {
      /* title unavailable: show the bare number row */
    }
    return row;
  }

  return { getJSON, getCoverage, getFullText, fullTextSearch, numberRow };
}

type Loader = ReturnType<typeof createLoader>;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string | null, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** One controller per search input. Returns false when the input has no popup markup next to it. */
function attach(input: SearchInput, ids: { n: number }, data: Loader, off: ReturnType<typeof disposer>): boolean {
  const doc = ownerDoc(input);
  const box = input.closest<HTMLElement>('.search-box');
  const pop = box && qs('.search-pop', box);
  const list = pop && qs('[role="listbox"]', pop);
  if (!box || !pop || !list) return false;
  const id = `sr${++ids.n}`;
  list.id = list.id || `${id}-list`;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);

  let flushEnter = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let token = 0;
  let active = -1;
  const empty = make('div', 'search-empty');
  empty.hidden = true;
  pop.appendChild(empty);

  function close(): void {
    if (!pop || !list) return;
    pop.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function setActive(i: number): void {
    const els = qsa('.search-row', list as HTMLElement);
    if (!els.length) {
      active = -1;
      return;
    }
    active = (i + els.length) % els.length;
    els.forEach((el, j) => {
      el.setAttribute('aria-selected', j === active ? 'true' : 'false');
    });
    input.setAttribute('aria-activedescendant', (els[active] as HTMLElement).id);
  }
  function render(items: Row[], q: string, final: boolean): void {
    if (!pop || !list) return;
    const keep = active >= 0 ? qsa('.search-row', list)[active] : null;
    const keepHref = keep ? keep.getAttribute('href') : null;
    list.textContent = '';
    empty.textContent = '';
    empty.hidden = true;
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!items.length) {
      if (!(final && q.length > 2)) {
        close();
        return;
      }
      empty.hidden = false;
      empty.appendChild(document.createTextNode('No matching RFC or question. Try a protocol name or a number, or '));
      const a = make('a', null, 'suggest this question');
      a.href = `https://github.com/adamloghry/rfc.akl.run/issues/new?template=question.yml&title=${encodeURIComponent(q)}`;
      empty.appendChild(a);
      empty.appendChild(document.createTextNode('.'));
    } else {
      items.forEach((it, i) => {
        const a = make('a', 'search-row');
        a.id = `${id}-${i}`;
        a.href = it.href;
        a.setAttribute('role', 'option');
        a.setAttribute('aria-selected', 'false');
        a.appendChild(make('span', 'sr-label', it.label));
        a.appendChild(make('span', 'sr-title', it.title));
        a.appendChild(make('span', `sr-tag${it.tier ? ` is-${it.tier}` : ''}`, it.tag || ''));
        a.addEventListener('mousemove', () => {
          if (active !== i) setActive(i);
        });
        list.appendChild(a);
        if (keepHref && a.getAttribute('href') === keepHref) setActive(i);
      });
    }
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    const first = items[0];
    if (flushEnter && first) {
      flushEnter = false;
      nav.to(first.href);
    }
  }

  async function run(q: string): Promise<void> {
    const my = ++token;
    if (!q) {
      close();
      return;
    }
    const items: Row[] = [];
    const seen: Record<string, number> = {};
    const add = (it: Row): void => {
      if (seen[it.href] || items.length >= MAX_ROWS) return;
      seen[it.href] = 1;
      items.push(it);
    };
    try {
      const [cov, questions] = await Promise.all([
        /^\d+$/.test(q) ? data.getCoverage().catch(() => null) : Promise.resolve(null),
        data.getJSON<Question[]>('/data/questions.json').catch(() => [] as Question[]),
      ]);
      if (my !== token) return;
      const n = cov ? parseNumber(q, cov.max) : null;
      const nr = n ? await data.numberRow(n, cov) : null;
      if (my !== token) return;
      if (nr) add(nr);
      for (const m of matchQuestions(q, questions)) {
        add({ label: m.label || 'JOURNEY', title: m.title || m.q, tag: 'QUESTION', tier: '', href: m.href || '' });
      }
      const needsFt = items.length < MAX_ROWS;
      render(items.slice(), q, !needsFt);
      if (!needsFt) return;
      try {
        const rs = await data.fullTextSearch(q, MAX_ROWS);
        if (my !== token) return;
        rs.forEach(add);
      } catch {
        /* degrade: keep the number + question rows */
      }
      if (my === token) render(items.slice(), q, true);
    } catch {
      if (my === token) render(items.slice(), q, true);
    }
  }

  input.addEventListener('focus', () => {
    data.getFullText().catch(() => {});
    data.getJSON('/data/questions.json').catch(() => {});
  });
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    flushEnter = false;
    const q = input.value.trim();
    timer = setTimeout(() => {
      timer = null;
      void run(q);
    }, DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (!pop || !list) return;
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
        void run(input.value.trim());
        return;
      }
      const els = qsa<HTMLAnchorElement>('.search-row', list);
      const target = els[active >= 0 ? active : 0];
      if (!pop.hidden && target) {
        e.preventDefault();
        nav.to(target.href);
      } else {
        const n = parseNumber(input.value.trim(), 99999);
        if (n) {
          e.preventDefault();
          nav.to(`/${n}/`);
        }
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  off.add(
    listen<MouseEvent>(doc, 'mousedown', (e) => {
      if (!box.contains(e.target as Node)) close();
    }),
  );
  input.fillQuery = (q: string) => {
    input.value = q;
    input.focus();
    if (timer) clearTimeout(timer);
    void run(q.trim());
  };
  return true;
}

/** Wire every .search-input (and [data-search-fill] suggestion button) under `root`. Returns a function that removes the document listeners. */
export function init(root: ParentNode = document): () => void {
  const off = disposer();
  const inputs = qsa<SearchInput>('.search-input', root);
  const fills = qsa('[data-search-fill]', root);
  if (!inputs.length && !fills.length) return off.run;

  const data = createLoader();
  const ids = { n: 0 };
  for (const input of inputs) attach(input, ids, data, off);

  for (const btn of fills) {
    btn.addEventListener('click', () => {
      const target = qs<SearchInput>('.search-hero .search-input', root) ?? inputs[0];
      target?.fillQuery?.(btn.getAttribute('data-search-fill') || btn.textContent || '');
    });
  }
  return off.run;
}

if (typeof document !== 'undefined') init();
