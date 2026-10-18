import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectHeadings, escapeText, isPageHeader, normalizeRfcText, parseRfcFile, readRfcFile, renderRfcText } from '../src/lib/rfc-text';

const raw = (n: number) => fs.readFileSync(path.join('data', 'rfc-text', `${n}.txt`), 'utf8');
const prepared = (n: number) => normalizeRfcText(parseRfcFile(raw(n)).body);
const all = () => true;
const render = (text: string, o: Partial<Parameters<typeof renderRfcText>[1]> = {}) => renderRfcText(text, { self: 0, issued: all, ...o });
/** Rendered HTML back to its text: tags removed, entities decoded. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const lines = (s: string) => s.split('\n');

describe('parseRfcFile / readRfcFile', () => {
  it('splits the PDF conversion marker off', () => {
    const f = parseRfcFile(raw(8));
    expect(f.note).toMatch(/^converted from the RFC Editor's PDF edition/);
    expect(f.body.startsWith('[rfc.akl.run')).toBe(false);
    expect(parseRfcFile(raw(903)).note).toBeNull();
  });
  it('reads data/rfc-text and returns null for a missing file', () => {
    expect(readRfcFile(903)?.body).toContain('Reverse Address Resolution');
    expect(readRfcFile(999999)).toBeNull();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-'));
    fs.writeFileSync(path.join(dir, '7.txt'), 'hello\n');
    expect(readRfcFile(7, dir)).toEqual({ note: null, body: 'hello\n' });
  });
});

describe('normalizeRfcText on real RFCs', () => {
  it.each([903, 9293, 791, 2616, 8])('RFC %i: no page-break noise left', (n) => {
    const t = prepared(n);
    expect(t).not.toContain('\f');
    expect(t).not.toMatch(/\[Page [0-9ivx]+\]/);
    if (n === 903 || n === 9293 || n === 2616) expect(t).not.toMatch(/\n\n\n\n\n/); // padding around page breaks is gone
    expect(t.endsWith('\n')).toBe(true);
    expect(t.endsWith('\n\n')).toBe(false);
  });

  it('RFC 903: running header and footer lines are gone, the text around them is not', () => {
    const t = prepared(903);
    expect(t).not.toMatch(/^RFC 903 +June 1984$/m);
    expect(t).not.toMatch(/^Finlayson, Mann, Mogul, Theimer +\[Page \d+\]$/m);
    // a sentence that straddled a page break is joined directly
    expect(t).toContain(
      "   Note that the requirement that ar$spa in opcode 4 packets be filled\n   in with the responder's protocol is purely for convenience.",
    );
    // the title block on page 1 keeps its own (non-running) header
    expect(t).toMatch(/^Network Working Group +Finlayson, Mann, Mogul, Theimer$/m);
  });

  it('RFC 9293: running header and footer removed', () => {
    const t = prepared(9293);
    expect(t).not.toMatch(/^RFC 9293 +TCP +August 2022$/m);
    expect(t).not.toMatch(/^Eddy +Standards Track +\[Page \d+\]$/m);
    expect(t).toContain('Table of Contents');
  });

  it('RFC 791: two-line running header and roman page numbers are removed', () => {
    const t = prepared(791);
    expect(t).not.toMatch(/\[Page/);
    expect(t.match(/^ *Internet Protocol$/gm)?.length ?? 0).toBeLessThan(2);
    expect(t.match(/^ +September 1981$/gm)?.length ?? 0).toBeLessThan(3); // the cover page's own date may stay
  });

  it('keeps ASCII diagrams exactly (RFC 791 header layout)', () => {
    const t = prepared(791);
    const src = raw(791);
    const block = [
      '   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+',
      '   |Version|  IHL  |Type of Service|          Total Length         |',
    ].join('\n');
    expect(src).toContain(block);
    expect(t).toContain(block);
    // rendering keeps it too (only matched text is wrapped, never re-flowed)
    const html = render(t).html;
    expect(textOf(html)).toContain(block);
  });

  it('is faithful: rendered text equals the normalized text', () => {
    for (const n of [903, 9293, 791, 8]) {
      const t = prepared(n);
      expect(textOf(render(t, { self: n }).html)).toBe(t);
    }
  });
});

describe('normalizeRfcText on synthetic input', () => {
  const page = (body: string[], foot: string) => [...body, '', '', foot].join('\n');
  it('keeps a blank line when the page ended a paragraph, joins mid-sentence breaks', () => {
    const a = `${page(['   First paragraph ends here.'], 'Smith   [Page 1]')}\n\f\nRFC 1   Title   May 1999\n\n   Second paragraph.\n`;
    expect(normalizeRfcText(a)).toBe('   First paragraph ends here.\n\n   Second paragraph.\n');
    const b = `${page(['   continues across the'], 'Smith   [Page 1]')}\n\f\nRFC 1   Title   May 1999\n\n   page break.\n`;
    expect(normalizeRfcText(b)).toBe('   continues across the\n   page break.\n');
    const c = `${page(['           deep indent'], 'Smith   [Page 1]')}\n\f\nRFC 1   Title   May 1999\n\n   shallow.\n`;
    expect(normalizeRfcText(c)).toBe('           deep indent\n\n   shallow.\n');
  });
  it('removes the footer of the last page and trailing blank lines, strips trailing spaces and control chars', () => {
    expect(normalizeRfcText('   text  \r\n\r\n\r\nSmith   [Page 2]\r\n\f\r\n')).toBe('   text\n');
    expect(normalizeRfcText('a\u0000b\n')).toBe('ab\n');
    expect(normalizeRfcText('\n\n   x\n')).toBe('   x\n');
  });
  it('trusts dashed or bare page numbers only when consistent', () => {
    const doc = (f: string) => `   one ends.\n${f}\f\n   two ends.\n${f}\f\n   three ends.\n${f}\f\n   four.\n`;
    expect(normalizeRfcText(doc('\n- 2 -\n'))).toBe('   one ends.\n\n   two ends.\n\n   three ends.\n\n   four.\n');
    expect(normalizeRfcText(doc('\n  7\n'))).toBe('   one ends.\n\n   two ends.\n\n   three ends.\n\n   four.\n');
    // a single stray number at a page end is real text
    expect(normalizeRfcText('   a.\n42\n\f\n   b.\n')).toBe('   a.\n42\n\n   b.\n');
  });
  it('drops empty pages and handles a form feed on the header line', () => {
    expect(normalizeRfcText('   a.\n\f\n\n\f\nRFC 5   T   May 1999\n   b.\n')).toBe('   a.\n\n   b.\n');
    expect(normalizeRfcText('   a.\n\fRFC 1131   Title   June 1989\n   b.\n')).toBe('   a.\n\n   b.\n');
  });
  it('recognizes running headers, not prose', () => {
    expect(isPageHeader('RFC 903                        June 1984')).toBe(true);
    expect(isPageHeader('September 1981')).toBe(true);
    expect(isPageHeader('Internet-Draft     Foo     March 2020')).toBe(true);
    expect(isPageHeader('RFC-1119          Network Time           Sep 1989')).toBe(true);
    expect(isPageHeader('   This text mentions RFC 903 in June 1984.')).toBe(false);
    expect(isPageHeader('')).toBe(false);
    expect(isPageHeader(`RFC 1   ${'x'.repeat(120)}   1999`)).toBe(false);
  });
  it('a two-line header (date then title) is removed together', () => {
    const t = '   a.\n\n   [Page 1]\n\f\n   September 1981\nInternet Protocol\n\n   b.\n';
    expect(normalizeRfcText(t)).toBe('   a.\n\n   b.\n');
  });
});

describe('detectHeadings', () => {
  const ids = (t: string) => detectHeadings(lines(t)).map((h) => h.id);
  it('RFC 9293: numbered, nested and unnumbered headings', () => {
    const hs = detectHeadings(lines(prepared(9293)));
    const byId = new Map(hs.map((h) => [h.id, h]));
    expect(byId.get('section-3.2')).toMatchObject({ label: '3.2', title: 'Specific Option Definitions', depth: 2 });
    expect(byId.get('section-3.8.6.2.1')?.depth).toBe(5);
    expect(byId.get('section-abstract')).toMatchObject({ label: '', title: 'Abstract', depth: 1 });
    expect(hs.filter((h) => h.id === 'section-1')).toHaveLength(1);
  });
  it('RFC 791: centered top-level headings and "1.1." sub-headings; appendices', () => {
    const got = ids(prepared(791));
    expect(got).toEqual(expect.arrayContaining(['section-1', 'section-1.1', 'section-3.3', 'appendix-a', 'appendix-b']));
    expect(got.indexOf('section-1')).toBeLessThan(got.indexOf('section-1.1'));
  });
  it('RFC 903: roman numerals, unnumbered, appendix', () => {
    expect(ids(prepared(903))).toEqual([
      'section-status-of-this-memo',
      'section-i',
      'section-ii',
      'section-iii',
      'section-iv',
      'appendix-a',
    ]);
  });
  it('an RFC with "Appendix A." and "A.1." headings', () => {
    const t = [
      'x',
      '',
      '1.  Intro',
      '',
      '   x',
      '',
      'Appendix A.  Examples',
      '',
      '   y',
      '',
      'A.1.  First example',
      '',
      '   z',
      '',
      'Appendix B.',
      '',
      'B.  Notes',
      '',
    ].join('\n');
    const hs = detectHeadings(lines(t));
    expect(hs.map((h) => h.id)).toEqual(['section-1', 'appendix-a', 'appendix-a.1', 'appendix-b']);
    expect(hs[1]).toMatchObject({ label: 'Appendix A', title: 'Examples', depth: 1 });
    expect(hs[2]).toMatchObject({ label: 'A.1', depth: 2 });
    expect(hs[3]?.title).toBe('Appendix B');
    // bare "A.  Title" after the numbered sections starts an appendix
    expect(ids('x\n\n1.  Intro\n\n   x\n\nA.  Extras\n\n   y\n')).toEqual(['section-1', 'appendix-a']);
    // ... but not without any numbered section, and "A.1." needs its appendix
    expect(ids('A.  Extras\n\n   y\n\nA.1.  Sub\n')).toEqual([]);
  });
  it('rejects table-of-contents lines, prose, jumps and duplicates', () => {
    expect(ids('x\n\n1.  Introduction ........... 3\n')).toEqual([]);
    expect(ids('x\n\n2. . . . ....\n')).toEqual([]);
    expect(ids('x\n\n1.  Introduction   3\n')).toEqual([]);
    expect(ids('x\n\n3 Mbit/s is the rate here\n')).toEqual([]);
    expect(ids('x\n\n1.  Sentence that ends.\n')).toEqual([]);
    expect(ids('x\n\n42.  Far ahead\n')).toEqual([]);
    expect(ids('x\n   1.  Indented\n')).toEqual([]);
    expect(ids('x\n\n1.  Twice\n\n   y\n\n1.  Twice again\n')).toEqual(['section-1']);
    expect(ids('x\n\nAppendix A.  Contents ........ 4\n')).toEqual([]);
    expect(ids('x\n\n1.  Intro\n\nA.  Foo ..... 3\n')).toEqual(['section-1']);
    expect(ids('x\n\nI.  Intro, and more.\n')).toEqual([]);
    expect(ids(`x\n\n${'y'.repeat(200)}`)).toEqual([]);
  });
  it('flush-left documents need a blank line after a heading', () => {
    expect(ids('x\n\n1.  Heading\nbody text at column zero\nmore text\nmore text\n')).toEqual([]);
    expect(ids('x\n\n1.  Heading\n\nbody text at column zero\nmore text\n')).toEqual(['section-1']);
    expect(detectHeadings([])).toEqual([]);
  });
  it('known unnumbered headings, with or without a colon', () => {
    expect(ids("x\n\nAbstract\n\n   y\n\nAuthors' Addresses\n\n   z\n\nSecurity Considerations:\n")).toEqual([
      'section-abstract',
      'section-authors-addresses',
      'section-security-considerations',
    ]);
  });
  it('centered headings', () => {
    expect(
      ids(
        'x\n\n                            1.  INTRODUCTION\n\n   y\n\n                            2.  OVERVIEW\n\n                            99.  FAR AHEAD\n\n',
      ),
    ).toEqual(['section-1', 'section-2']);
  });
});

describe('renderRfcText', () => {
  it('headings get id, role, permalink and exact text', () => {
    const { html, headings } = render('x\n\n3.2.  Packet Format\n\n   body\n');
    expect(headings.map((h) => h.id)).toEqual(['section-3.2']);
    expect(html).toContain(
      '<span class="rt-h" id="section-3.2" role="heading" aria-level="4"><a class="rt-perma" href="#section-3.2" aria-label="Permalink to section 3.2"></a>3.2.  Packet Format</span>',
    );
    const ap = render('x\n\nAppendix A.  Foo\n\nAbstract\n').html;
    expect(ap).toContain('aria-label="Permalink to Appendix A"');
    expect(ap).toContain('aria-label="Permalink to Abstract"');
  });
  it('links issued RFC mentions and leaves the rest alone', () => {
    const html = render('   see RFC 793 and [RFC2119], RFC 99999, RFC 0, RFC 12', { self: 12, issued: (n) => n < 5000 }).html;
    expect(html).toContain('<a href="/rfc793">RFC 793</a>');
    expect(html).toContain('[<a href="/rfc2119">RFC2119</a>]');
    expect(html).not.toContain('/rfc99999');
    expect(html).not.toContain('/rfc12"'); // itself
    expect(html).not.toContain('/rfc0');
    expect(html).not.toContain('xRFC');
    expect(render('xRFC 793').html).not.toContain('<a');
  });
  it('does not link RFC numbers that were not issued (real RFC 903 text with a stub index)', () => {
    const html = render(prepared(9293), { self: 9293, issued: (n) => n === 793 }).html;
    expect(html).toContain('<a href="/rfc793">RFC 793</a>');
    expect(html).not.toContain('<a href="/rfc3168"');
  });
  it('links Section references to existing headings in the same document only', () => {
    const t = [
      '1.  Intro',
      '',
      '   See Section 3.2 and Appendix A, Section 9, section 3.2.',
      '   See Section 3.2 of RFC 793; Section 3.2 of [RFC793]; Section 3.2 of',
      '   [RFC793] too; RFC 793, Section 3.2; [X], Section 3.2.',
      '   Section 3.2 of this document, Section 3.2 of the RFC 5.',
      '',
      '3.2.  Part',
      '',
      '   z',
      '',
      'Appendix A.  App',
      '',
    ].join('\n');
    const html = render(t, { self: 1, issued: () => false }).html;
    const links = [...html.matchAll(/<a href="(#[^"]+)">([^<]+)<\/a>/g)]
      .filter((m) => !(m[1] ?? '').startsWith('#section-3.2"') && !/rt-perma/.test(m[0]))
      .map((m) => `${m[1]}|${m[2]}`);
    expect(links.filter((l) => l.includes('Section') || l.includes('section') || l.includes('Appendix'))).toEqual([
      '#section-3.2|Section 3.2',
      '#appendix-a|Appendix A',
      '#section-3.2|section 3.2',
      '#section-3.2|Section 3.2 of this document'.replace(' of this document', ''),
    ]);
    expect(html).not.toContain('href="#section-9"');
  });
  it('escapes markup in the text and never changes column positions', () => {
    const line = '   <tag> & RFC 793 | x';
    const { html } = render(`${line}\n`, { issued: all });
    expect(html).toContain('&lt;tag&gt; &amp; <a href="/rfc793">RFC 793</a> | x');
    expect(textOf(html)).toBe(`${line}\n`);
    expect(escapeText('<&>')).toBe('&lt;&amp;&gt;');
  });
  it('renames headings whose ids the other panel already uses', () => {
    const { html, headings } = render('x\n\n1.  Intro\n\n   See Section 1.\n', { reserved: new Set(['section-1']) });
    expect(headings[0]?.id).toBe('text-section-1');
    expect(html).toContain('id="text-section-1"');
    expect(html).not.toContain('href="#section-1"');
  });
});
