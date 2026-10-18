/* rfc.akl.run Atlas coverage map: 200-column canvas, one cell per RFC number. */
import { disposer, listen, nav, ownerDoc, qs, qsa } from './dom';

/** byte per number: low 3 bits state (0 not issued, 1 reserved, 2-5 status class, faintest to strongest), high 4 bits category index (15 = none) */
export function decode(b64: string): Decoded {
  const bin = atob(b64),
    n = bin.length;
  const state = new Uint8Array(n),
    cat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = bin.charCodeAt(i);
    state[i] = b & 7;
    cat[i] = b >> 4;
  }
  return { state, cat };
}

type Decoded = { state: Uint8Array; cat: Uint8Array };
type CoverageJson = { max: number; categories: string[]; cells: string };
/** Titles shard (data/titles/<k>.json): RFC number -> [short title | null, title, year, status, tier]. */
type TitlesShard = Record<string, [string | null, string, number, string, string?]>;

const COLS = 200;
/** Ramp step for state 2..5: historic or obsoleted, unknown, informational or experimental, standard or BCP. */
const RAMP = ['historic', 'unknown', 'informational', 'standard'] as const;
const STATUS_LABEL: Record<string, string> = {
  'internet-standard': 'Internet Standard',
  'draft-standard': 'Draft Standard',
  'proposed-standard': 'Proposed Standard',
  bcp: 'BCP',
  informational: 'Informational',
  experimental: 'Experimental',
  historic: 'Historic',
  unknown: 'Unknown',
};

