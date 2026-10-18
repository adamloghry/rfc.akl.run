import { describe, expect, test } from 'vitest';
import { sitemapUrls } from '../src/lib/data-files';
import { buildGlossaryModel, glossaryForwarder, glossaryModel, letterKey, USED_IN_MAX } from '../src/lib/glossary';
import { buildSite } from '../src/lib/model';
import { entry, indexOf } from './builders';
import { must } from './helpers';

const t = (id: string, term: string, extra: Record<string, unknown> = {}) => ({
  id,
  term,
  definition: `<p>${term} defined.</p>`,
  rfcs: [],
  usedBy: [],
  ...extra,
});

describe('glossary model', () => {
  test('letterKey: letters (case and diacritics folded), everything else is 0-9', () => {
    expect(['MAC address', 'ünicast', '  dhcp', '6to4', '(x)', '/dns', ''].map(letterKey)).toEqual([
      'm',
      'u',
      'd',
      '0-9',
      '0-9',
      '0-9',
      '0-9',
    ]);
  });

  test('pages per letter, sorted; letters list is A-Z then 0-9 with counts', () => {
    const m = buildGlossaryModel([t('b2', 'Beta'), t('a1', 'alpha'), t('b1', 'Bravo'), t('six', '6to4')]);
    expect(m.letters.map((l) => l.key)).toEqual([...'abcdefghijklmnopqrstuvwxyz', '0-9']);
    expect(m.letters.filter((l) => l.count).map((l) => [l.key, l.count])).toEqual([
      ['a', 1],
      ['b', 2],
      ['0-9', 1],
    ]);
    expect(m.pages.map((p) => p.slug)).toEqual(['a', 'b', '0-9']);
    expect(must(m.pages[1]).entries.map((e) => e.term)).toEqual(['Beta', 'Bravo']);
    expect(m.hrefs.get('six')).toBe('/glossary/0-9#six');
    expect(m.hrefs.get('b1')).toBe('/glossary/b#b1');
    expect(m.total).toBe(4);
  });

  test('a letter over the page cap continues on <letter>-2; exceptions list ids off their default page', () => {
    const terms = Array.from({ length: 5 }, (_, i) => t(`s${i}`, `S${i}`));
    const m = buildGlossaryModel([...terms, t('zone', 'Dns zone'), t('x', '3 x')], 2);
    expect(m.pages.filter((p) => p.key === 's').map((p) => [p.slug, p.part, p.parts, p.entries.length])).toEqual([
      ['s', 1, 3, 2],
      ['s-2', 2, 3, 2],
      ['s-3', 3, 3, 1],
    ]);
    expect(m.hrefs.get('s4')).toBe('/glossary/s-3#s4');
    expect(m.exceptions).toEqual({ s2: 's-2', s3: 's-2', s4: 's-3', zone: 'd', x: '0-9' });
  });

  test('"used in" is capped and the rest counted', () => {
    const many = Array.from({ length: USED_IN_MAX + 10 }, (_, i) => i + 1);
    const e = must(buildGlossaryModel([t('a', 'A', { rfcs: [1, 2], usedBy: many })]).pages[0]).entries[0];
    expect(e?.used).toHaveLength(USED_IN_MAX);
    expect(e?.more).toBe(10);
  });

  test('glossaryModel is cached per site and the sitemap lists every letter page', () => {
    const site = buildSite({
      index: indexOf([entry(1)]),
      contentDir: 'no-such-dir',
      rfcs: [],
      journeys: [],
      glossary: [t('arp', 'ARP'), t('mac', 'MAC')],
    });
    expect(glossaryModel(site)).toBe(glossaryModel(site));
    const urls = sitemapUrls(site);
    expect(urls).toContain('/glossary');
    expect(urls).toContain('/glossary/a');
    expect(urls).toContain('/glossary/m');
    expect(urls).not.toContain('/glossary/b');
  });
});

describe('legacy #id forwarder', () => {
  const run = (hash: string, exceptions: Record<string, string> = {}) => {
    let to = '';
    new Function('location', glossaryForwarder(exceptions))({ hash, replace: (u: string) => (to = u) });
    return to;
  };
  test('forwards ids by first character, exceptions by map, and #letter-X anchors', () => {
    expect(run('#mac-address')).toBe('/glossary/m#mac-address');
    expect(run('#6to4')).toBe('/glossary/0-9#6to4');
    expect(run('#dns-zone', { 'dns-zone': 'z' })).toBe('/glossary/z#dns-zone');
    expect(run('#letter-M')).toBe('/glossary/m');
    expect(run('#letter-#')).toBe('/glossary/0-9');
  });
  test('does nothing without a hash, and never throws on a malformed one', () => {
    expect(run('')).toBe('');
    expect(run('#%E0%A4%A')).toBe('');
  });
  test('the embedded map cannot close the script element', () => {
    expect(glossaryForwarder({ '</script>': 'a' })).not.toContain('</script>');
  });
});
