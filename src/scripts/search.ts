/* rfc.akl.run shared search: number jump, curated questions, static full-text index (/data/search/).
   Included on every page via the header search box; a no-op without .search-input. Data loads lazily on first focus. */
import { parseNumber, matchQuestions, plan, shardsOf, rank, docRow, type Row, type Question, type DocRowIn } from './search-core';

function init(): void {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.search-input'));
  const fills = Array.from(document.querySelectorAll<HTMLElement>('[data-search-fill]'));
  if (!inputs.length && !fills.length) return;

  /* ---- shared lazy data ---- */
  const cache: Record<string, Promise<any>> = {};
  function getJSON(url: string): Promise<any> {
    if (!cache[url]) {
      cache[url] = fetch(url).then((r) => {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return r.json();
      });
      cache[url].catch(() => { delete cache[url]; });
    }
    return cache[url];
  }
  function decodeStates(b64: string): Uint8Array {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 7;
    return out;
  }
  type Cov = { max: number; states: Uint8Array };
  let coveragePromise: Promise<Cov> | null = null;
  function getCoverage(): Promise<Cov> {
    if (!coveragePromise) {
      coveragePromise = getJSON('/data/coverage.json').then((c) => ({ max: c.max, states: decodeStates(c.cells) }));
      coveragePromise.catch(() => { coveragePromise = null; });
    }
    return coveragePromise;
  }
  /* full-text index: meta + docs + prefix table up front (on first focus), term shards on demand */
  type FT = { shards: number; docs: DocRowIn[]; prefix: Record<string, string[]> };
  let ftPromise: Promise<FT> | null = null;
  function getFullText(): Promise<FT> {
    if (!ftPromise) {
      ftPromise = Promise.all([
        getJSON('/data/search/meta.json'), getJSON('/data/search/docs.json'),
        getJSON('/data/search/prefix.json').catch(() => ({})),
      ]).then((r) => ({ shards: r[0].shards, docs: r[1], prefix: r[2] }));
      ftPromise.catch(() => { ftPromise = null; }); // degrade: numbers + questions only
    }
    return ftPromise;
  }
  function fullTextSearch(q: string, limit: number): Promise<Row[]> {
    return getFullText().then((ft) => {
      const p = plan(q, ft.prefix);
      const ks = shardsOf(p, ft.shards);
      return Promise.all(ks.map((k) => getJSON('/data/search/t-' + (k < 10 ? '0' : '') + k + '.json').catch(() => ({})))).then((shards) => {
        const postings: Record<string, any> = {};
        shards.forEach((sh) => Object.keys(sh).forEach((t) => { postings[t] = sh[t]; }));
        return rank(p, postings, limit).map((r) => docRow(ft.docs[r.id]));
      });
    });
  }

  const TIERS = ['NOT ISSUED', 'RESERVED', 'INDEX', 'SUMMARY', 'EXPLAINER', 'EXPLAINER'];

  function numberRow(n: number, cov: Cov | null): Promise<Row> {
    const row: Row = { label: 'RFC ' + n, title: '', tag: '', tier: '', href: '/' + n + '/' };
    const st = cov ? cov.states[n - 1] : 2;
    row.tag = TIERS[st] || 'INDEX';
    row.tier = st >= 4 ? 'explainer' : st === 3 ? 'summary' : 'index';
    if (st === 0) { row.title = 'never issued'; row.tag = ''; return Promise.resolve(row); }
    if (st === 1) { row.title = 'number reserved, not yet published'; row.tag = ''; return Promise.resolve(row); }
    const k = Math.floor((n - 1) / 1000);
    return getJSON('/data/titles/' + k + '.json').then((shard) => {
      const t = shard[String(n)];
      if (t) row.title = t[0] ? t[0] + ': ' + t[1] : t[1];
      return row;
    }, () => row);
  }

  /* ---- one controller per input ---- */
  let uid = 0;
  function attach(input: HTMLInputElement & { fillQuery?: (q: string) => void }): void {
    const box = input.closest('.search-box') as HTMLElement | null;
    const pop = box && box.querySelector<HTMLElement>('.search-pop');
    const list = pop && pop.querySelector<HTMLElement>('[role="listbox"]');
    if (!box || !pop || !list) return;
    const id = 'sr' + (++uid);
    list.id = list.id || id + '-list';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);

    let flushEnter = false, timer: ReturnType<typeof setTimeout> | null = null, token = 0, active = -1;
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.hidden = true;
    pop.appendChild(empty);

    function close(): void {
      pop!.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function setActive(i: number): void {
      const els = list!.querySelectorAll('.search-row');
      if (!els.length) { active = -1; return; }
      active = (i + els.length) % els.length;
      for (let j = 0; j < els.length; j++) els[j].setAttribute('aria-selected', j === active ? 'true' : 'false');
      input.setAttribute('aria-activedescendant', els[active].id);
    }
    function make(tag: string, cls: string | null, text?: string): HTMLElement {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function render(items: Row[], q: string, final: boolean): void {
      const keep = active >= 0 ? list!.querySelectorAll('.search-row')[active] : null;
      const keepHref = keep ? keep.getAttribute('href') : null;
      list!.textContent = '';
      empty.textContent = '';
      empty.hidden = true;
      active = -1;
      input.removeAttribute('aria-activedescendant');
      if (!items.length) {
        if (!(final && q.length > 2)) { close(); return; }
        empty.hidden = false;
        empty.appendChild(document.createTextNode('No matching RFC or question. Try a protocol name or a number, or '));
        const a = make('a', null, 'suggest this question') as HTMLAnchorElement;
        a.href = 'https://github.com/adamloghry/rfc.akl.run/issues/new?template=question.yml&title=' + encodeURIComponent(q);
        empty.appendChild(a);
        empty.appendChild(document.createTextNode('.'));
      } else {
        items.forEach((it, i) => {
          const a = make('a', 'search-row') as HTMLAnchorElement;
          a.id = id + '-' + i;
          a.href = it.href;
          a.setAttribute('role', 'option');
          a.setAttribute('aria-selected', 'false');
          a.appendChild(make('span', 'sr-label', it.label));
          a.appendChild(make('span', 'sr-title', it.title));
          a.appendChild(make('span', 'sr-tag' + (it.tier ? ' is-' + it.tier : ''), it.tag || ''));
          a.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
          list!.appendChild(a);
          if (keepHref && a.getAttribute('href') === keepHref) setActive(i);
        });
      }
      pop!.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (flushEnter && items.length) { flushEnter = false; location.href = items[0].href; }
    }

    function run(q: string): void {
      const my = ++token;
      if (!q) { close(); return; }
      const items: Row[] = [];
      const seen: Record<string, number> = {};
      const add = (it: Row) => {
        if (seen[it.href] || items.length >= 6) return;
        seen[it.href] = 1;
        items.push(it);
      };
      const covP = /^\d+$/.test(q) ? getCoverage().catch(() => null) : Promise.resolve(null);
      const qsP: Promise<Question[]> = getJSON('/data/questions.json').catch(() => []);
      Promise.all([covP, qsP]).then((res) => {
        if (my !== token) return;
        const cov = res[0], qs = res[1];
        const n = cov ? parseNumber(q, cov.max) : null;
        const numP = n ? numberRow(n, cov) : Promise.resolve(null);
        return numP.then((nr) => {
          if (my !== token) return;
          if (nr) add(nr);
          matchQuestions(q, qs).forEach((m) => {
            add({ label: m.label || 'JOURNEY', title: m.title || m.q, tag: 'QUESTION', tier: '', href: m.href || '' });
          });
          const needsFt = items.length < 6;
          render(items.slice(), q, !needsFt);
          if (!needsFt) return;
          return fullTextSearch(q, 6).then((rs) => {
            if (my !== token) return;
            rs.forEach(add);
            render(items.slice(), q, true);
          }).catch(() => {
            if (my === token) render(items.slice(), q, true);
          });
        });
      }).catch(() => { if (my === token) render(items.slice(), q, true); });
    }

    input.addEventListener('focus', () => { getFullText().catch(() => {}); getJSON('/data/questions.json').catch(() => {}); });
    input.addEventListener('input', () => {
      if (timer) clearTimeout(timer);
      flushEnter = false;
      const q = input.value.trim();
      timer = setTimeout(() => { timer = null; run(q); }, 80);
    });
    input.addEventListener('keydown', (e) => {
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
          run(input.value.trim());
          return;
        }
        const els = list.querySelectorAll<HTMLAnchorElement>('.search-row');
        if (!pop.hidden && els.length) {
          e.preventDefault();
          location.href = els[active >= 0 ? active : 0].href;
        } else {
          const n = parseNumber(input.value.trim(), 99999);
          if (n) { e.preventDefault(); location.href = '/' + n + '/'; }
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });
    document.addEventListener('mousedown', (e) => { if (!box.contains(e.target as Node)) close(); });
    input.fillQuery = (q: string) => {
      input.value = q;
      input.focus();
      if (timer) clearTimeout(timer);
      run(q.trim());
    };
  }

  inputs.forEach(attach);

  fills.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = (document.querySelector('.search-hero .search-input') || inputs[0]) as (HTMLInputElement & { fillQuery?: (q: string) => void }) | undefined;
      if (target && target.fillQuery) target.fillQuery(btn.getAttribute('data-search-fill') || btn.textContent || '');
    });
  });
}

if (typeof document !== 'undefined') init();
