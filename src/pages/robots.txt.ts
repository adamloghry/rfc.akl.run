import { robotsTxt } from '../lib/data-files';
export const GET = () => new Response(robotsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
