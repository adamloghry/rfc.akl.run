import { defineConfig } from 'vitest/config';

// Two projects: plain-Vite tests (pure libs, CLI scripts, client scripts under happy-dom) and Astro
// component tests (*.astro.test.ts), which need Astro's Vite plugins for the Container API
// (see vitest.viz.config.ts). Client-script tests opt in to happy-dom per file with
// `// @vitest-environment happy-dom`; everything else runs in plain node.
export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.astro.test.ts', '**/node_modules/**'],
          environment: 'node',
        },
      },
      './vitest.viz.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: 'coverage',
      // `include` makes untested files show up as 0% instead of being silently absent.
      include: ['src/lib/**/*.ts', 'src/scripts/**/*.ts'],
      exclude: [
        // Needs the virtual `astro:content` module, which only exists inside an Astro build; the
        // logic it wraps (buildSite, resolveBuildDate) is covered directly.
        'src/lib/site.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        'src/lib/**': { lines: 90, statements: 90, branches: 80, functions: 90 },
        'src/scripts/**': { lines: 80 },
      },
    },
  },
});
