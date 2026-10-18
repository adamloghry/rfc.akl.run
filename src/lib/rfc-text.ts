/**
 * The original RFC text (data/rfc-text/<n>.txt, as served by the RFC Editor) prepared for the page:
 *
 *   parseRfcFile      split off the "[rfc.akl.run: converted from ...]" marker of PDF-converted texts
 *   normalizeRfcText  remove page-break noise (form feeds, running page headers and footers and the blank
 *                     lines around them); every other character of the document is left exactly as is
 *   detectHeadings    numbered / appendix / well-known unnumbered headings at column 0
 *   renderRfcText     HTML for a <pre>: headings get ids and permalinks, "RFC <n>" and "Section <n>"
 *                     references become links. Only the matched text is wrapped, so columns, and with them
 *                     ASCII diagrams, stay aligned.
 *
 * Pure functions (no I/O) except readRfcFile.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface RfcFile {
  /** The conversion marker of a PDF-converted text (without the brackets), or null. */
  note: string | null;
  /** Text without the marker line. */
  body: string;
}

export interface Heading {
  /** Element id: section-3.2, appendix-a, appendix-a.1, section-abstract. */
  id: string;
  /** "3.2", "Appendix A", "A.1" or "" for unnumbered headings. */
  label: string;
  title: string;
  /** 1 = top level. */
  depth: number;
  /** Index into the normalized lines. */
  line: number;
}

const CONVERTED = /^\[rfc\.akl\.run: (converted from [^\]\n]*)\][ \t]*\r?\n/;

export function parseRfcFile(raw: string): RfcFile {
  const m = CONVERTED.exec(raw);
  return m ? { note: m[1] ?? null, body: raw.slice(m[0].length) } : { note: null, body: raw };
}

