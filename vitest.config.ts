import { defineConfig } from 'vitest/config';

// Pure-lib and CLI tests. Component tests (W1) use the Astro Container API via getViteConfig from astro/config.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
