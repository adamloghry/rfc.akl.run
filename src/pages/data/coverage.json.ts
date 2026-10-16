import { getSite } from '../../lib/site';
import { coverageJson } from '../../lib/data-files';

export async function GET() {
  return new Response(coverageJson(await getSite()), { headers: { 'Content-Type': 'application/json' } });
}
