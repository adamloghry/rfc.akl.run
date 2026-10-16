import { test, expect } from 'vitest';
import { parseNumber, matchQuestions } from '../src/scripts/search-core';

test('questions need every word >= 3 chars to match; numbers parse', () => {
  const qs = [
    { q: 'how does email get delivered', href: '/journeys/email/', label: 'JOURNEY', title: 'Email' },
    { q: 'why is the padlock there', href: '/journeys/padlock/', label: 'JOURNEY', title: 'Padlock' },
  ];
  expect(matchQuestions('email delivered', qs).length).toBe(1);
  expect(matchQuestions('email padlock', qs).length).toBe(0);
  expect(matchQuestions('is', qs).length).toBe(0);
  expect(matchQuestions('PADLOCK', qs)[0].href).toBe('/journeys/padlock/');
  expect(parseNumber('903', 10065)).toBe(903);
  expect(parseNumber('0903', 10065)).toBe(903);
  expect(parseNumber('10066', 10065)).toBe(null);
  expect(parseNumber('tcp', 10065)).toBe(null);
  expect(parseNumber('0', 10065)).toBe(null);
});
