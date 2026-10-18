import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { fetchIndex, type IndexEntry, loadIndex, parseIndex } from '../src/lib/rfc-index';

const FIXTURE = path.join(process.cwd(), 'test', 'fixtures', 'rfc-index.sample.xml');
const xml = fs.readFileSync(FIXTURE, 'utf8');
const idx = parseIndex(xml);

function get(n: number): IndexEntry {
  const e = idx.entries.get(n);
  assert.ok(e, `RFC ${n} missing from the fixture`);
  return e;
}

test('parses issued entries', () => {
  const r = get(903);
  assert.strictEqual(r.title, 'A Reverse Address Resolution Protocol');
  assert.deepStrictEqual(r.authors.length, 4);
  assert.strictEqual(r.year, 1984);
  assert.strictEqual(r.month, 6);
  assert.ok(r.isAlso.includes('STD38'));
  assert.strictEqual(r.doi, '10.17487/RFC0903'); // normalized: index emits RFC903, official DOI is padded
});

test('relations are RFC numbers only', () => {
  assert.ok(get(2119).updatedBy.includes(8174));
  for (const e of idx.entries.values()) {
    for (const k of ['obsoletes', 'obsoletedBy', 'updates', 'updatedBy'] as const) {
      assert.ok(e[k].every(Number.isInteger), `${e.number}.${k}`);
    }
  }
});

test('not-issued and max', () => {
  assert.ok(idx.notIssued.has(14) && idx.notIssued.has(26));
  assert.ok(!idx.entries.has(14));
  assert.strictEqual(idx.max, 10055);
});

test('abstract paragraphs joined, whitespace collapsed', () => {
  const r = get(5952);
  assert.ok(r.abstract && !/\s{3,}/.test(r.abstract));
});

test('titles and abstracts are kept verbatim, including the word GitHub', () => {
  const xml = `<rfc-index xmlns="https://www.rfc-editor.org/rfc-index"><rfc-entry><doc-id>RFC8874</doc-id><title>WG GitHub Usage</title><date><month>August</month><year>2020</year></date><abstract><p>Use GitHub.</p></abstract><current-status>INFORMATIONAL</current-status></rfc-entry></rfc-index>`;
  const e = parseIndex(xml).entries.get(8874);
  assert.equal(e?.title, 'WG GitHub Usage');
  assert.equal(e?.abstract, 'Use GitHub.');
});

test('status kept raw', () => {
  assert.strictEqual(get(5952).status, 'PROPOSED STANDARD');
});

test('fails loudly on drift', () => {
  assert.throws(() => parseIndex('<rfc-index></rfc-index>'), /no rfc-entry/i);
  assert.throws(() => parseIndex(xml.replace(/<doc-id>RFC903<\/doc-id>/, '<doc-id>XYZ</doc-id>')), /doc-id/i);
});

test('editors are the subset of authors titled Editor', () => {
  const r = get(1122);
  assert.deepStrictEqual(r.editors, ['R. Braden']);
  assert.ok(r.authors.includes('R. Braden'));
  assert.deepStrictEqual(get(903).editors, []);
});

test('day, area, wg, stream, keywords, obsoletedBy', () => {
  assert.strictEqual(get(748).day, 1);
  assert.strictEqual(get(903).day, null);
  assert.strictEqual(get(903).stream, 'Legacy');
  assert.deepStrictEqual(get(903).keywords, ['RARP']);
  assert.strictEqual(get(903).pageCount, 4);
  assert.deepStrictEqual(get(10).obsoletedBy, [16]);
  assert.deepStrictEqual(get(10).obsoletes, [3]);
  assert.ok([...idx.entries.values()].some((e) => e.area && e.wg));
});

// ---- malformed input --------------------------------------------------------------------------

