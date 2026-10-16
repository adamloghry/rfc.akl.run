import { expect, test } from 'vitest';
import { rfcSchema } from '../src/lib/schemas';

const base = { number: 903, title: 'RARP', summary: '<p>x</p>' };

test('provenance accepts promptVersion and schemaVersion', () => {
  const prov = {
    source: 'llm-draft',
    model: 'claude-sonnet-5-5',
    drafted: '2026-10-16',
    reviewedBy: null,
    promptVersion: 'p3',
    schemaVersion: '1',
  };
  const r = rfcSchema.safeParse({ ...base, provenance: prov });
  expect(r.success).toBe(true);
  expect(r.data?.provenance).toEqual(prov);
});

test('both new provenance fields are optional, and unknown keys are still rejected', () => {
  expect(rfcSchema.safeParse({ ...base, provenance: { source: 'human' } }).success).toBe(true);
  expect(rfcSchema.safeParse({ ...base, provenance: { source: 'human', promptVersion: 3 } }).success).toBe(false);
  expect(rfcSchema.safeParse({ ...base, provenance: { source: 'human', extra: 1 } }).success).toBe(false);
});
