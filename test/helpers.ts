import assert from 'node:assert/strict';

/** Narrow `T | undefined` (Map.get, find, ...) with a failing assertion instead of a non-null `!`. */
export function must<T>(value: T | null | undefined, what = 'value'): T {
  assert.ok(value !== undefined && value !== null, `expected ${what} to be present`);
  return value;
}
