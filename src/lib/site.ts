import { getCollection } from 'astro:content';
import { resolveBuildDate } from './build-date';
import type { Journey, Site } from './model';
import { buildSite } from './model';
import { loadIndex } from './rfc-index';

let cached: Promise<Site> | null = null;

/** The merged site model (RFC index + content collections). Memoized per build process. */
export function getSite(): Promise<Site> {
  if (!cached) cached = load();
  return cached;
}

async function load(): Promise<Site> {
  const index = loadIndex();
  const [rfcs, journeys, glossary] = await Promise.all([getCollection('rfcs'), getCollection('journeys'), getCollection('glossary')]);
  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return buildSite({
    index,
    contentDir: 'content',
    buildDate: resolveBuildDate(),
    rfcs: rfcs.map((e) => e.data),
    journeys: [...journeys].sort(byId).map((e) => e.data as Journey),
    glossary: [...glossary].sort(byId).map((e) => e.data),
  });
}
