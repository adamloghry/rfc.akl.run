'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRfcNumber, tally } = require('../scripts/fetch-demand');

test('parseRfcNumber: common title shapes', () => {
  assert.equal(parseRfcNumber('Please explain RFC 903'), 903);
  assert.equal(parseRfcNumber('rfc0903'), 903);
  assert.equal(parseRfcNumber('RFC-903: RARP'), 903);
  assert.equal(parseRfcNumber('Explainer request: RFC 9110 (HTTP semantics)'), 9110);
  assert.equal(parseRfcNumber('rfc   42'), 42);
});

test('parseRfcNumber: no number, junk and out-of-range', () => {
  assert.equal(parseRfcNumber('Explain DNS'), null);
  assert.equal(parseRfcNumber(''), null);
  assert.equal(parseRfcNumber(undefined), null);
  assert.equal(parseRfcNumber('RFC 123456'), null); // more than 5 digits
  assert.equal(parseRfcNumber('RFC 0'), 0); // caller filters falsy numbers
  assert.equal(parseRfcNumber('xRFC 5'), null);
});

test('tally: weight is reactions + 1, summed per RFC; PRs and unparsable titles skipped', () => {
  const issues = [
    { title: 'RFC 903', reactions: { total_count: 2 } },
    { title: 'Please explain rfc903', reactions: { total_count: 0 } },
    { title: 'RFC 826' },
    { title: 'RFC 1', pull_request: {}, reactions: { total_count: 9 } },
    { title: 'no number here', reactions: { total_count: 5 } },
    { title: 'RFC 0', reactions: { total_count: 5 } },
  ];
  assert.deepEqual(tally(issues), { 903: 4, 826: 1 });
  assert.deepEqual(tally([]), {});
});
