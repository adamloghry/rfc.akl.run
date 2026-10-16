import assert from 'node:assert/strict';
import { test } from 'vitest';
import { displayTitle } from '../src/lib/display-title';

test('drops the prefix when the title already contains the short name (RFC 2026)', () => {
  assert.equal(
    displayTitle('Internet Standards Process', 'The Internet Standards Process -- Revision 3'),
    'The Internet Standards Process -- Revision 3',
  );
});

test('keeps "short: title" when the title does not contain it (RFC 903)', () => {
  assert.equal(displayTitle('RARP', 'A Reverse Address Resolution Protocol'), 'RARP: A Reverse Address Resolution Protocol');
});

test('drops the prefix when the title starts with the short name', () => {
  assert.equal(displayTitle('Telnet', 'Telnet Protocol Specification'), 'Telnet Protocol Specification');
});

test('drops the prefix for an acronym already in the title', () => {
  assert.equal(displayTitle('TCP', 'Transmission Control Protocol (TCP)'), 'Transmission Control Protocol (TCP)');
});

test('matches whole words only, and handles missing short titles', () => {
  assert.equal(displayTitle('IP', 'Skip Protocol'), 'IP: Skip Protocol');
  assert.equal(displayTitle(null, 'Plain'), 'Plain');
  assert.equal(displayTitle('Same', 'Same'), 'Same');
});
