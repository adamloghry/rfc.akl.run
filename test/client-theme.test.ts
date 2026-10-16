// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { init } from '../src/scripts/theme';
import { click, el, fixture, key, mount, resetDocument } from './dom-helpers';

let dispose: () => void = () => {};
beforeEach(() => {
  resetDocument();
  mount(fixture('rfc-903.html'));
});
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});

test('toggle flips data-theme, persists it and announces rfc:theme', () => {
  const seen: string[] = [];
  const onTheme = (e: Event) => seen.push((e as CustomEvent<string>).detail);
  window.addEventListener('rfc:theme', onTheme);
  dispose = init();
  const btn = el('.theme-toggle');
  click(btn);
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(localStorage.getItem('rfc-theme')).toBe('dark');
  click(btn);
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(localStorage.getItem('rfc-theme')).toBe('light');
  expect(seen).toEqual(['dark', 'light']);
  window.removeEventListener('rfc:theme', onTheme);
});

test('an existing data-theme (set by the pre-paint script) is the starting point', () => {
  document.documentElement.setAttribute('data-theme', 'dark');
  dispose = init();
  click(el('.theme-toggle'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

test('toggling still works when localStorage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  dispose = init();
  click(el('.theme-toggle'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

test('"/" focuses and selects the search input', () => {
  dispose = init();
  const input = el<HTMLInputElement>('.search-input');
  input.value = 'abc';
  const select = vi.spyOn(input, 'select');
  const e = key(document.body, '/');
  expect(e.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(input);
  expect(select).toHaveBeenCalled();
});

test('"/" is left alone while typing, with modifiers, for other keys, or without a search box', () => {
  dispose = init();
  const input = el<HTMLInputElement>('.search-input');
  const area = document.createElement('textarea');
  const sel = document.createElement('select');
  const editable = document.createElement('div');
  Object.defineProperty(editable, 'isContentEditable', { value: true });
  document.body.append(area, sel, editable);
  for (const t of [input, area, sel, editable]) expect(key(t, '/').defaultPrevented).toBe(false);
  for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }])
    expect(key(document.body, '/', mod).defaultPrevented).toBe(false);
  expect(key(document.body, 'a').defaultPrevented).toBe(false);
  input.remove();
  expect(key(document.body, '/').defaultPrevented).toBe(false);
});

// (The module's own import-time init also listens for "/" on the shared document, so only the button is asserted.)
test('dispose detaches the toggle buttons', () => {
  dispose = init();
  dispose();
  click(el('.theme-toggle'));
  expect(document.documentElement.getAttribute('data-theme')).toBeNull();
});

test('init can be scoped to a subtree', () => {
  const root = document.createElement('div');
  root.innerHTML = '<button class="theme-toggle"></button>';
  document.body.append(root);
  dispose = init(root);
  click(el('.theme-toggle', root));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});
