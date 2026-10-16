import { defineConfig } from 'vitest/config';

// Two projects: plain-Vite tests (pure libs, CLI scripts) and Astro component tests (*.astro.test.ts),
// which need Astro's Vite plugins for the Container API (see vitest.viz.config.ts).
export default defineConfig({
  test: {
    projects: [
      { extends: false, test: { name: 'unit', include: ['test/**/*.test.ts'], exclude: ['test/**/*.astro.test.ts', '**/node_modules/**'], environment: 'node' } },
      './vitest.viz.config.ts',
    ],
  },
});
