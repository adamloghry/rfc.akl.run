import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { mergeGlossary } from '../scripts/merge-glossary';

test('merge-glossary: new, existing, duplicates, rejects', () => {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'mg-'));
  const workDir = path.join(root, 'work');
  const outDir = path.join(root, 'out');
  fs.mkdirSync(workDir);
  fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'arp.json'), JSON.stringify({ id: 'arp', term: 'ARP', definition: '<p>keep</p>', rfcs: [826] }));
  const w = (n: number, a: unknown) => fs.writeFileSync(path.join(workDir, `${n}.json`), JSON.stringify(a));
  w(791, [
    { id: 'datagram', term: 'Datagram', definition: '<p>short</p>', plainLanguage: 'a' },
    { id: 'arp', term: 'ARP', definition: '<p>longer replacement</p>', plainLanguage: 'x' },
    { id: 'Bad_Id', term: 'x', definition: '<p>x</p>' },
    { id: 'evil', term: 'Evil', definition: '<script>alert(1)</script>' },
  ]);
  w(793, [{ id: 'datagram', term: 'Datagram2', definition: '<p>the longest definition</p>', plainLanguage: 'b' }]);
  const r = mergeGlossary({ workDir, outDir });
  assert.equal(r.created, 1);
  assert.equal(r.updated, 1);
  assert.equal(r.rejected.length, 2);
  const d = JSON.parse(fs.readFileSync(path.join(outDir, 'datagram.json'), 'utf8'));
  assert.deepEqual(d, {
    id: 'datagram',
    term: 'Datagram2',
    definition: '<p>the longest definition</p>',
    plainLanguage: 'b',
    rfcs: [791, 793],
  });
  const a = JSON.parse(fs.readFileSync(path.join(outDir, 'arp.json'), 'utf8'));
  assert.equal(a.definition, '<p>keep</p>');
  assert.deepEqual(a.rfcs, [791, 826]);
  assert.ok(!fs.existsSync(path.join(outDir, 'evil.json')));
  assert.ok(fs.readFileSync(path.join(outDir, 'datagram.json'), 'utf8').endsWith('}\n'));
});
