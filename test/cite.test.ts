import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import * as cite from '../src/lib/cite';
import { buildSite } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';

const HERE = `${process.cwd()}/test`;

const rfc903 = {
  number: 903,
  title: 'A Reverse Address Resolution Protocol',
  authors: ['R. Finlayson', 'T. Mann', 'J.C. Mogul', 'M. Theimer'],
  editors: [],
  year: 1984,
  month: 6,
  isAlso: ['STD38'],
  doi: '10.17487/RFC0903',
  pageCount: 4,
};

test('rfcEditor: exact string for RFC 903', () => {
  assert.equal(
    cite.rfcEditor(rfc903),
    // title is content-overridden in the fixture; authors must still come from the index
    'Finlayson, R., Mann, T., Mogul, J.C., and M. Theimer, "A Reverse Address Resolution Protocol", STD 38, RFC 903, DOI 10.17487/RFC0903, June 1984, <https://www.rfc-editor.org/info/rfc903>.',
  );
});

test('bibtex: exact string for RFC 903', () => {
  assert.equal(
    cite.bibtex(rfc903),
    [
      '@misc{rfc903,',
      '  series = {Request for Comments},',
      '  number = 903,',
      '  howpublished = {RFC 903},',
      '  publisher = {RFC Editor},',
      '  doi = {10.17487/RFC0903},',
      '  url = {https://www.rfc-editor.org/info/rfc903},',
      '  author = {R. Finlayson and T. Mann and J.C. Mogul and M. Theimer},',
      '  title = {{A Reverse Address Resolution Protocol}},',
      '  pagetotal = 4,',
      '  year = 1984,',
      '  month = jun,',
      '}',
    ].join('\n'),
  );
});

test('rfcEditor: single author, editor, no is-also, no doi', () => {
  const r = { number: 791, title: 'Internet Protocol', authors: ['J. Postel'], editors: [], year: 1981, month: 9, isAlso: [], doi: null };
  assert.equal(cite.rfcEditor(r), 'Postel, J., "Internet Protocol", RFC 791, September 1981, <https://www.rfc-editor.org/info/rfc791>.');
  const e = {
    number: 7230,
    title: 'HTTP/1.1',
    authors: ['R. Fielding', 'J. Reschke'],
    editors: ['R. Fielding', 'J. Reschke'],
    year: 2014,
    month: 6,
    isAlso: [],
    doi: '10.17487/RFC7230',
  };
  assert.equal(
    cite.rfcEditor(e),
    'Fielding, R., Ed. and J. Reschke, Ed., "HTTP/1.1", RFC 7230, DOI 10.17487/RFC7230, June 2014, <https://www.rfc-editor.org/info/rfc7230>.',
  );
  const one = {
    number: 8446,
    title: 'TLS 1.3',
    authors: ['E. Rescorla'],
    editors: ['E. Rescorla'],
    year: 2018,
    month: 8,
    isAlso: [],
    doi: null,
  };
  assert.equal(cite.rfcEditor(one), 'Rescorla, E., Ed., "TLS 1.3", RFC 8446, August 2018, <https://www.rfc-editor.org/info/rfc8446>.');
  const two = { number: 1, title: 'T', authors: ['A. Bee', 'C. Dee'], editors: [], year: 2000, month: 1, isAlso: ['BCP14'], doi: null };
  assert.equal(cite.rfcEditor(two), 'Bee, A. and C. Dee, "T", BCP 14, RFC 1, January 2000, <https://www.rfc-editor.org/info/rfc1>.');
});

test('rfcEditor: multi-token initials and surnames', () => {
  const r = { number: 5, title: 'T', authors: ['J.-P. Van Der Berg'], editors: [], year: 2000, month: 12, isAlso: [], doi: null };
  assert.match(cite.rfcEditor(r), /^Van Der Berg, J\.-P\., "T"/);
});

test('bibtex: omits pagetotal and doi when absent', () => {
  const r = {
    number: 791,
    title: 'Internet Protocol',
    authors: ['J. Postel'],
    editors: [],
    year: 1981,
    month: 9,
    isAlso: [],
    doi: null,
    pageCount: null,
  };
  const b = cite.bibtex(r);
  assert.ok(!/pagetotal|doi/.test(b));
  assert.ok(b.includes('month = sep,'));
  assert.ok(b.startsWith('@misc{rfc791,'));
});

test('rfcEditor: three authors with editors keep last author in direct order', () => {
  const r = {
    number: 7231,
    title: 'HTTP/1.1',
    authors: ['R. Fielding', 'M. Nottingham', 'J. Reschke'],
    editors: ['R. Fielding', 'M. Nottingham', 'J. Reschke'],
    year: 2014,
    month: 6,
    isAlso: [],
    doi: null,
  };
  assert.equal(
    cite.rfcEditor(r),
    'Fielding, R., Ed., Nottingham, M., Ed., and J. Reschke, Ed., "HTTP/1.1", RFC 7231, June 2014, <https://www.rfc-editor.org/info/rfc7231>.',
  );
});

test('rfcEditor/bibtex use indexAuthors over content-overridden authors', () => {
  const index = parseIndex(fs.readFileSync(path.join(HERE, 'fixtures', 'rfc-index.sample.xml'), 'utf8'));
  const site = buildSite({ index, contentDir: path.join(HERE, 'fixtures', 'content'), buildDate: new Date('2000-01-01') });
  const r = site.rfcs.get(903);
  assert.ok(r);
  assert.deepEqual(r.authors, ['Ross Finlayson']);
  assert.equal(r.title, 'RARP: Finding Your Own Address');
  assert.equal(
    cite.rfcEditor(r),
    // title and authors are content-overridden in the fixture; citation must use the index values
    'Finlayson, R., Mann, T., Mogul, J.C., and M. Theimer, "A Reverse Address Resolution Protocol", STD 38, RFC 903, DOI 10.17487/RFC0903, June 1984, <https://www.rfc-editor.org/info/rfc903>.',
  );
  assert.ok(cite.bibtex(r).includes('title = {{A Reverse Address Resolution Protocol}},'));
  assert.ok(cite.bibtex(r).includes('author = {R. Finlayson and T. Mann and J.C. Mogul and M. Theimer},'));
});
