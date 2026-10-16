import { feedXml } from '../lib/data-files';
import { getSite } from '../lib/site';
export async function GET() {
  return new Response(feedXml(await getSite()), { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
