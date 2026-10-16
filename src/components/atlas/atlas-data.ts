// Pure view-model helpers for the Atlas home sections (unit-tested in test/atlas.test.ts).
import type { Site } from '../../lib/model';

export const SUGGESTIONS = ['How does email get delivered?', 'Why is the padlock there?', 'TLS 1.3', '2119'];
export const HASH_FORWARDER = "var m=location.hash.match(/^#rfc(\\d+)$/i);if(m)location.replace('/'+(+m[1])+'/');";

export const fmt = (n: number) => Number(n).toLocaleString('en-US');
export const w = (n: number, d: number) => `${d ? ((n / d) * 100).toFixed(2) : '0'}%`;
const covered = (r: any) => r.tier !== 'index';
const featured = (r: any) => r.tier === 'explainer' || r.tier === 'interactive';

export function rfcPath(j: any): number[] {
  const seen: number[] = [];
  for (const s of j.steps || []) for (const r of s.rfcs || []) if (!seen.includes(r.number)) seen.push(r.number);
  return seen;
}

export function journeysModel(site: Site) {
  const list: any[] = site.journeys || [];
  const feat = list.find((j) => j.featured) || list[0];
  const others = list.filter((j) => j !== feat).slice(0, 4);
  return { feat, others };
}

export function areasModel(site: Site) {
  const by = new Map<string, any>(site.categories.map((k) => [k.key, { key: k.key, name: k.name, f: 0, s: 0, ex: [] as string[] }]));
  for (const r of site.rfcs.values()) {
    const a = by.get(r.category);
    if (!a || !covered(r)) continue;
    if (featured(r)) {
      a.f++;
      a.ex.push(r.shortTitle || r.title);
    } else a.s++;
  }
  const list = [...by.values()];
  const maxCov = Math.max(1, ...list.map((a) => a.f + a.s));
  return list.map((a) => ({
    ...a,
    count: a.f + a.s,
    wf: w(a.f, maxCov),
    ws: w(a.s, maxCov),
    examples: a.ex.slice(0, 4).join(' · ') || '—',
  }));
}

export function timelineModel(site: Site) {
  const years = new Map<number, { f: number; b: number; nums: number[] }>();
  let maxYear = 1969;
  for (const r of site.rfcs.values()) {
    if (r.year > maxYear) maxYear = r.year;
    if (!covered(r)) continue;
    const y = years.get(r.year) || { f: 0, b: 0, nums: [] };
    if (featured(r)) y.f++;
    else y.b++;
    y.nums.push(r.number);
    years.set(r.year, y);
  }
  const maxY = Math.max(1, ...[...years.values()].map((y) => y.f + y.b));
  const cols: { tip: string; hb: string; hf: string }[] = [];
  for (let yr = 1969; yr <= maxYear; yr++) {
    const v = years.get(yr) || { f: 0, b: 0, nums: [] };
    const nums = v.nums.sort((a, b) => a - b);
    const tip = `${yr}: ${v.f + v.b} RFCs${nums.length ? ` — ${nums.slice(0, 8).join(', ')}` : ''}`;
    cols.push({ tip, hb: w(v.b, maxY), hf: w(v.f, maxY) });
  }
  return { cols, axis: [1969, 1980, 1990, 2000, 2010, maxYear] };
}
