import { coverageJson } from '../../lib/data-files';
import { getSite } from '../../lib/site';

export async function GET() {
  return new Response(coverageJson(await getSite()), { headers: { 'Content-Type': 'application/json' } });
}
