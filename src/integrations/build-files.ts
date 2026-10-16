import type { AstroIntegration } from 'astro';

/**
 * Writes dist/_redirects and dist/_headers after the build (Astro's router ignores
 * _-prefixed page files). W1 fills in the astro:build:done hook using
 * redirectsFile(site) / HEADERS_FILE from src/lib/data-files.ts.
 */
export default function siteBuildFiles(): AstroIntegration {
  return {
    name: 'rfc-build-files',
    hooks: {
      // 'astro:build:done': async ({ dir, logger }) => { /* W1: write _redirects and _headers */ },
    },
  };
}
