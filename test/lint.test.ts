// @ts-nocheck -- ported from node:test; vitest does not type-check
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHtml } from '../src/lib/sanitize-check';
import { lint } from '../scripts/lint-content';

const HERE = process.cwd() + '/test';

const FIX = path.join(HERE, 'fixtures', 'content');
const index = {
  entries: new Map([826, 903, 5952, 1, 951, 1542, 2131].map((n) => [n, { number: n }])),
  notIssued: new Set([2]),
  max: 6000,
};

function tmpContent() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'lint-'));
  fs.cpSync(FIX, dir, { recursive: true });
  return dir;
}
const rfcPath = (dir, n) => path.join(dir, 'rfcs', n + '.json');
function edit(dir, n, fn) {
  const p = rfcPath(dir, n);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  fn(j);
  fs.writeFileSync(p, JSON.stringify(j));
}
function baseline() {
  const dir = tmpContent();
  const r = lint(dir, index, { updateLock: true });
  assert.deepEqual(r.errors, []);
  return dir;
}
const has = (list, re) => list.some((m) => re.test(m));

test('clean fixtures lint without errors and write the lock', () => {
  const dir = baseline();
  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'section-ids.lock.json'), 'utf8'));
  assert.deepEqual(lock['903'], ['introduction', 'packet-format']);
  assert.deepEqual(lint(dir, index, {}).errors, []);
});

test('schema error reports file and path', () => {
  const dir = baseline();
  edit(dir, 903, (j) => { j.sections[0].id = 'Bad Id'; });
  const r = lint(dir, index, {});
  assert.ok(has(r.errors, /903\.json.*\/sections\/0\/id/), r.errors.join('\n'));
});

test('unknown viz type is a schema error', () => {
  const dir = baseline();
  edit(dir, 903, (j) => { j.viz[0].type = 'nope'; });
  assert.ok(has(lint(dir, index, {}).errors, /903\.json.*\/viz\/0\/type/));
});

test('unknown glossary id is an error', () => {
  const dir = baseline();
  edit(dir, 903, (j) => { j.glossary = ['mac-address', 'no-such-term']; });
  assert.ok(has(lint(dir, index, {}).errors, /no-such-term/));
});

test('removed locked section id is a permalink break', () => {
  const dir = baseline();
  edit(dir, 903, (j) => { j.sections = j.sections.filter((s) => s.id !== 'packet-format'); delete j.viz; });
  const r = lint(dir, index, {});
  assert.ok(r.errors.includes('permalink break: 903#packet-format'), r.errors.join('\n'));
});

