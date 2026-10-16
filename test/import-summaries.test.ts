// @ts-nocheck -- ported from node:test; vitest does not type-check
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { importSummaries, validateItem, rfcMentions } from '../scripts/import-summaries';

const HERE = process.cwd() + '/test';

const NUMS = [1, 903, 826, 5952];
const index = { entries: new Map(NUMS.map((n) => [n, { number: n }])), notIssued: new Set(), max: 6000 };

function setup(batchNums = [1, 903, 5952]) {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'imp-'));
  const work = path.join(root, 'summaries');
  const content = path.join(root, 'content');
  fs.mkdirSync(path.join(work, 'in'), { recursive: true });
  fs.mkdirSync(path.join(work, 'out'), { recursive: true });
  fs.mkdirSync(path.join(content, 'rfcs'), { recursive: true });
  fs.writeFileSync(path.join(work, 'in', 'batch-001.json'), JSON.stringify(batchNums.map((n) => ({ number: n, title: 't', guessedCategory: 'core' }))));
  return { root, work, content };
}
const item = (n, over = {}) => ({
  number: n, shortTitle: 'Short', category: 'core',
  summary: '<p>This RFC does a thing. It exists for a reason.</p>',
  eli5: '<p>It is like a note passed in class.</p>',
  questions: ['what is this thing'], ...over,
});
const part = (w, k, items) => fs.writeFileSync(path.join(w, 'out', `batch-001.part-${k}.json`), JSON.stringify(items));
const run = (s, extra = {}) => importSummaries({ workDir: s.work, contentDir: s.content, index, date: '2026-10-15', ...extra });
const read = (s, n) => JSON.parse(fs.readFileSync(path.join(s.content, 'rfcs', n + '.json'), 'utf8'));
const rawRead = (s, n) => fs.readFileSync(path.join(s.content, 'rfcs', n + '.json'), 'utf8');

test('creates new files with provenance and key order', async () => {
  const s = setup();
  part(s.work, 1, [item(1), item(903), item(5952, { shortTitle: null, category: 'security' })]);
  const r = await run(s);
  assert.equal(r.rejects.length, 0);
  const j = read(s, 903);
  assert.deepEqual(Object.keys(j), ['number', 'shortTitle', 'category', 'categoryReviewed', 'summary', 'eli5', 'questions', 'provenance', 'updated']);
  assert.equal(j.categoryReviewed, false);
  assert.deepEqual(j.eli5, { summary: '<p>It is like a note passed in class.</p>' });
  assert.deepEqual(j.provenance, { source: 'llm-draft', model: 'claude-sonnet-5-5', drafted: '2026-10-15', reviewedBy: null });
  assert.equal(j.updated, '2026-10-15');
  assert.ok(rawRead(s, 903).endsWith('}\n'));
  assert.ok(rawRead(s, 903).includes('\n  "number"'));
  assert.equal(read(s, 5952).shortTitle, null);
  const changes = JSON.parse(fs.readFileSync(path.join(s.work, 'category-changes.json'), 'utf8'));
  assert.deepEqual(changes.map((c) => c.number), [5952]);
});

test('legacy file keeps category/shortTitle/categoryReviewed and key order, gains new keys', async () => {
  const s = setup([1]);
  const legacy = { number: 1, title: 'Host Software', shortTitle: 'First RFC', category: 'meta', categoryReviewed: true, featured: false, obsoletedBy: null };
  fs.writeFileSync(path.join(s.content, 'rfcs', '1.json'), JSON.stringify(legacy));
  part(s.work, 1, [item(1)]);
  await run(s);
  const j = read(s, 1);
  assert.equal(j.category, 'meta');
  assert.equal(j.shortTitle, 'First RFC');
  assert.equal(j.categoryReviewed, true);
  assert.deepEqual(Object.keys(j), ['number', 'title', 'shortTitle', 'category', 'categoryReviewed', 'featured', 'obsoletedBy', 'summary', 'eli5', 'questions', 'provenance', 'updated']);
});

test('legacy file without categoryReviewed does not gain one', async () => {
  const s = setup([1]);
  fs.writeFileSync(path.join(s.content, 'rfcs', '1.json'), JSON.stringify({ number: 1, title: 'x', category: 'meta' }));
  part(s.work, 1, [item(1)]);
  await run(s);
  assert.equal('categoryReviewed' in read(s, 1), false);
  assert.equal(read(s, 1).shortTitle, 'Short');
});

