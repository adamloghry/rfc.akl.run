import { graphJson } from '../../lib/data-files';
import { getSite } from '../../lib/site';

export async function GET() {
  return new Response(graphJson(await getSite()), { headers: { 'Content-Type': 'application/json' } });
}
