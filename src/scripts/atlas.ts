/* rfc.akl.run Atlas coverage map: 200-column canvas, one cell per RFC number. */

/** byte per number: low 3 bits state, high 4 bits category index (15 = none) */
export function decode(b64: string): { state: Uint8Array; cat: Uint8Array } {
  const bin = atob(b64), n = bin.length;
  const state = new Uint8Array(n), cat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = bin.charCodeAt(i);
    state[i] = b & 7;
    cat[i] = b >> 4;
  }
  return { state, cat };
}

function init(): void {
  const canvas = document.getElementById('atlas-map') as HTMLCanvasElement | null;
  if (!canvas || !canvas.getContext) return;

  const COLS = 200;
  const NAMES: Record<string, string> = {};
  const chips = Array.from(document.querySelectorAll<HTMLElement>('.at-chip'));
  const capLabel = document.querySelector('.at-cap-label');
  const capDetail = document.querySelector('.at-cap-detail');
  const idleLabel = capLabel ? capLabel.textContent : '';
  const idleDetail = capDetail ? capDetail.textContent : '';

  let data: { state: Uint8Array; cat: Uint8Array } | null = null;
  let cats: string[] = [];
  let max = Number(canvas.getAttribute('data-max')) || 0;
  let filterKey = '';   // category key or '' (resolved to an index at draw time)
  let hover = 0;        // RFC number under mouse/cursor, 0 = none
  let cursor = 1;       // keyboard cursor
  let kbd = false;      // cursor visible
  const shards: Record<number, Promise<Record<string, any>>> = {};

  chips.forEach((c) => { NAMES[c.getAttribute('data-cat') || ''] = c.textContent || ''; });

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function draw(): void {
    if (!data) return;
    const w = canvas!.clientWidth;
    if (!w) return;
    const cell = w / COLS, rows = Math.ceil(max / COLS), h = Math.ceil(rows * cell);
    const gap = Math.max(0.6, cell * 0.14);
    const dpr = window.devicePixelRatio || 1;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    canvas!.style.height = h + 'px';
    const x = canvas!.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const col = {
      feat: css('--accent'), basic: css('--accent-2'), empty: css('--map-empty'),
      featDim: css('--map-feat-dim'), basicDim: css('--map-basic-dim'), line: css('--line-strong'), ink: css('--ink'),
    };
    const size = cell - gap;
    const filterIdx = filterKey ? cats.indexOf(filterKey) : -1;
    x.beginPath();
    for (let n = 1; n <= max; n++) {
      const i = n - 1;
      if (data.state[i] > 1) continue;
      const cx = (i % COLS) * cell, cy = Math.floor(i / COLS) * cell;
      x.moveTo(cx, cy + size);
      x.lineTo(cx + size, cy);
    }
    x.strokeStyle = col.line;
    x.lineWidth = 0.8;
    x.stroke();
    for (let m = 1; m <= max; m++) {
      const j = m - 1, s = data.state[j];
      if (s < 2) continue;
      const dim = filterIdx >= 0 && data.cat[j] !== filterIdx;
      x.fillStyle = s >= 4 ? (dim ? col.featDim : col.feat) : s === 3 ? (dim ? col.basicDim : col.basic) : col.empty;
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
    const b = canvas!.getBoundingClientRect(), cell = b.width / COLS;
    if (!cell) return 0;
    const col = Math.floor((e.clientX - b.left) / cell);
    const n = Math.floor((e.clientY - b.top) / cell) * COLS + col + 1;
    return col >= 0 && col < COLS && n >= 1 && n <= max ? n : 0;
  }

  function shard(n: number): Promise<Record<string, any>> {
    const k = Math.floor((n - 1) / 1000);
    if (!shards[k]) {
      shards[k] = fetch('/data/titles/' + k + '.json').then((r) => {
        if (!r.ok) throw new Error('shard');
        return r.json();
      }).catch(() => { delete shards[k]; return {}; });
    }
    return shards[k];
  }

  function caption(n: number): void {
    if (!capLabel || !capDetail || !data) return;
    if (!n) { capLabel.textContent = idleLabel; capDetail.textContent = idleDetail; return; }
    const i = n - 1, st = data.state[i];
    if (st === 0) { capLabel.textContent = 'RFC ' + n; capDetail.textContent = '— never issued'; return; }
    if (st === 1) { capLabel.textContent = 'RFC ' + n; capDetail.textContent = '— number reserved, not yet published'; return; }
    capLabel.textContent = 'RFC ' + n;
    capDetail.textContent = '— index page: title, authors, status and lineage from the RFC Editor · rfc.akl.run/' + n + '/';
    shard(n).then((sh) => {
      if (hover !== n && !(kbd && cursor === n && !hover)) return;
      const t = sh[String(n)];
      if (!t) return;
      const name = t[0] || t[1];
      const catKey = cats[data!.cat[i]];
      const tier = st >= 4 ? 'deep explainer' : st === 3 ? 'summary page' : 'index page';
      capLabel.textContent = 'RFC ' + n + ' · ' + name;
      if (st >= 3) capDetail.textContent = '— ' + tier + ' · ' + (NAMES[catKey] || catKey || '') + ' · ' + t[2];
      else capDetail.textContent = '— index page: ' + t[1] + ', authors, status and lineage from the RFC Editor · rfc.akl.run/' + n + '/';
    });
  }

  function setHover(n: number): void {
    if (n === hover) return;
    hover = n;
    caption(hover || (kbd ? cursor : 0));
    draw();
  }

  canvas.addEventListener('mousemove', (e) => { kbd = false; setHover(numAt(e)); });
  canvas.addEventListener('mouseleave', () => setHover(0));
  canvas.addEventListener('click', (e) => {
    const n = numAt(e);
    if (n) location.href = '/' + n + '/';
  });
  canvas.addEventListener('focus', () => { kbd = true; caption(cursor); draw(); });
  canvas.addEventListener('blur', () => { kbd = false; caption(0); draw(); });
  canvas.addEventListener('keydown', (e) => {
    const d = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS } as Record<string, number>)[e.key];
    if (d) {
      e.preventDefault();
      kbd = true;
      hover = 0;
      cursor = Math.min(max, Math.max(1, cursor + d));
      caption(cursor);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      location.href = '/' + cursor + '/';
    }
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterKey = chip.getAttribute('data-cat') || '';
      chips.forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
      draw();
    });
  });

  if (window.ResizeObserver) new ResizeObserver(draw).observe(canvas);
  else window.addEventListener('resize', draw);
  window.addEventListener('rfc:theme', draw);

  fetch('/data/coverage.json').then((r) => {
    if (!r.ok) throw new Error('coverage');
    return r.json();
  }).then((c) => {
    max = c.max;
    cats = c.categories;
    data = decode(c.cells);
    draw();
  }).catch(() => {
    if (capDetail) capDetail.textContent = '— map data unavailable; browse by area instead.';
  });
}

if (typeof document !== 'undefined') init();
