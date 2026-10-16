// The fixture site and the /data/* JSON the build derives from it, parsed, for client-script tests that
// mock `fetch`. Using the real encoders (src/lib/data-files.ts) keeps the mocks faithful to the wire format.
import fs from 'node:fs';
import path from 'node:path';
import { dataFiles } from '../src/lib/data-files';
import { buildSite, type Site } from '../src/lib/model';
import { parseIndex } from '../src/lib/rfc-index';
import { must } from './helpers';

const FIX = path.join(process.cwd(), 'test', 'fixtures');

export function fixtureSite(): Site {
  const site = buildSite({
    index: parseIndex(fs.readFileSync(path.join(FIX, 'rfc-index.sample.xml'), 'utf8')),
    contentDir: path.join(FIX, 'content'),
    buildDate: new Date('2026-10-15'),
  });
  // The fixture's RFC 903 has no questions and a different title; give it the real ones.
  const r903 = must(site.rfcs.get(903));
  site.rfcs.set(903, {
    ...r903,
    title: 'A Reverse Address Resolution Protocol',
    content: { ...r903.content, questions: ['how does a diskless computer get an ip address'] },
  });
  return site;
}

/** URL path -> parsed JSON for every data file of the site, e.g. '/data/coverage.json'. */
export function dataRoutes(site: Site = fixtureSite()): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [file, json] of Object.entries(dataFiles(site))) out[`/${file}`] = JSON.parse(json);
  return out;
}