/** A minimal one-entry index; `over` replaces named child elements of the entry. */
function mini(over: Record<string, string> = {}, extra = ''): string {
  const parts: Record<string, string> = {
    'doc-id': '<doc-id>RFC0007</doc-id>',
    title: '<title>Seven</title>',
    date: '<date><month>June</month><year>1984</year></date>',
    'current-status': '<current-status>HISTORIC</current-status>',
    ...over,
  };
  return `<rfc-index><rfc-entry>${Object.values(parts).join('')}</rfc-entry>${extra}</rfc-index>`;
}

test('a minimal entry parses with defaults for every optional field', () => {
  const e = parseIndex(mini()).entries.get(7);
  assert.ok(e);
  assert.deepEqual(
    { ...e },
    {
      number: 7,
      title: 'Seven',
      authors: [],
      editors: [],
      year: 1984,
      month: 6,
      day: null,
      status: 'HISTORIC',
      pubStatus: 'HISTORIC',
      stream: null,
      area: null,
      wg: null,
      abstract: null,
      keywords: [],
      pageCount: null,
      doi: '10.17487/RFC0007',
      errataUrl: null,
      isAlso: [],
      obsoletes: [],
      obsoletedBy: [],
      updates: [],
      updatedBy: [],
    },
  );
});

test('pubStatus, errata, nested abstract markup and non-numeric page counts', () => {
  const e = parseIndex(
    mini({
      'publication-status': '<publication-status>UNKNOWN</publication-status>',
      'errata-url': '<errata-url>https://www.rfc-editor.org/errata/rfc7</errata-url>',
      abstract: '<abstract><p>First <b>bold</b> part.</p><p>  </p><p>Second.</p></abstract>',
      'page-count': '<page-count>many</page-count>',
      author:
        '<author><name>A. Author</name></author><author><name> </name></author><author><name>E. Ditor</name><title>Editor</title></author>',
    }),
  ).entries.get(7);
  assert.ok(e);
  assert.equal(e.pubStatus, 'UNKNOWN');
  assert.equal(e.errataUrl, 'https://www.rfc-editor.org/errata/rfc7');
  // Mixed content is flattened (its exact word order/spacing is not a contract); empty paragraphs drop out.
  const paras = (e.abstract ?? '').split('\n\n');
  assert.equal(paras.length, 2);
  assert.match(paras[0] ?? '', /bold/);
  assert.equal(paras[1], 'Second.');
  assert.equal(e.pageCount, null);
  assert.deepEqual(e.authors, ['A. Author', 'E. Ditor']);
  assert.deepEqual(e.editors, ['E. Ditor']);
});

test('non-RFC doc-ids in relations are dropped; RFC ids lose their padding', () => {
  const e = parseIndex(
    mini({
      obsoletes: '<obsoletes><doc-id>RFC0003</doc-id><doc-id>STD0004</doc-id></obsoletes>',
      'is-also': '<is-also><doc-id>BCP0014</doc-id></is-also>',
    }),
  ).entries.get(7);
  assert.ok(e);
  assert.deepEqual(e.obsoletes, [3]);
  assert.deepEqual(e.isAlso, ['BCP0014']);
});

test('each structural defect names the entry and the problem', () => {
  const cases: Array<[string, Record<string, string>, RegExp]> = [
    ['two doc-ids', { 'doc-id': '<doc-id>RFC0007</doc-id><doc-id>RFC0008</doc-id>' }, /2 doc-id/],
    ['no doc-id', { 'doc-id': '' }, /0 doc-id/],
    ['not an RFC id', { 'doc-id': '<doc-id>BCP0007</doc-id>' }, /unexpected doc-id/],
    ['missing title', { title: '' }, /RFC7 lacks title/],
    ['missing status', { 'current-status': '' }, /lacks current-status/],
    ['missing date', { date: '' }, /lacks date/],
    ['missing year', { date: '<date><month>June</month></date>' }, /lacks date/],
    ['unknown month', { date: '<date><month>Smarch</month><year>1984</year></date>' }, /unknown month/],
    ['bad year', { date: '<date><month>June</month><year>MCMLXXXIV</year></date>' }, /bad year/],
  ];
  for (const [name, over, re] of cases) assert.throws(() => parseIndex(mini(over)), re, name);
});