test('skips files that have sections; deep-merges eli5; never overwrites', async () => {
  const s = setup([1, 903]);
  const withSections = { number: 1, sections: [{ id: 'a', title: 'A', content: '<p>x</p>' }] };
  fs.writeFileSync(path.join(s.content, 'rfcs', '1.json'), JSON.stringify(withSections));
  fs.writeFileSync(path.join(s.content, 'rfcs', '903.json'), JSON.stringify({ number: 903, summary: '<p>mine</p>', eli5: { other: 'x' } }));
  part(s.work, 1, [item(1), item(903)]);
  const r = await run(s);
  assert.deepEqual(read(s, 1), withSections);
  assert.equal(r.skipped.length, 1);
  const j = read(s, 903);
  assert.equal(j.summary, '<p>mine</p>');
  assert.deepEqual(j.eli5, { other: 'x', summary: '<p>It is like a note passed in class.</p>' });
});

test('rejects bad items, merges good ones, writes rejects.json', async () => {
  const s = setup([1, 903, 826, 5952]);
  part(s.work, 1, [
    item(1, { category: 'bogus' }),
    item(903, { summary: '<p>' + 'word '.repeat(91) + '</p>' }),
    item(826, { summary: '<p>ok</p><script>alert(1)</script>' }),
    item(5952),
    item(77777),
  ]);
  const r = await run(s);
  assert.deepEqual(r.rejects.map((x) => x.number).sort((a, b) => a - b), [1, 826, 903, 77777]);
  assert.ok(fs.existsSync(path.join(s.content, 'rfcs', '5952.json')));
  assert.equal(fs.existsSync(path.join(s.content, 'rfcs', '1.json')), false);
  const rej = JSON.parse(fs.readFileSync(path.join(s.work, 'rejects.json'), 'utf8'));
  assert.equal(rej.length, 4);
});

test('validateItem limits', () => {
  const ok = (over) => validateItem(item(1, over), { index }).length === 0;
  assert.ok(ok({}));
  assert.ok(!ok({ shortTitle: 'x'.repeat(25) }));
  assert.ok(ok({ shortTitle: 'x'.repeat(24) }));
  assert.ok(!ok({ summary: '<p onclick="x">hi there</p>' }));
  assert.ok(!ok({ summary: '<p>a</p><p>b</p><p>c</p>' }));
  assert.ok(ok({ summary: '<p>a <em>b</em> <code>c</code></p><p>d <strong>e</strong></p>' }));
  assert.ok(!ok({ summary: 'no tags' }));
  assert.ok(!ok({ summary: '<p>unclosed' }));
  assert.ok(!ok({ summary: '<p><a href="x">l</a></p>' }));
  assert.ok(!ok({ eli5: '<p>a</p><p>b</p>' }));
  assert.ok(!ok({ eli5: '<p>' + 'w '.repeat(51) + '</p>' }));
  assert.ok(ok({ eli5: '<p>' + 'w '.repeat(50) + '</p>' }));
  assert.ok(!ok({ questions: [] }));
  assert.ok(!ok({ questions: ['a', 'b', 'c', 'd'] }));
  assert.ok(!ok({ questions: ['what is it?'] }));
  assert.ok(!ok({ questions: ['What is it'] }));
  assert.ok(!ok({ questions: [5] }));
  assert.ok(!ok({ category: 'Core' }));
  assert.ok(!ok({ extra: 1 }));
  assert.ok(ok({ summary: '<p>See RFC 826 and RFCs 903, 5952.</p>' }));
  assert.ok(!ok({ summary: '<p>See RFC 9999.</p>' }));
  assert.ok(!ok({ eli5: '<p>Like RFC 4242.</p>' }));
});

test('idempotent second run', async () => {
  const s = setup();
  part(s.work, 1, [item(1), item(903), item(5952, { category: 'security' })]);
  await run(s);
  const snap = [1, 903, 5952].map((n) => rawRead(s, n));
  const ch = fs.readFileSync(path.join(s.work, 'category-changes.json'), 'utf8');
  const r2 = await run(s, { date: '2027-01-01' });
  assert.deepEqual([1, 903, 5952].map((n) => rawRead(s, n)), snap);
  assert.equal(fs.readFileSync(path.join(s.work, 'category-changes.json'), 'utf8'), ch);
  assert.equal(r2.rejects.length, 0);
});

test('check mode: ok / problems, writes nothing', async () => {
  const s = setup();
  part(s.work, 1, [item(1), item(903), item(5952)]);
  let r = await run(s, { check: '001' });
  assert.equal(r.ok, true);
  assert.equal(r.count, 3);
  assert.equal(fs.existsSync(path.join(s.content, 'rfcs', '903.json')), false);
  assert.equal(fs.existsSync(path.join(s.work, 'rejects.json')), false);
  part(s.work, 1, [item(1), item(903)]); // 5952 missing
  r = await run(s, { check: '001' });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /5952/);
  part(s.work, 1, [item(1), item(903), item(5952), item(1)]); // duplicate
  r = await run(s, { check: '001' });
  assert.equal(r.ok, false);
});

