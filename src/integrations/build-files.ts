import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { loadIndex } from '../lib/rfc-index';
import { buildSite } from '../lib/model';
import { HEADERS_FILE, redirectsFile } from '../lib/data-files';

// The deployed files keep the header comment the legacy generator wrote.
const LEGACY_SOURCE = 'scripts/pages/special.js';
const NEW_SOURCE = 'src/integrations/build-files.ts';
const legacyHeader = (s: string) => s.replace(NEW_SOURCE, LEGACY_SOURCE);

export function redirectsContent(site: Parameters<typeof redirectsFile>[0]): string {
  return legacyHeader(redirectsFile(site));
}
export const headersContent = (): string => legacyHeader(HEADERS_FILE);

/**
 * Writes dist/_redirects and dist/_headers after the build (Astro's router ignores
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
      },
    },
  };
}
