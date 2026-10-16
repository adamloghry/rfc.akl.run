import { defineConfig } from 'astro/config';
import siteBuildFiles from './src/integrations/build-files.ts';

export default defineConfig({
  site: 'https://rfc.akl.run',
  output: 'static',
  trailingSlash: 'always',
  outDir: 'dist',
  compressHTML: true,
  build: {
    format: 'directory',
    assets: 'assets',
  },
  integrations: [siteBuildFiles()],
  vite: {
    build: {
      // Fonts and small assets must stay files (hashed under /assets/), never data: URIs.
      assetsInlineLimit: 0,
    },
  },
});
