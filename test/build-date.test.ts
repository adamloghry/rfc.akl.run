import assert from 'node:assert/strict';
import { test } from 'vitest';
import { resolveBuildDate } from '../src/lib/build-date';

const NOW = new Date('2030-01-02T03:04:05Z');
const now = () => NOW;

test('falls back to the current time when nothing is pinned', () => {
  assert.equal(resolveBuildDate({}, now), NOW);
  assert.equal(resolveBuildDate({ RFC_BUILD_DATE: '', SOURCE_DATE_EPOCH: '  ' }, now), NOW);
});

test('RFC_BUILD_DATE accepts an ISO date or timestamp', () => {
  assert.equal(resolveBuildDate({ RFC_BUILD_DATE: '2026-10-15' }, now).toISOString(), '2026-10-15T00:00:00.000Z');
  assert.equal(resolveBuildDate({ RFC_BUILD_DATE: ' 2026-10-15T12:30:00Z ' }, now).toISOString(), '2026-10-15T12:30:00.000Z');
});

test('SOURCE_DATE_EPOCH is seconds since the epoch', () => {
  assert.equal(resolveBuildDate({ SOURCE_DATE_EPOCH: '1760486400' }, now).toISOString(), '2025-10-15T00:00:00.000Z');
  assert.equal(resolveBuildDate({ SOURCE_DATE_EPOCH: '0' }, now).getTime(), 0);
});

test('RFC_BUILD_DATE wins over SOURCE_DATE_EPOCH', () => {
  const d = resolveBuildDate({ RFC_BUILD_DATE: '2026-01-01', SOURCE_DATE_EPOCH: '1760486400' }, now);
  assert.equal(d.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('malformed values fail loudly instead of using the wall clock', () => {
  assert.throws(() => resolveBuildDate({ RFC_BUILD_DATE: 'yesterday' }, now), /RFC_BUILD_DATE/);
  assert.throws(() => resolveBuildDate({ SOURCE_DATE_EPOCH: '12.5' }, now), /SOURCE_DATE_EPOCH/);
  assert.throws(() => resolveBuildDate({ SOURCE_DATE_EPOCH: '-5' }, now), /SOURCE_DATE_EPOCH/);
});

test('defaults to process.env and the system clock', () => {
  const before = Date.now();
  const saved = { a: process.env.RFC_BUILD_DATE, b: process.env.SOURCE_DATE_EPOCH };
  delete process.env.RFC_BUILD_DATE;
  delete process.env.SOURCE_DATE_EPOCH;
  try {
    const t = resolveBuildDate().getTime();
    assert.ok(t >= before && t <= Date.now());
  } finally {
    if (saved.a !== undefined) process.env.RFC_BUILD_DATE = saved.a;
    if (saved.b !== undefined) process.env.SOURCE_DATE_EPOCH = saved.b;
  }
});
