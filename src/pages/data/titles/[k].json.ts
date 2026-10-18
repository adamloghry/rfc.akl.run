import type { APIRoute, GetStaticPaths } from 'astro';
import { titleShards } from '../../../lib/data-files';
import { getSite } from '../../../lib/site';

let shards: Promise<Record<string, string>> | null = null;
const getShards = () => (shards ??= getSite().then(titleShards));

export const getStaticPaths: GetStaticPaths = async () => Object.keys(await getShards()).map((k) => ({ params: { k } }));

export const GET: APIRoute = async ({ params }) =>
  new Response((await getShards())[params.k as string], { headers: { 'Content-Type': 'application/json' } });
