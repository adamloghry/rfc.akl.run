import { getSite } from '../lib/site';
import { sitemapUrls, sitemapXml } from '../lib/data-files';
export async function GET() {
  return new Response(sitemapXml(sitemapUrls(await getSite())), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