test('new section id is a warning unless updateLock', () => {
  const dir = baseline();
  edit(dir, 826, (j) => { j.sections.push({ id: 'extra', title: 'Extra', content: '<p>x</p>' }); });
  const r = lint(dir, index, {});
  assert.deepEqual(r.errors, []);
  assert.ok(has(r.warnings, /826#extra/));
  const r2 = lint(dir, index, { updateLock: true });
  assert.ok(!has(r2.warnings, /826#extra/));
  assert.ok(!has(lint(dir, index, {}).warnings, /826#extra/));
});

test('content number missing from the index is an error', () => {
  const dir = baseline();
  fs.writeFileSync(rfcPath(dir, 4242), JSON.stringify({ number: 4242, summary: '<p>x</p>', eli5: { summary: '<p>y</p>' } }));
  assert.ok(has(lint(dir, index, {}).errors, /4242/));
});

test('filename must match number', () => {
  const dir = baseline();
  fs.renameSync(rfcPath(dir, 5952), rfcPath(dir, 5953));
  assert.ok(has(lint(dir, index, {}).errors, /5953\.json.*number/i));
});

test('missing eli5 on summary+ tiers is a warning', () => {
  const dir = baseline();
  let r = lint(dir, index, {});
  assert.ok(has(r.warnings, /5952.*eli5/i));
  assert.ok(has(r.warnings, /826.*eli5/i));
  assert.ok(!has(r.warnings, /903.*eli5/i));
  edit(dir, 5952, (j) => { j.eli5 = { summary: '<p>ok</p>' }; });
  r = lint(dir, index, {});
  assert.ok(!has(r.warnings, /5952.*eli5/i));
});

test('internal link above max is an error; legacy #rfc link is an error', () => {
  const dir = baseline();
  edit(dir, 826, (j) => { j.sections[0].content = '<p><a href="/99999/">x</a></p>'; });
  assert.ok(has(lint(dir, index, {}).errors, /826.*99999/));
  edit(dir, 826, (j) => { j.sections[0].content = '<p><a href="#rfc903">x</a></p>'; });
  assert.ok(has(lint(dir, index, {}).errors, /826.*#rfc903/));
  edit(dir, 826, (j) => { j.sections[0].content = '<p><a href="/903/">fine</a></p>'; });
  assert.deepEqual(lint(dir, index, {}).errors, []);
});

const REJECT = [
  '<script>x</script>', '<SCRIPT>x</SCRIPT>', '<iframe src="x"></iframe>', '<style>a{}</style>',
  '<svg/onload=alert(1)>',
  '<a href="java&#115;cript:alert(1)">x</a>',
  '<a href="&#x6A;avascript:x">',
  '<meta http-equiv=refresh content="0;url=https://evil.example">',
  '<p onclick=x>',
  '<img src=x onerror=y>',
  '<base href=//evil>',
  '<a href=" javascript:x">',
  '<a href="javascript:alert(1)">a</a>',
  '<a href="jav&Tab;ascript:x">a</a>',
  '<a href="&#0000106avascript:x">a</a>',
  '<a href="data:text/html,x">a</a>',
  '<p class="a"onclick="x">a</p>',
  '<form action=/x><button>b</button></form>',
  '<a href="https://ok.example" target="_blank">a</a>',
  '<a href="//evil.com">a</a>',
  '<a href="/\\evil.com">a</a>',
  '<p <b>x</p>',
  '<!-- c --><p>x</p>',
  '<p>keys <From, To> range</p>',
];
const ACCEPT = [
  '<div class="callout callout-info"><p>Note <code>x</code></p></div>',
  '<div class="key-points"><div class="key-point"><strong>a</strong> b</div></div>',
  '<table class="comparison"><thead><tr><th colspan="2">A</th></tr></thead><tbody><tr class="comparison-row"><td>1</td><td>2</td></tr></tbody></table>',
  '<p><a href="/903/">RFC 903</a> and <a href="https://www.rfc-editor.org/rfc/rfc903">the text</a> <a href="#x" aria-label="y">z</a></p>',
  '<p>1 < 2 and 3 <= 4 and x<5, plain text</p>',
  '<a href="mailto:a@example.org">m</a>',
  '<br/><hr>',
];

test('unsafe HTML is rejected', () => {
  for (const bad of REJECT) {
    const dir = baseline();
    edit(dir, 826, (j) => { j.sections[0].content = bad; });
    assert.ok(has(lint(dir, index, {}).errors, /826.*unsafe/i), bad);
  }
});

test('legacy and plain markup passes the allowlist', () => {
  for (const good of ACCEPT) {
    const dir = baseline();
    edit(dir, 826, (j) => { j.sections[0].content = good; });
    assert.deepEqual(lint(dir, index, {}).errors, [], good);
  }
});

test('checkHtml: direct allowlist behaviour', () => {
  for (const bad of REJECT) assert.ok(checkHtml(bad).length > 0, bad);
  for (const good of ACCEPT) assert.deepEqual(checkHtml(good), [], good);
});

test('a viz that throws is reported with file and index, not a bare TypeError', () => {
  const dir = baseline();
  edit(dir, 826, (j) => { j.viz = [{ type: 'packet', anchor: 'x', position: 'after', data: {} }]; });
  const r = lint(dir, index, {});
  assert.ok(has(r.errors, /826\.json: \/viz\/0: .*fields/), r.errors.join('\n'));
});

test('unsafe HTML in glossary and journeys', () => {
  const dir = baseline();
  const p = path.join(dir, 'glossary', 'mac-address.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.definition = '<script>x</script>';
  fs.writeFileSync(p, JSON.stringify(j));
  assert.ok(has(lint(dir, index, {}).errors, /mac-address.*unsafe/i));
});

test('journey referencing a non-issued RFC is an error', () => {
  const dir = baseline();
  const p = path.join(dir, 'journeys', 'diskless-boot.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.steps[0].rfcs.push({ number: 2 });
  fs.writeFileSync(p, JSON.stringify(j));
  assert.ok(has(lint(dir, index, {}).errors, /diskless-boot.*\b2\b/));
});

test('--only validates just the named files, and uses .work/glossary', () => {
  const dir = baseline();
  edit(dir, 826, (j) => { j.sections[0].content = '<script>x</script>'; });
  edit(dir, 903, (j) => { j.glossary = ['mac-address', 'draft-term']; });
  const only903 = lint(dir, index, { only: [rfcPath(dir, 903)] });
  assert.ok(has(only903.errors, /draft-term/));
  assert.ok(!has(only903.errors, /826/));
  const work = path.join(dir, '..', '.work', 'glossary');
  // .work lives at the repo root next to content/: contentDir/../.work
  fs.mkdirSync(work, { recursive: true });
  const stub = path.join(work, 'draft-term.json');
  fs.writeFileSync(stub, JSON.stringify({ id: 'draft-term', term: 'Draft', definition: '<p>d</p>' }));
  try {
    const again = lint(dir, index, { only: [rfcPath(dir, 903)] });
    assert.ok(!has(again.errors, /draft-term/), again.errors.join('\n'));
    const full = lint(dir, index, {});
    assert.ok(has(full.errors, /draft-term/));
  } finally {
    fs.rmSync(stub, { force: true });
  }
});

test('index summary shape works as the index argument', () => {
  const dir = baseline();
  const summary = { max: 6000, issued: [826, 903, 5952, 1, 951, 1542, 2131], notIssued: [2] };
  assert.deepEqual(lint(dir, summary, { only: [rfcPath(dir, 903)] }).errors, []);
  edit(dir, 903, (j) => { j.sections[0].content = '<a href="/7000/">x</a>'; });
  assert.ok(has(lint(dir, summary, { only: [rfcPath(dir, 903)] }).errors, /7000/));
});

test('slug collisions with numbers or pages are errors', () => {
  const dir = baseline();
  edit(dir, 903, (j) => { j.slug = 'glossary'; });
  assert.ok(has(lint(dir, index, {}).errors, /slug/i));
  edit(dir, 903, (j) => { j.slug = '826'; });
  assert.ok(has(lint(dir, index, {}).errors, /slug/i));
  edit(dir, 903, (j) => { j.slug = 'rarp'; });
  assert.deepEqual(lint(dir, index, {}).errors, []);
});

test('zero-padded filename is rejected', () => {
  const dir = baseline();
  fs.renameSync(rfcPath(dir, 903), path.join(dir, 'rfcs', '0903.json'));
  assert.ok(has(lint(dir, index, {}).errors, /0903\.json: zero-padded filename; use the plain number/));
});
