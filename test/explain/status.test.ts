import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { writeJson } from '../../scripts/explain/lib';
import { plan } from '../../scripts/explain/plan';
import { format, status } from '../../scripts/explain/status';
import { type Fixture, makeFixture, validOutput } from './helpers';

let fx: Fixture;
beforeEach(() => {
  fx = makeFixture();
});
afterEach(() => fx.cleanup());

describe('status', () => {
  test('counts per tier and text mirror completeness', () => {
    // 901 (full): explained before this pipeline. 902 (standard): merged by it. 768 (compact): valid output. 900 (compact): invalid output. 903: failed.
    fx.writeContent(901, { ...fx.readContent(901), sections: [{ id: 'introduction', title: 'x', content: '<p>x</p>' }] });
    fx.writeContent(902, {
      ...fx.readContent(902),
      sections: [{ id: 'introduction', title: 'x', content: '<p>x</p>' }],
      provenance: { source: 'llm-draft', promptVersion: 'explain-v1' },
    });
    fx.writeOut(768, validOutput());
    fx.writeOut(900, { nope: true });
    writeJson(fx.paths.failedFile, [{ number: 903 }]);
    fs.writeFileSync(path.join(fx.paths.textDir, '768.txt'), 'x');
    const queue = plan({ paths: fx.paths, summary: fx.summary, priority: (n) => n, isValid: (n) => n === 768 });
    writeJson(fx.paths.queueFile, queue);

    const s = status({ paths: fx.paths, summary: fx.summary });
    expect(s.tiers.full).toMatchObject({ total: 3, existing: 1, remaining: 2 }); // 901 explained; 906 and 2001 remain
    expect(s.tiers.standard).toMatchObject({ merged: 1, failed: 1 });
    expect(s.tiers.compact).toMatchObject({ done: 1, invalid: 1 });
    expect(s.totals.total).toBe(fx.summary.issued.length);
    expect(s.totals.existing + s.totals.merged + s.totals.done + s.totals.invalid + s.totals.failed + s.totals.remaining).toBe(
      s.totals.total,
    );
    expect(s.text.present).toBe(1);
    expect(s.text.wanted).toBe(fx.summary.issued.length - 2);
    expect(s.nextUnits.length).toBeGreaterThan(0);
    expect(s.nextUnits.join(' ')).not.toContain('768'); // done
    const out = format(s);
    expect(out).toContain('tier');
    expect(out).toContain('text mirror: 1/');
  });
});
