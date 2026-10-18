/** The slice of an RfcRecord the citation formats read. */
export interface Citable {
  number: number;
  title?: string;
  indexTitle?: string;
  authors?: string[];
  indexAuthors?: string[];
  editors?: string[];
  year: number;
  month: number;
  isAlso?: string[];
  doi?: string | null;
  pageCount?: number | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BIB_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Splits "J.C. Mogul" / "J.-P. Van Der Berg" into leading initials and surname. */
function splitName(name: string): { initials: string; surname: string } {
  const tokens = String(name).trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length - 1 && /\.$/.test(tokens[i])) i++;
  return { initials: tokens.slice(0, i).join(' '), surname: tokens.slice(i).join(' ') };
}

function inverted(name: string, isEditor: boolean) {
  const { initials, surname } = splitName(name);
  const base = initials ? `${surname}, ${initials}` : surname;
  return isEditor ? `${base}, Ed.` : base;
}

function direct(name: string, isEditor: boolean) {
  return isEditor ? `${name}, Ed.` : String(name);
}

/** Citations always use the index's initials-form names, not content-overridden full names. */
function names(rfc: Pick<Citable, 'indexAuthors' | 'authors'>): string[] {
  return rfc.indexAuthors || rfc.authors || [];
}

/** RFC Editor style author list: "A, B., C, D., and E. F". Editors are always "Last, I., Ed.". */
function authorList(rfc: Citable): string {
  const editors = new Set(rfc.editors || []);
  const authors = names(rfc);
  const n = authors.length;
  const parts = authors.map((a, i) => (n === 1 || i < n - 1 ? inverted(a, editors.has(a)) : direct(a, editors.has(a))));
  if (n === 0) return '';
  if (n === 1) return parts[0];
  if (n === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[n - 1]}`;
}

function url(rfc: { number: number }) {
  return `https://www.rfc-editor.org/info/rfc${rfc.number}`;
}

/** RFC Editor citation string. */
export function rfcEditor(rfc: Citable): string {
  const parts: string[] = [];
  const authors = authorList(rfc);
  if (authors) parts.push(authors);
  parts.push(`"${rfc.indexTitle || rfc.title}"`);
  for (const id of rfc.isAlso || []) {
    const m = /^([A-Za-z]+)\s*(\d+)$/.exec(id);
    parts.push(m ? `${m[1].toUpperCase()} ${Number(m[2])}` : id);
  }
  parts.push(`RFC ${rfc.number}`);
  if (rfc.doi) parts.push(`DOI ${rfc.doi}`);
  parts.push(`${MONTHS[rfc.month - 1]} ${rfc.year}`);
  parts.push(`<${url(rfc)}>`);
  return `${parts.join(', ')}.`;
}

export function bibtex(rfc: Citable): string {
  const lines = [
    `@misc{rfc${rfc.number},`,
    '  series = {Request for Comments},',
    `  number = ${rfc.number},`,
    `  howpublished = {RFC ${rfc.number}},`,
    '  publisher = {RFC Editor},',
  ];
  if (rfc.doi) lines.push(`  doi = {${rfc.doi}},`);
  lines.push(`  url = {${url(rfc)}},`);
  lines.push(`  author = {${names(rfc).join(' and ')}},`);
  lines.push(`  title = {{${rfc.indexTitle || rfc.title}}},`);
  if (rfc.pageCount) lines.push(`  pagetotal = ${rfc.pageCount},`);
  lines.push(`  year = ${rfc.year},`);
  lines.push(`  month = ${BIB_MONTHS[rfc.month - 1]},`);
  lines.push('}');
  return lines.join('\n');
}
