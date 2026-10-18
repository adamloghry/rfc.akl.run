import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { migrateDirs, migrateText } from '../scripts/migrate-urls';

test('rewrites only internal RFC href attributes, keeping fragments and quote styles', () => {
  const src = String.raw`"content": "<a href=\"/903/\">a</a> <a href='/0826/#sec-1'>b</a> <a href=\"/951\">c</a> <a href=\"/areas/core\">d</a> <a href=\"https://x.org/12/\">e</a> code '/3802/' and /903/ text <a href=\"/edit/5\">f</a> <a href=\"/903/x\">g</a>"`;
  const { text, count } = migrateText(src);
  assert.equal(count, 3);
  assert.ok(text.includes(String.raw`href=\"/rfc903\"`));
  assert.ok(text.includes(`href='/rfc826#sec-1'`));
  assert.ok(text.includes(String.raw`href=\"/rfc951\"`));
  // untouched
  for (const keep of [
    String.raw`href=\"/areas/core\"`,
    String.raw`href=\"https://x.org/12/\"`,
    `'/3802/'`,
    ' /903/ text',
    String.raw`href=\"/edit/5\"`,
    String.raw`href=\"/903/x\"`,
  ])
    assert.ok(text.includes(keep), keep);
});

test('is idempotent and reports counts per directory', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rfc-mig-'));
  const rfcs = path.join(d, 'rfcs');
  fs.mkdirSync(rfcs);
  fs.writeFileSync(path.join(rfcs, '1.json'), String.raw`{"a":"<a href=\"/2/\">x</a><a href=\"/3/#y\">z</a>"}`);
  fs.writeFileSync(path.join(rfcs, '2.json'), '{"a":"no links"}');
  const first = migrateDirs([rfcs], true);
  assert.deepEqual({ files: first.files, changedFiles: first.changedFiles, links: first.links }, { files: 2, changedFiles: 1, links: 2 });
  assert.equal(fs.readFileSync(path.join(rfcs, '1.json'), 'utf8'), String.raw`{"a":"<a href=\"/rfc2\">x</a><a href=\"/rfc3#y\">z</a>"}`);
  assert.equal(migrateDirs([rfcs], true).links, 0);
  assert.equal(migrateDirs([path.join(d, 'missing')], false).links, 0);
});

test('no content file keeps an old-style href="/<n>/" link', () => {
  const r = migrateDirs(
    ['content/rfcs', 'content/journeys', 'content/glossary'].map((x) => path.resolve(x)),
    false,
  );
  assert.equal(r.links, 0);
});
