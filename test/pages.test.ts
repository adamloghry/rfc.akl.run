import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { DESCRIPTIONS, groups, indexBlocks, strip, tally } from '../src/components/pages/util';
import { buildSite, type RfcRecord } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';

const HERE = `${process.cwd()}/test`;
const site = buildSite({
  index: parseIndex(fs.readFileSync(path.join(HERE, 'fixtures', 'rfc-index.sample.xml'), 'utf8')),
  contentDir: path.join(HERE, 'fixtures', 'content'),
  buildDate: new Date('2026-10-15'),
});

test('areas: eleven categories each with a description; groups cover all RFCs', () => {
  assert.equal(site.categories.length, 11);
  for (const c of site.categories) assert.ok(DESCRIPTIONS[c.key], c.key);
  const g = groups(site);
  assert.equal(
    [...g.values()].reduce((a, l) => a + l.length, 0),
    site.rfcs.size,
  );
  const t = tally([...site.rfcs.values()]);
  assert.equal(t.total, site.counts.total);
  assert.equal(t.interactive, site.counts.interactive);
});

test('areas: index blocks paginate per 1000', () => {
  const list: Array<Pick<RfcRecord, 'number'>> = [];
  for (let n = 1; n <= 2500; n++) list.push({ number: n });
  // indexBlocks only reads `number`, so bare stand-ins are enough.
  const { blocks } = indexBlocks(list as RfcRecord[]);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[2][1].length, 500);
});

test('helpers', () => {
  assert.equal(strip('<p>a  <b>b</b></p>'), 'a b');
});

test('graph client script: bundled module, fetches graph.json, no legacy globals', () => {
  const ts = fs.readFileSync(path.join(process.cwd(), 'src/scripts/graph.ts'), 'utf8');
  assert.ok(ts.includes('/data/graph.json') && ts.includes('location.hash'));
  assert.ok(!/\brequire\(/.test(ts));
});
