import { getSite } from '../lib/site';
import { feedXml } from '../lib/data-files';
export async function GET() {
  return new Response(feedXml(await getSite()), { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
