import type { APIRoute, GetStaticPaths } from 'astro';
import { getSite } from '../../../lib/site';
import { searchFiles } from '../../../lib/data-files';

// Memoized: every shard endpoint shares one index build.
let files: Promise<Record<string, string>> | null = null;
const getFiles = () => (files ??= getSite().then(searchFiles));

export const getStaticPaths: GetStaticPaths = async () =>
  Object.keys(await getFiles()).map((name) => ({ params: { file: name.replace(/\.json$/, '') } }));

export const GET: APIRoute = async ({ params }) =>
  new Response((await getFiles())[`${params.file}.json`], { headers: { 'Content-Type': 'application/json' } });
