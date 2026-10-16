import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { loadIndex } from '../lib/rfc-index';
import { buildSite } from '../lib/model';
import { HEADERS_FILE, redirectsFile } from '../lib/data-files';

// Header comment of the generated _redirects/_headers files (HEADERS_FILE/redirectsFile in data-files.ts).
export const redirectsContent = (site: Parameters<typeof redirectsFile>[0]): string => redirectsFile(site);
export const headersContent = (): string => HEADERS_FILE;

/**
 * The error page is authored at /not-found/ (the /404 route belongs to RFC 404 in [n].astro).
 * Cloudflare's `not_found_handling: "404-page"` serves /404.html, so move the built page there.
 */
export function finalizeErrorPage(out: string): void {
  const src = path.join(out, 'not-found', 'index.html');
  fs.copyFileSync(src, path.join(out, '404.html'));
  fs.rmSync(path.join(out, 'not-found'), { recursive: true, force: true });
}

/**
 * Writes dist/_redirects, dist/_headers and dist/404.html after the build (Astro's router ignores
 * _-prefixed page files). The hook cannot use astro:content, so the site model is built
 * straight from content/ on disk.
 */
export default function siteBuildFiles(): AstroIntegration {
  return {
    name: 'rfc-build-files',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const out = fileURLToPath(dir);
        const index = await loadIndex({ offline: process.env.RFC_OFFLINE === '1', cacheDir: '.cache' });
        const site = buildSite({ index, contentDir: path.join(process.cwd(), 'content'), buildDate: new Date() });
        fs.writeFileSync(path.join(out, '_redirects'), redirectsContent(site));
        fs.writeFileSync(path.join(out, '_headers'), headersContent());
        finalizeErrorPage(out);
      },
    },
  };
}
