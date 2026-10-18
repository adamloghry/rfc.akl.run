import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { resolveBuildDate } from '../lib/build-date';
import { cspHash, type HeadersOptions, headersFile, redirectsFile } from '../lib/data-files';
import { buildSite } from '../lib/model';
import { loadIndex } from '../lib/rfc-index';

// Header comment of the generated _redirects/_headers files (headersFile/redirectsFile in data-files.ts).
export const redirectsContent = (site: Parameters<typeof redirectsFile>[0]): string => redirectsFile(site);
export const headersContent = (o: HeadersOptions = {}): string => headersFile(o);

const SCRIPT_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const STYLE_RE = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi;
const JSON_TYPE_RE = /\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap)/i;

/** Hashes of every executable inline <script> and every inline <style> found in the built HTML. */
export function collectInlineHashes(dir: string): {
  scriptHashes: string[];
  styleHashes: string[];
} {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.html')) {
        const html = fs.readFileSync(f, 'utf8');
        for (const m of html.matchAll(SCRIPT_RE)) {
          const attrs = m[1] || '';
          if (/\bsrc\s*=/i.test(attrs) || JSON_TYPE_RE.test(attrs) || !m[2].trim()) continue;
          scripts.add(cspHash(m[2]));
        }
        for (const m of html.matchAll(STYLE_RE)) if (m[2].trim()) styles.add(cspHash(m[2]));
      }
    }
  };
  walk(dir);
  return { scriptHashes: [...scripts].sort(), styleHashes: [...styles].sort() };
}

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
        const index = loadIndex();
        const site = buildSite({
          index,
          contentDir: path.join(process.cwd(), 'content'),
          buildDate: resolveBuildDate(),
        });
        fs.writeFileSync(path.join(out, '_redirects'), redirectsContent(site));
        fs.writeFileSync(
          path.join(out, '_headers'),
          headersContent({
            ...collectInlineHashes(out),
            beaconToken: process.env.PUBLIC_CF_BEACON_TOKEN?.trim() || undefined,
          }),
        );
      },
    },
  };
}