/** Read data/rfc-text/<n>.txt; null when the file does not exist. */
export function readRfcFile(n: number, dir = path.join(process.cwd(), 'data', 'rfc-text')): RfcFile | null {
  try {
    return parseRfcFile(fs.readFileSync(path.join(dir, `${n}.txt`), 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- normalization

const MONTH =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)';
const DATE = `${MONTH}\\.?,? (?:\\d{1,2},? )?\\d{4}`;
const DATE_ONLY = new RegExp(`^${DATE}$`);
const DATE_EDGE = new RegExp(`^${DATE}\\b|\\b${DATE}$`);
const RFC_EDGE = /^RFC[\s#-]*\d+\b|\bRFC[\s#-]*\d+$/i;
const DRAFT_HEAD = /^Internet[- ]Draft\b/i;
const GAP = /\S(?: {3,}|\t+)\S/;
const FOOT_PAGE = /\[\s*Page\s+[0-9ivxlcdm]+\s*\]/i;
const FOOT_DASH = /^\s*-\s*\d{1,4}\s*-\s*$/;
const FOOT_NUM = /^\s*(?:Page\s+)?\d{1,4}\s*$/i;
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
const CONTROL = /[\x00-\x08\x0b\x0e-\x1f\x7f]/g;

/** A running page header such as "RFC 903        RARP        June 1984" or "September 1981". */
export function isPageHeader(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 110) return false;
  if (DATE_ONLY.test(t)) return true;
  if (!GAP.test(t)) return false;
  return RFC_EDGE.test(t) || DATE_EDGE.test(t) || DRAFT_HEAD.test(t);
}

type FooterKind = 'page' | 'dash' | 'num';
function footerKind(line: string | undefined): FooterKind | null {
  if (line === undefined) return null;
  if (line.length <= 110 && FOOT_PAGE.test(line)) return 'page';
  if (FOOT_DASH.test(line)) return 'dash';
  if (FOOT_NUM.test(line)) return 'num';
  return null;
}

const indent = (l: string): number => l.length - l.trimStart().length;
const lastNonBlank = (a: string[]): number => {
  let i = a.length - 1;
  while (i >= 0 && !a[i]?.trim()) i--;
  return i;
};

/**
 * Remove page-break noise. A page break is a form feed. For each break the page footer ("... [Page 3]")
 * and the next page's running header ("RFC 903 ... June 1984") are dropped together with the blank lines
 * that pad them. When the break fell between two paragraphs (the page ends in sentence punctuation, or a
 * line at column 0 such as a heading is involved) one blank line is kept; otherwise the text on both
 * sides is joined directly so a paragraph or a diagram that straddled the break reads continuously.
 * Trailing whitespace is stripped from every line and control characters are removed.
 */
export function normalizeRfcText(raw: string): string {
  const text = raw.replace(/\r\n?/g, '\n').replace(CONTROL, '');
  const pages = text.split('\f').map((p) => p.split('\n').map((l) => l.replace(/[ \t]+$/, '')));

  // Footers without a "[Page n]" marker (dashed or bare numbers) are only trusted when they are consistent.
  const kinds = pages.slice(0, -1).map((p) => footerKind(p[lastNonBlank(p)]));
  const breaks = Math.max(1, kinds.length);
  const count = (k: FooterKind): number => kinds.filter((x) => x === k).length;
  const trusted = new Set<FooterKind>(['page']);
  for (const k of ['dash', 'num'] as const) if (count(k) >= 2 && count(k) / breaks >= 0.6) trusted.add(k);

  const out: string[] = [];
  pages.forEach((page, i) => {
    const lines = page.slice();
    if (i > 0) {
      while (lines.length && !lines[0]?.trim()) lines.shift();
      if (lines.length && isPageHeader(lines[0] ?? '')) {
        const dateOnly = DATE_ONLY.test((lines[0] ?? '').trim());
        lines.shift();
        // A header split over lines: "September 1981", then "Internet Protocol" and perhaps a section name.
        if (dateOnly) {
          const short = (l: string | undefined): boolean => /^(?:\S.{0,50}| {20,}\S.{0,50})$/.test(l ?? '');
          const run = short(lines[0]) ? (short(lines[1]) ? 2 : 1) : 0;
          if (run && lines.length > run && !(lines[run] ?? '').trim()) lines.splice(0, run);
        }
      }
      while (lines.length && !lines[0]?.trim()) lines.shift();
    }
    {
      const li = lastNonBlank(lines);
      const k = footerKind(lines[li]);
      // The last page ends with a footer too, but only an explicit "[Page n]" is trusted there.
      if (k && trusted.has(k) && (i < pages.length - 1 || k === 'page')) lines.length = li;
      lines.length = lastNonBlank(lines) + 1;
    }
    if (i === 0 || out.length === 0) {
      out.push(...lines);
      return;
    }
    if (!lines.length) return;
    const prev = out[lastNonBlank(out)] ?? '';
    const next = lines[0] ?? '';
    const paragraphBreak =
      /[.:?!;]["')\]]?$/.test(prev) ||
      (prev !== '' && !/^\s/.test(prev)) ||
      !/^\s/.test(next) ||
      Math.abs(indent(prev) - indent(next)) >= 4;
    out.length = lastNonBlank(out) + 1;
    if (paragraphBreak) out.push('');
    out.push(...lines);
  });
  while (out.length && !out[0]?.trim()) out.shift();
  out.length = lastNonBlank(out) + 1;
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------- headings

const NUMBERED = /^(\d{1,3}(?:\.\d{1,3})*)(\.?)( +)(\S.*)$/;
const CENTERED = /^ {10,}(\d{1,3})\.( {2,})([A-Z][A-Z0-9 &/,'()-]{2,})$/;
const ROMAN = /^(X{0,3}(?:IX|IV|V?I{0,3}))\.( +)([A-Z].*)$/;
const APPENDIX = /^(?:Appendix|APPENDIX)\s+([A-Z](?:\.\d+)*)[.:]?(?:\s+(\S.*))?$/;
const APPENDIX_BARE = /^([A-Z](?:\.\d{1,3})*)\.( {2,})(\S.*)$/;
const UNNUMBERED =
  /^(abstract|status of this memo|copyright notice|table of contents|contents|acknowledg(?:e)?ments?|authors?['’]?s?['’]? addresses|author['’]s address|editors?['’]?s?['’]? addresses?|introduction|overview|security considerations|iana considerations|references|normative references|informative references|bibliography|glossary|index|full copyright statement|intellectual property(?: statement| notice)?|contributors)\s*:?$/i;
const LEADERS = /\.{3,}|(?:\. ){3,}|\s{2,}\d+$/;

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const romanValue = (r: string): number => {
  const v: Record<string, number> = { I: 1, V: 5, X: 10 };
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const cur = v[r.charAt(i)] ?? 0;
    total += cur < (v[r.charAt(i + 1)] ?? 0) ? -cur : cur;
  }
  return total;
};

/**
 * Section headings of a normalized text. Recognized, always at column 0 and after a blank line:
 *   "3.2.  Title", "3.  Title", "3.2 Title"   -> section-3.2
 *   "Appendix A.  Title", "A.1.  Title"       -> appendix-a, appendix-a.1
 *   Abstract, Status of This Memo, ...        -> section-abstract, ...
 * Lines that look like table-of-contents entries (dot leaders, trailing page numbers) are skipped, as are
 * numbers that jump far ahead of the sections seen so far and repeated ids.
 */
export function detectHeadings(lines: string[]): Heading[] {
  const nonBlank = lines.filter((l) => l.trim());
  const flush = nonBlank.length > 0 && nonBlank.filter((l) => /^\s/.test(l)).length / nonBlank.length < 0.3;
  const out: Heading[] = [];
  const seen = new Set<string>();
  let maxTop = 0;
  let appendixLetter = '';
  let maxRoman = 0;
  let sawNumbered = false;

  const add = (h: Heading): void => {
    if (seen.has(h.id)) return;
    seen.add(h.id);
    out.push(h);
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const c = CENTERED.exec(line);
    if (c && lines[i - 1]?.trim() === '' && lines[i + 1]?.trim() === '') {
      const top = Number.parseInt(c[1] ?? '', 10);
      if (top <= maxTop + 3) {
        maxTop = Math.max(maxTop, top);
        sawNumbered = true;
        add({ id: `section-${top}`, label: String(top), title: (c[3] ?? '').trim(), depth: 1, line: i });
      }
      continue;
    }
    if (!line || /^\s/.test(line) || lines[i - 1]?.trim() !== '' || line.length > 110) continue;
    if (flush && lines[i + 1]?.trim()) continue;

    let m = NUMBERED.exec(line);
    if (m) {
      const [, num = '', dot = '', spaces = '', title = ''] = m;
      if ((dot || spaces.length >= 2) && /^["'(A-Za-z]/.test(title) && !/[.,;]$/.test(title) && !LEADERS.test(title)) {
        const top = Number.parseInt(num, 10);
        if (top <= maxTop + 3) {
          maxTop = Math.max(maxTop, top);
          sawNumbered = true;
          add({ id: `section-${num}`, label: num, title: title.trim(), depth: num.split('.').length, line: i });
        }
      }
      continue;
    }

    m = ROMAN.exec(line);
    if (m?.[1]) {
      const value = romanValue(m[1]);
      const title = (m[3] ?? '').trim();
      if (value <= maxRoman + 3 && /^["'(A-Za-z]/.test(title) && !/[.,;]$/.test(title) && !LEADERS.test(title)) {
        maxRoman = Math.max(maxRoman, value);
        add({ id: `section-${m[1].toLowerCase()}`, label: m[1], title, depth: 1, line: i });
      }
      continue;
    }

    m = APPENDIX.exec(line);
    if (m) {
      const token = m[1] ?? '';
      const title = (m[2] ?? '').trim();
      if (title && LEADERS.test(title)) continue;
      appendixLetter = token.charAt(0);
      add({
        id: `appendix-${token.toLowerCase()}`,
        label: `Appendix ${token}`,
        title: title || `Appendix ${token}`,
        depth: token.split('.').length,
        line: i,
      });
      continue;
    }

    m = APPENDIX_BARE.exec(line);
    if (m) {
      const token = m[1] ?? '';
      const title = (m[3] ?? '').trim();
      const letter = token.charAt(0);
      const nextLetter = appendixLetter ? String.fromCharCode(appendixLetter.charCodeAt(0) + 1) : 'A';
      const ok = token.includes('.') ? letter === appendixLetter : sawNumbered && (letter === nextLetter || letter === appendixLetter);
      if (ok && /^["'(A-Za-z]/.test(title) && !/[.,;]$/.test(title) && !LEADERS.test(title)) {
        if (!token.includes('.')) appendixLetter = letter;
        add({
          id: `appendix-${token.toLowerCase()}`,
          label: token,
          title,
          depth: token.split('.').length,
          line: i,
        });
      }
      continue;
    }

    m = UNNUMBERED.exec(line);
    if (m) {
      const title = line.replace(/\s*:$/, '').trim();
      add({ id: `section-${slug(title)}`, label: '', title, depth: 1, line: i });
    }
  }
  return out;
}

// ---------------------------------------------------------------- rendering

export interface RenderOptions {
  /** This RFC's own number: mentions of it are not linked. */
  self: number;
  /** Whether an RFC with this number was issued (only those are linked). */
  issued: (n: number) => boolean;
  /** Ids already used elsewhere on the page (the AI panel's section ids). A heading whose id is taken becomes "text-<id>". */
  reserved?: ReadonlySet<string>;
}

export interface Rendered {
  html: string;
  headings: Heading[];
}

const AMP = /&/g;
const LT = /</g;
const GT = />/g;
export const escapeText = (s: string): string => s.replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;');

const REF =
  /(?<![A-Za-z0-9_])(?:RFC ?(\d{1,5})(?!\d)|([Ss]ections?)\s+(\d+(?:\.\d+)*)(?![\w])|(Appendix|Appendices)\s+([A-Z](?:\.\d+)*)(?![\w]))/g;
const OF_OTHER = /^\s+of\s+(?:the\s+)?(?:\[|RFC\b)/;
const AFTER_OTHER = /(?:RFC ?\d+|\])[,;]?\s*$/;

function linkifyLine(line: string, next: string, ids: Set<string>, o: RenderOptions): string {
  if (!line.includes('RFC') && !/[Ss]ection|Appendix|Appendices/.test(line)) return escapeText(line);
  let out = '';
  let last = 0;
  REF.lastIndex = 0;
  for (let m = REF.exec(line); m; m = REF.exec(line)) {
    let href = '';
    if (m[1] !== undefined) {
      const n = Number.parseInt(m[1], 10);
      if (n !== o.self && n > 0 && o.issued(n)) href = `/rfc${n}`;
    } else {
      const id = m[3] !== undefined ? `section-${m[3]}` : `appendix-${(m[5] ?? '').toLowerCase()}`;
      if (ids.has(id)) {
        const rest = line.slice(m.index + m[0].length);
        const external =
          OF_OTHER.test(rest) ||
          (/^\s+of\s*$/.test(rest) && /^\s*(?:\[|RFC\b)/.test(next)) ||
          AFTER_OTHER.test(line.slice(0, m.index).trimEnd());
        if (!external) href = `#${id}`;
      }
    }
    if (!href) continue;
    out += `${escapeText(line.slice(last, m.index))}<a href="${href}">${escapeText(m[0])}</a>`;
    last = m.index + m[0].length;
  }
  return last === 0 ? escapeText(line) : out + escapeText(line.slice(last));
}

const permalinkLabel = (h: Heading): string =>
  `Permalink to ${h.label ? (h.label.startsWith('Appendix') ? h.label : `section ${h.label}`) : h.title}`;

/** Normalized text -> HTML for the inside of a <pre> (see the module comment). */
export function renderRfcText(text: string, o: RenderOptions): Rendered {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const headings = detectHeadings(lines).map((h) => (o.reserved?.has(h.id) ? { ...h, id: `text-${h.id}` } : h));
  const byLine = new Map(headings.map((h) => [h.line, h]));
  const ids = new Set(headings.map((h) => h.id));
  const parts: string[] = [];
  lines.forEach((line, i) => {
    const h = byLine.get(i);
    if (h) {
      parts.push(
        `<span class="rt-h" id="${h.id}" role="heading" aria-level="${Math.min(6, h.depth + 2)}"><a class="rt-perma" href="#${h.id}" aria-label="${escapeText(permalinkLabel(h))}"></a>${escapeText(line)}</span>`,
      );
    } else parts.push(linkifyLine(line, lines[i + 1] ?? '', ids, o));
  });
  return { html: `${parts.join('\n')}\n`, headings };
}
