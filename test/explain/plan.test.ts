import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { aprilFools, tierOf, UNIT_SIZE, writeJson } from '../../scripts/explain/lib';
import { type Candidate, groupUnits, plan } from '../../scripts/explain/plan';
import { type Fixture, makeFixture } from './helpers';

let fx: Fixture;
beforeEach(() => {
  fx = makeFixture();
});
afterEach(() => fx.cleanup());

describe('tiers', () => {
  test('large, compact, full, standard', () => {
    const april = aprilFools(fx.paths);
    const t = (n: number) => tierOf(n, fx.summary, april);
    expect(t(2002)).toBe('large'); // 151 pages
    expect(t(2001)).toBe('full'); // 150 pages is not large
    expect(t(100)).toBe('compact'); // under 5 pages and RFC < 800
    expect(t(768)).toBe('compact'); // RFC < 800
    expect(t(907)).toBe('compact'); // 5 pages
    expect(t(2000)).toBe('compact'); // on the April list although experimental and 30 pages
    expect(t(901)).toBe('full'); // standards track, 20 pages
    expect(t(906)).toBe('full'); // BCP
    expect(t(902)).toBe('standard'); // obsoleted
    expect(t(903)).toBe('standard'); // informational
    expect(t(905)).toBe('standard'); // historic
  });

  test('the curated April list covers the well-known jokes', () => {
    const real = JSON.parse(fs.readFileSync('scripts/explain/april-fools.json', 'utf8')) as { rfcs: { number: number }[] };
    const nums = real.rfcs.map((r) => r.number);
    for (const n of [1149, 2324, 2549, 3514, 7168]) expect(nums).toContain(n);
    expect(new Set(nums).size).toBe(nums.length);
    expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  });
});

const cand = (number: number, tier: Candidate['tier'], priority: number): Candidate => ({
  number,
  tier,
  priority,
  rfc: { number, title: `T${number}`, pages: 10, textPath: `.work/rfc-text/${number}.txt`, contentPath: `content/rfcs/${number}.json` },
});

describe('grouping', () => {
  test('unit sizes per tier, stable ids, priority order', () => {
    const cands: Candidate[] = [];
    for (let i = 0; i < 7; i++) cands.push(cand(100 + i, 'compact', 50 - i));
    for (let i = 0; i < 4; i++) cands.push(cand(200 + i, 'standard', 40 - i));
    for (let i = 0; i < 3; i++) cands.push(cand(300 + i, 'full', 30 - i));
    for (let i = 0; i < 2; i++) cands.push(cand(400 + i, 'large', 20 - i));
    const units = groupUnits(cands);
    // Units are ordered by the priority of their first RFC; sizes follow the tier.
    expect(units.map((u) => [u.id, u.rfcs.length])).toEqual([
      ['compact-100', 6],
      ['compact-106', 1],
      ['standard-200', 3],
      ['standard-203', 1],
      ['full-300', 2],
      ['full-302', 1],
      ['large-400', 1],
      ['large-401', 1],
    ]);
  });

  test('grouping is deterministic and ignores input order', () => {
    const cands = Array.from({ length: 30 }, (_, i) =>
      cand(1000 + i, (['compact', 'standard', 'full'] as const)[i % 3], 100 - Math.floor(i / 2)),
    );
    const a = groupUnits(cands);
    const b = groupUnits([...cands].reverse());
    expect(b).toEqual(a);
    for (const u of a) expect(u.rfcs.length).toBeLessThanOrEqual(UNIT_SIZE[u.tier]);
    expect(a.flatMap((u) => u.rfcs.map((r) => r.number)).sort()).toEqual(cands.map((c) => c.number).sort());
  });
});

describe('plan', () => {
  const priority = (n: number) => n % 7;
  const base = () => plan({ paths: fx.paths, summary: fx.summary, priority, isValid: () => false });

  test('covers RFCs without sections, skipping merged, done and failed', () => {
    fx.writeContent(901, { ...fx.readContent(901), sections: [{ id: 'introduction', title: 'x', content: '<p>x</p>' }] });
    fx.writeOut(903, { any: 'thing' });
    writeJson(fx.paths.failedFile, [{ number: 905, errors: ['x'] }]);
    const q = plan({ paths: fx.paths, summary: fx.summary, priority, isValid: (n) => n === 903 });
    const all = new Set(q.units.flatMap((u) => u.rfcs.map((r) => r.number)));
    expect(all.has(901)).toBe(false); // merged
    expect(all.has(903)).toBe(false); // valid output
    expect(all.has(905)).toBe(false); // failed
    expect(all.has(768)).toBe(true);
    expect(q.skipped).toEqual({ merged: 1, done: 1, failed: 1 });
    expect(q.counts.total.rfcs).toBe(fx.summary.issued.length - 3);
    const retry = plan({ paths: fx.paths, summary: fx.summary, priority, isValid: (n) => n === 903, retryFailed: true });
    expect(retry.units.flatMap((u) => u.rfcs).some((r) => r.number === 905)).toBe(true);
  });

  test('an invalid output file does not count as done', () => {
    fx.writeOut(903, { not: 'valid' });
    const q = plan({ paths: fx.paths, summary: fx.summary, priority });
    expect(q.units.flatMap((u) => u.rfcs).some((r) => r.number === 903)).toBe(true);
  });

  test('unit entries carry paths, pages and tier; PDF-only RFCs point at the pdf', () => {
    const q = base();
    const u768 = q.units.find((u) => u.rfcs.some((r) => r.number === 768));
    expect(u768?.tier).toBe('compact');
    expect(u768?.rfcs.find((r) => r.number === 768)).toMatchObject({
      number: 768,
      pages: 3,
      textPath: '.work/rfc-text/768.txt',
      contentPath: 'content/rfcs/768.json',
    });
    for (const u of q.units) expect(u.rfcs.length).toBeLessThanOrEqual(UNIT_SIZE[u.tier]);
    expect(q.units.find((u) => u.rfcs.some((r) => r.number === 2000))?.rfcs.find((r) => r.number === 2000)?.aprilFools).toBe(true);
  });

  test('reruns are stable', () => {
    expect(base()).toEqual(base());
  });
});