test('not-issued entries are validated too', () => {
  const ok = parseIndex(mini({}, '<rfc-not-issued-entry><doc-id>RFC0099</doc-id></rfc-not-issued-entry>'));
  assert.ok(ok.notIssued.has(99));
  assert.equal(ok.max, 99, 'a not-issued number beyond the last issued RFC raises max');
  assert.throws(
    () => parseIndex(mini({}, '<rfc-not-issued-entry><doc-id>RFC0001</doc-id><doc-id>RFC0002</doc-id></rfc-not-issued-entry>')),
    /rfc-not-issued-entry with 2/,
  );
  assert.throws(() => parseIndex(mini({}, '<rfc-not-issued-entry><doc-id>nope</doc-id></rfc-not-issued-entry>')), /unexpected doc-id/);
});

// ---- loadIndex --------------------------------------------------------------------------------

const MINI = mini();
const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'rfc-index-'));
  tmpDirs.push(d);
  return d;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function stubFetch(impl: () => Promise<Partial<Response>>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}
const neverFetch = () => stubFetch(() => Promise.reject(new Error('network access is not allowed here')));

test('RFC_INDEX_FILE pins the index to a file and never touches the network', async () => {
  const fetchSpy = neverFetch();
  vi.stubEnv('RFC_INDEX_FILE', FIXTURE);
  const loaded = loadIndex({ snapshot: path.join(tmp(), 'absent.xml') });
  assert.equal(loaded.max, idx.max);
  assert.equal(loaded.entries.get(903)?.title, 'A Reverse Address Resolution Protocol');
  assert.equal(fetchSpy.mock.calls.length, 0);
});

test('an explicit file option wins over RFC_INDEX_FILE; a missing file is an error', () => {
  const dir = tmp();
  const own = path.join(dir, 'mini.xml');
  fs.writeFileSync(own, MINI);
  vi.stubEnv('RFC_INDEX_FILE', FIXTURE);
  assert.deepEqual([...loadIndex({ file: own }).entries.keys()], [7]);
  assert.throws(() => loadIndex({ file: path.join(dir, 'absent.xml') }), /file not found/);
});

test('without RFC_INDEX_FILE (or with it empty) the committed snapshot is the source', () => {
  const dir = tmp();
  const snap = path.join(dir, 'rfc-index.xml');
  fs.writeFileSync(snap, MINI);
  vi.stubEnv('RFC_INDEX_FILE', '');
  assert.equal(loadIndex({ snapshot: snap }).max, 7);
  vi.stubEnv('RFC_INDEX_FILE', FIXTURE);
  assert.equal(loadIndex({ snapshot: snap }).max, idx.max, 'the env var overrides the snapshot');
});

test('a missing snapshot is a clear error and never falls back to the network', () => {
  const fetchSpy = neverFetch();
  vi.stubEnv('RFC_INDEX_FILE', '');
  assert.throws(() => loadIndex({ snapshot: path.join(tmp(), 'absent.xml') }), /snapshot .* is missing/);
  assert.equal(fetchSpy.mock.calls.length, 0);
});

test('the repository snapshot exists and parses', () => {
  vi.stubEnv('RFC_INDEX_FILE', '');
  const loaded = loadIndex();
  assert.ok(loaded.entries.size > 9000);
  assert.ok(loaded.entries.has(903));
});

test('fetchIndex returns the validated XML; HTTP errors and malformed bodies are rejected', async () => {
  const ok = await fetchIndex((async () => ({ status: 200, text: async () => xml })) as unknown as typeof fetch);
  assert.equal(ok.xml, xml);
  assert.equal(ok.index.max, idx.max);
  await assert.rejects(fetchIndex((async () => ({ status: 503, text: async () => 'oops' })) as unknown as typeof fetch), /HTTP 503/);
  await assert.rejects(
    fetchIndex((async () => ({ status: 200, text: async () => '<rfc-index></rfc-index>' })) as unknown as typeof fetch),
    /no rfc-entry/,
  );
});
