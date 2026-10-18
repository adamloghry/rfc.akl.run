import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { areasModel, HASH_FORWARDER, journeysModel, rfcPath, SUGGESTIONS, timelineModel } from '../src/components/atlas/atlas-data';
import { buildSite, type Site } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import { decode } from '../src/scripts/atlas';
import { must } from './helpers';

const FIX = path.join(process.cwd(), 'test', 'fixtures');
const site = buildSite({
  index: parseIndex(fs.readFileSync(path.join(FIX, 'rfc-index.sample.xml'), 'utf8')),
  contentDir: path.join(FIX, 'content'),
  buildDate: new Date('2026-10-15'),
});
const withSite = (extra: Partial<Site>): Site => Object.assign(Object.create(Object.getPrototypeOf(site)), site, extra);

test('hash forwarder and 4 suggestions', () => {
  assert.equal(HASH_FORWARDER, "var m=location.hash.match(/^#rfc(\\d+)$/i);if(m)location.replace('/rfc'+(+m[1]));");
  assert.equal(SUGGESTIONS.length, 4);
});

test('journeys: feature + up to 4 cards, zero and no-featured cases', () => {
  const j = journeysModel(site);
  assert.equal(j.feat.slug, 'diskless-boot');
  assert.equal(j.feat.steps.length, 2);
  assert.equal(rfcPath(j.feat).length, 2);
  assert.equal(j.others.length, 0);
  assert.equal(journeysModel(withSite({ journeys: [] })).feat, undefined);
  const mk = (slug: string, f: boolean) => ({
    slug,
    title: slug,
    featured: f,
    steps: [{ title: 's', rfcs: [{ number: 1 }, { number: 2 }] }],
  });
  const many = journeysModel(withSite({ journeys: ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => mk(s, s === 'c')) }));
  assert.equal(many.feat.slug, 'c');
  assert.equal(many.others.length, 4);
  assert.equal(journeysModel(withSite({ journeys: [mk('x', false), mk('y', false)] })).feat.slug, 'x');
});

test('areas: one card per category with covered counts and examples', () => {
  const list = areasModel(site);
  assert.equal(list.length, site.categories.length);
  const r = site.rfcs.get(903);
  assert.ok(r);
  const a = list.find((x) => x.key === r.category);
  assert.ok(a);
  assert.ok(a.count >= 1);
  assert.ok(a.examples.includes(r.shortTitle || r.title));
  assert.match(a.wf, /^\d+\.\d\d%$/);
});

test('timeline: 1969..max year with tooltips', () => {
  const t = timelineModel(site);
  const maxYear = Math.max(...[...site.rfcs.values()].map((r) => r.year));
  assert.equal(t.cols.length, maxYear - 1969 + 1);
  assert.ok(t.cols[1984 - 1969].tip.startsWith('1984: '));
  assert.equal(t.axis.at(-1), maxYear);
});

test('atlas decode: state (status class) and category from the packed byte', () => {
  const b64 = Buffer.from([0x04 | (3 << 4), 0x00, 0x02 | (15 << 4), 0x05 | (0 << 4)]).toString('base64');
  const d = decode(b64);
  assert.deepEqual(Array.from(d.state), [4, 0, 2, 5]);
  assert.deepEqual(Array.from(d.cat), [3, 0, 15, 0]);
});

// Markup assertions against the built page (skipped when dist/ has not been built).
const dist = path.join(process.cwd(), 'dist', 'index.html');
const built = fs.existsSync(dist) ? fs.readFileSync(dist, 'utf8') : '';
const withDist = built ? test : test.skip;

withDist('built index.html: cool palette, site header, inline forwarder in head, hero search', () => {
  assert.ok(built.includes('class="pal-cool"'));
  assert.ok(built.includes('site-header--site'));
  assert.match(built, /<a href="\/" aria-current="page">Home<\/a>/);
  assert.ok(built.indexOf(HASH_FORWARDER) > 0 && built.indexOf(HASH_FORWARDER) < built.indexOf('</head>'));
  assert.ok(built.includes('search-box search-hero'));
  assert.equal((built.match(/class="at-pill"/g) || []).length, 4);
  assert.ok(built.includes('<canvas') && /<noscript>[\s\S]*href="\/areas"[\s\S]*<\/noscript>/.test(built));
  assert.equal((built.match(/class="at-chip"/g) || []).length, 12);
  assert.ok(!built.includes('at-fresh') && !built.includes('at-goal') && !built.includes('at-ladder'));
  assert.ok(!/JUST PUBLISHED|GOAL ·|Coverage report|Follow \(RSS\)/.test(built));
  assert.match(built, /<title>rfc\.akl\.run — how the Internet is engineered<\/title>/);
  const legend = must(/class="at-legend"[\s\S]*?<\/div>/.exec(built))[0];
  for (const label of ['Standard / BCP', 'Informational / Experimental', 'Unknown', 'Historic or obsoleted', 'Not issued or reserved'])
    assert.ok(legend.includes(label), `legend entry ${label}`);
  assert.equal((legend.match(/class="at-sw at-sw-/g) || []).length, 4);
  assert.ok(legend.includes('at-hatch') && !/var\(--cat-|Summary ·|Deep explainer/.test(legend));
  assert.equal((built.match(/class="at-acard"/g) || []).length, 11);
});

test('the status ramp has four tokens per theme, strongest to faintest, and the --cat-* tokens are gone', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');
  assert.ok(!css.includes('--cat-'));
  const light = must(/:root\.pal-cool \{([\s\S]*?)\n\}/.exec(css))[1];
  const dark = must(/:root\.pal-cool\[data-theme='dark'\] \{([\s\S]*?)\n\}/.exec(css))[1];
  for (const [name, block] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    const vals = ['standard', 'informational', 'unknown', 'historic'].map((k) =>
      Number(must(new RegExp(`--map-${k}: oklch\\(([\\d.]+) `).exec(block), `${name} --map-${k}`)[1]),
    );
    assert.equal(new Set(vals).size, 4, `${name}: distinct steps`);
    const faintening = vals.every((v, i) => i === 0 || (name === 'light' ? v > (vals[i - 1] ?? 0) : v < (vals[i - 1] ?? 0)));
    assert.ok(faintening, `${name}: each step is fainter than the one before`);
    assert.ok(block.includes('--map-dim:') && block.includes('--map-empty:'));
  }
});
