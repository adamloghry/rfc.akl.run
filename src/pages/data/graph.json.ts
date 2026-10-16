import { getSite } from '../../lib/site';
import { graphJson } from '../../lib/data-files';

export async function GET() {
  return new Response(graphJson(await getSite()), { headers: { 'Content-Type': 'application/json' } });
}
