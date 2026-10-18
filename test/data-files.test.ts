import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import {
  coverageJson,
  dataFiles,
  graphJson,
  questionsJson,
  redirectsFile,
  robotsTxt,
  sitemapUrls,
  sitemapXml,
  titleShards,
} from '../src/lib/data-files';
import { buildSite } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import { glossarySchema, journeySchema, rfcSchema } from '../src/lib/schemas';
import { must } from './helpers';

const HERE = `${process.cwd()}/test`;
const site = buildSite({
  index: parseIndex(fs.readFileSync(path.join(HERE, 'fixtures', 'rfc-index.sample.xml'), 'utf8')),
  contentDir: path.join(HERE, 'fixtures', 'content'),
  buildDate: new Date('2026-10-15T00:00:00Z'),
});

test('coverage.json packs state and category per number', () => {
  const c = JSON.parse(coverageJson(site));
  assert.equal(c.max, site.max);
  assert.equal(c.buildDate, '2026-10-15');
  const cells = Buffer.from(c.cells, 'base64');
  assert.equal(cells.length, site.max);
  const r = must(site.rfcs.get(903));
  assert.equal(cells[902] & 7, 5); // interactive
  assert.equal(c.categories[cells[902] >> 4], r.category);
});

test('titles shards, questions and graph', () => {
  const t = titleShards(site);
  assert.ok(t['0']);
  assert.deepEqual(
    Object.keys(JSON.parse(t['0'])).every((k) => Number(k) <= 1000),
    true,
  );
  assert.ok(Array.isArray(JSON.parse(questionsJson(site))));
  const g = JSON.parse(graphJson(site));
  for (const v of Object.values<Record<string, unknown>>(g)) assert.ok('o' in v && 'ub' in v && 't' in v && 'y' in v);
});

test('sitemap, robots, redirects', () => {
  const urls = sitemapUrls(site);
  assert.equal(urls[0], '/');
  assert.ok(urls.includes('/rfc903') && urls.includes('/areas/core') && urls.includes('/journeys/diskless-boot'));
  assert.match(sitemapXml(urls), /<loc>https:\/\/rfc.akl.run\/rfc903<\/loc>/);
  assert.equal(robotsTxt(), 'User-agent: *\nAllow: /\n\nSitemap: https://rfc.akl.run/sitemap.xml\n');
  assert.doesNotMatch(redirectsFile(site), /rfc:num|^\/404 /m);
});

test('dataFiles covers coverage, titles, questions, graph and the search index', () => {
  const files = Object.keys(dataFiles(site));
  for (const f of [
    'data/coverage.json',
    'data/titles/0.json',
    'data/questions.json',
    'data/graph.json',
    'data/search/meta.json',
    'data/search/docs.json',
    'data/search/t-00.json',
  ]) {
    assert.ok(files.includes(f), f);
  }
});

test('every content file validates against the Zod schemas', () => {
  const bad: string[] = [];
  for (const [dir, schema] of [
    ['rfcs', rfcSchema],
    ['journeys', journeySchema],
    ['glossary', glossarySchema],
  ] as const) {
    const d = path.join(process.cwd(), 'content', dir);
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
      const r = schema.safeParse(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')));
      if (!r.success) bad.push(`${dir}/${f}: ${r.error.issues[0].message}`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});