test('check mode rejects unexpected part files, bad json and oversize parts', async () => {
  const s = setup();
  part(s.work, 1, [item(1), item(903), item(5952)]);
  part(s.work, 5, []);
  assert.equal((await run(s, { check: '001' })).ok, false);
  fs.rmSync(path.join(s.work, 'out', 'batch-001.part-5.json'));
  fs.writeFileSync(path.join(s.work, 'out', 'batch-001.part-2.json'), '{not json');
  assert.equal((await run(s, { check: '001' })).ok, false);
  fs.rmSync(path.join(s.work, 'out', 'batch-001.part-2.json'));
  assert.equal((await run(s, { check: '001' })).ok, true);
  const s2 = setup(Array.from({ length: 30 }, (_, i) => i + 1));
  const many = Array.from({ length: 30 }, (_, i) => item(i + 1));
  const idx2 = { entries: new Map(many.map((x) => [x.number, {}])), notIssued: new Set(), max: 99 };
  part(s2.work, 1, many);
  assert.equal((await importSummaries({ workDir: s2.work, contentDir: s2.content, index: idx2, check: '001' })).ok, false);
});

test('fix1: no temp files left, create path never clobbers a file that appears', async () => {
  const s = setup([903]);
  part(s.work, 1, [item(903)]);
  await run(s);
  assert.deepEqual(fs.readdirSync(path.join(s.content, 'rfcs')), ['903.json']);
  // pre-existing file (as if created concurrently) is merged, not overwritten
  const s2 = setup([903]);
  fs.writeFileSync(path.join(s2.content, 'rfcs', '903.json'), JSON.stringify({ number: 903, title: 'keep' }));
  part(s2.work, 1, [item(903)]);
  await importSummaries({ workDir: s2.work, contentDir: s2.content, index, date: '2026-10-15' });
  assert.equal(read(s2, 903).title, 'keep');
  assert.ok(read(s2, 903).summary);
});

test('fix2: torn/invalid existing file is a reject, not an abort', async () => {
  const s = setup([1, 903]);
  fs.writeFileSync(path.join(s.content, 'rfcs', '1.json'), '{"number": 1, "tit');
  part(s.work, 1, [item(1), item(903)]);
  const r = await run(s);
  assert.deepEqual(r.rejects.map((x) => x.number), [1]);
  assert.match(r.rejects[0].problems[0], /unreadable/);
  assert.equal(rawRead(s, 1), '{"number": 1, "tit');
  assert.ok(read(s, 903).summary);
  const rej = JSON.parse(fs.readFileSync(path.join(s.work, 'rejects.json'), 'utf8'));
  assert.equal(rej.length, 1);
});

test('fix4: provenance/updated only when summary was filled', async () => {
  const s = setup([903]);
  fs.writeFileSync(path.join(s.content, 'rfcs', '903.json'), JSON.stringify({ number: 903, summary: '<p>human</p>', provenance: { source: 'human' } }));
  part(s.work, 1, [item(903)]);
  await run(s);
  const j = read(s, 903);
  assert.deepEqual(j.provenance, { source: 'human' });
  assert.equal('updated' in j, false);
  assert.equal(j.summary, '<p>human</p>');
  assert.deepEqual(j.questions, ['what is this thing']);
  const s2 = setup([903]);
  fs.writeFileSync(path.join(s2.content, 'rfcs', '903.json'), JSON.stringify({ number: 903, summary: '<p>human</p>' }));
  part(s2.work, 1, [item(903)]);
  await run(s2);
  assert.equal('provenance' in read(s2, 903), false);
});

test('fix5: rfc mention forms', () => {
  assert.deepEqual(rfcMentions('RFC 1, 2 and 5000').sort((a, b) => a - b), [1, 2, 5000]);
  assert.deepEqual(rfcMentions('see RFC-1234 and RFCs 7, 8'), [1234, 7, 8]);
  assert.ok(validateItem(item(1, { summary: '<p>See RFC-9999 now.</p>' }), { index }).length > 0);
  assert.ok(validateItem(item(1, { summary: '<p>See RFC 826 and 9998.</p>' }), { index }).length > 0);
});

test('fix3: make-summary-batches refuses to overwrite without --force', () => {
  const root = process.cwd();
  const guarded = fs.existsSync(path.join(root, '.work', 'explainer-targets.json'));
  if (!guarded) return; // nothing to protect in this checkout; running would write real files
  const r = spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'scripts', 'make-summary-batches.ts')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refusing/);
});