/** Wire the coverage map under `root`. No-op without #atlas-map. Returns a function that removes the window listeners. */
export function init(root: ParentNode = document): () => void {
  const off = disposer();
  const canvas = qs<HTMLCanvasElement>('#atlas-map', root);
  if (!canvas?.getContext) return off.run;
  const cv: HTMLCanvasElement = canvas;
  const doc = ownerDoc(root);

  const NAMES: Record<string, string> = {};
  const chips = qsa('.at-chip', root);
  const capLabel = qs('.at-cap-label', root);
  const capDetail = qs('.at-cap-detail', root);
  const idleLabel = capLabel ? capLabel.textContent : '';
  const idleDetail = capDetail ? capDetail.textContent : '';

  let data: Decoded | null = null;
  let cats: string[] = [];
  let max = Number(cv.getAttribute('data-max')) || 0;
  let filterKey = ''; // category key or '' (resolved to an index at draw time)
  let hover = 0; // RFC number under mouse/cursor, 0 = none
  let cursor = 1; // keyboard cursor
  let kbd = false; // cursor visible
  const shards: Record<number, Promise<TitlesShard>> = {};

  for (const c of chips) NAMES[c.getAttribute('data-cat') || ''] = c.textContent || '';

  const css = (name: string): string => getComputedStyle(doc.documentElement).getPropertyValue(name).trim();

  function draw(): void {
    if (!data) return;
    const w = cv.clientWidth;
    if (!w) return;
    const x = cv.getContext('2d');
    if (!x) return;
    const cell = w / COLS;
    const rows = Math.ceil(max / COLS);
    const h = Math.ceil(rows * cell);
    const gap = Math.max(0.6, cell * 0.14);
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.height = `${h}px`;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const col = {
      empty: css('--map-empty'),
      dim: css('--map-dim'),
      line: css('--line-strong'),
      ink: css('--ink'),
    };
    // The cell shade encodes the status class (state 2..5); the area chips dim the cells outside the chosen area.
    const ramp = RAMP.map((k) => css(`--map-${k}`) || col.empty);
    const size = cell - gap;
    const filterIdx = filterKey ? cats.indexOf(filterKey) : -1;
    x.beginPath();
    for (let n = 1; n <= max; n++) {
      const i = n - 1;
      if ((data.state[i] ?? 0) > 1) continue;
      const cx = (i % COLS) * cell;
      const cy = Math.floor(i / COLS) * cell;
      x.moveTo(cx, cy + size);
      x.lineTo(cx + size, cy);
    }
    x.strokeStyle = col.line;
    x.lineWidth = 0.8;
    x.stroke();
    for (let m = 1; m <= max; m++) {
      const j = m - 1;
      const s = data.state[j] ?? 0;
      if (s < 2) continue;
      const dim = filterIdx >= 0 && data.cat[j] !== filterIdx;
      x.fillStyle = dim ? col.dim : (ramp[s - 2] ?? col.empty);
      x.fillRect((j % COLS) * cell, Math.floor(j / COLS) * cell, size, size);
    }
    const sel = hover || (kbd ? cursor : 0);
    if (sel) {
      const k = sel - 1;
      x.strokeStyle = col.ink;
      x.lineWidth = 1.5;
      x.strokeRect((k % COLS) * cell - 1, Math.floor(k / COLS) * cell - 1, size + 2, size + 2);
    }
  }

  function numAt(e: MouseEvent): number {
    const b = cv.getBoundingClientRect();
    const cell = b.width / COLS;
    if (!cell) return 0;
    const col = Math.floor((e.clientX - b.left) / cell);
    const n = Math.floor((e.clientY - b.top) / cell) * COLS + col + 1;
    return col >= 0 && col < COLS && n >= 1 && n <= max ? n : 0;
  }

  function shard(n: number): Promise<TitlesShard> {
    const k = Math.floor((n - 1) / 1000);
    let p = shards[k];
    if (!p) {
      p = fetch(`/data/titles/${k}.json`)
        .then((r) => {
          if (!r.ok) throw new Error('shard');
          return r.json() as Promise<TitlesShard>;
        })
        .catch(() => {
          delete shards[k];
          return {} as TitlesShard;
        });
      shards[k] = p;
    }
    return p;
  }

  function caption(n: number): void {
    if (!capLabel || !capDetail || !data) return;
    const d = data;
    if (!n) {
      capLabel.textContent = idleLabel;
      capDetail.textContent = idleDetail;
      return;
    }
    const i = n - 1;
    const st = d.state[i] ?? 0;
    if (st === 0) {
      capLabel.textContent = `RFC ${n}`;
      capDetail.textContent = '— never issued';
      return;
    }
    if (st === 1) {
      capLabel.textContent = `RFC ${n}`;
      capDetail.textContent = '— number reserved, not yet published';
      return;
    }
    capLabel.textContent = `RFC ${n}`;
    capDetail.textContent = `— rfc.akl.run/rfc${n}`;
    void shard(n).then((sh) => {
      if (hover !== n && !(kbd && cursor === n && !hover)) return;
      const t = sh[String(n)];
      if (!t) return;
      const name = t[0] || t[1];
      const catKey = cats[d.cat[i] ?? 15];
      const status = STATUS_LABEL[t[3]] || t[3];
      const parts = [
        st === 2 && t[3] !== 'historic' ? `${status}, obsoleted` : status,
        (catKey && NAMES[catKey]) || catKey || '',
        String(t[2]),
      ];
      capLabel.textContent = `RFC ${n} · ${name}`;
      capDetail.textContent = `— ${parts.filter(Boolean).join(' · ')}`;
    });
  }

  function setHover(n: number): void {
    if (n === hover) return;
    hover = n;
    caption(hover || (kbd ? cursor : 0));
    draw();
  }

  cv.addEventListener('mousemove', (e) => {
    kbd = false;
    setHover(numAt(e));
  });
  cv.addEventListener('mouseleave', () => setHover(0));
  cv.addEventListener('click', (e) => {
    const n = numAt(e);
    if (n) nav.to(`/rfc${n}`);
  });
  cv.addEventListener('focus', () => {
    kbd = true;
    caption(cursor);
    draw();
  });
  cv.addEventListener('blur', () => {
    kbd = false;
    caption(0);
    draw();
  });
  const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
  cv.addEventListener('keydown', (e) => {
    const d = STEP[e.key];
    if (d) {
      e.preventDefault();
      kbd = true;
      hover = 0;
      cursor = Math.min(max, Math.max(1, cursor + d));
      caption(cursor);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      nav.to(`/rfc${cursor}`);
    }
  });

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      filterKey = chip.getAttribute('data-cat') || '';
      for (const c of chips) c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
      draw();
    });
  }

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    off.add(() => ro.disconnect());
  } else off.add(listen(window, 'resize', draw));
  off.add(listen(window, 'rfc:theme', draw));

  fetch('/data/coverage.json')
    .then((r) => {
      if (!r.ok) throw new Error('coverage');
      return r.json() as Promise<CoverageJson>;
    })
    .then((c) => {
      max = c.max;
      cats = c.categories;
      data = decode(c.cells);
      draw();
    })
    .catch(() => {
      if (capDetail) capDetail.textContent = '— map data unavailable; browse by area instead.';
    });
  return off.run;
}

if (typeof document !== 'undefined') init();
