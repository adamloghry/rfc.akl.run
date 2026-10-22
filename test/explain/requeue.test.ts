import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { writeJson } from '../../scripts/explain/lib';
import { findMissing } from '../../scripts/explain/requeue';
import { type Fixture, makeFixture, validOutput } from './helpers';

let fx: Fixture;
let batchesDir: string;

beforeEach(() => {
  fx = makeFixture();
  batchesDir = path.join(fx.root, '.work', 'explain', 'batches');
  fs.mkdirSync(batchesDir, { recursive: true });
});
afterEach(() => fx.cleanup());

const unit = (id: string, numbers: number[]) => ({
  id,
  tier: 'full',
  rfcs: numbers.map((n) => ({ number: n, title: `RFC ${n}`, pages: 1, textPath: '', contentPath: '' })),
});

describe('requeue', () => {
  test('finds the RFCs a wave left without a usable output', () => {
    writeJson(path.join(batchesDir, 'w1.json'), [unit('full-1', [760, 761]), unit('full-2', [768])]);
    // 760: merged already; 761: a valid output waiting for the merge; 768: nothing.
    fx.writeContent(760, {
      ...fx.readContent(760),
      sections: [{ id: 'introduction', title: 'x', content: '<p>x</p>' }],
      provenance: { source: 'llm-draft', promptVersion: 'explain-v2' },
    });
    fx.writeOut(761, validOutput());

    const report = findMissing(
      batchesDir,
      (n) => n === 760,
      (n) => n === 761,
    );
    expect(report.batches).toEqual(['w1.json']);
    expect(report.missing).toEqual([768]);
  });

  test('an unreadable batch file is skipped, not fatal', () => {
    fs.writeFileSync(path.join(batchesDir, 'broken.json'), '{nope');
    writeJson(path.join(batchesDir, 'w1.json'), [unit('full-1', [768])]);
    const report = findMissing(
      batchesDir,
      () => false,
      () => false,
    );
    expect(report.batches).toEqual(['w1.json']);
    expect(report.missing).toEqual([768]);
  });

  test('no batch directory means nothing to redo', () => {
    const report = findMissing(
      path.join(fx.root, 'nowhere'),
      () => false,
      () => false,
    );
    expect(report.batches).toEqual([]);
    expect(report.missing).toEqual([]);
  });
});
