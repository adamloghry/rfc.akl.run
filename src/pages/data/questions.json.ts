import { getSite } from '../../lib/site';
import { questionsJson } from '../../lib/data-files';

export async function GET() {
  return new Response(questionsJson(await getSite()), { headers: { 'Content-Type': 'application/json' } });
}
