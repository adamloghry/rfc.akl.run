import type { APIRoute, GetStaticPaths } from 'astro';
import { getSite } from '../../../lib/site';
import { titleShards } from '../../../lib/data-files';

let shards: Promise<Record<string, string>> | null = null;
const getShards = () => (shards ??= getSite().then(titleShards));

export const getStaticPaths: GetStaticPaths = async () =>
  Object.keys(await getShards()).map((k) => ({ params: { k } }));

export const GET: APIRoute = async ({ params }) =>
  new Response((await getShards())[params.k!], { headers: { 'Content-Type': 'application/json' } });
