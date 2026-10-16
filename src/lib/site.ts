import { getCollection } from 'astro:content';
import { loadIndex } from './rfc-index';
import { buildSite } from './model';
import type { Site } from './model';

let cached: Promise<Site> | null = null;

/** The merged site model (RFC index + content collections). Memoized per build process. */
export function getSite(): Promise<Site> {
  if (!cached) cached = load();
  return cached;
}

async function load(): Promise<Site> {
  const index = await loadIndex({ offline: process.env.RFC_OFFLINE === '1', cacheDir: '.cache' });
  const [rfcs, journeys, glossary] = await Promise.all([
    getCollection('rfcs'), getCollection('journeys'), getCollection('glossary'),
  ]);
  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return buildSite({
    index,
    contentDir: 'content',
    buildDate: new Date(),
    rfcs: rfcs.map((e) => e.data),
    journeys: [...journeys].sort(byId).map((e) => e.data as any),
    glossary: [...glossary].sort(byId).map((e) => e.data),
  });
}
