import { getViteConfig } from 'astro/config';

// Component tests: the Astro Container API needs Astro's Vite plugins.
export default getViteConfig({
  // getViteConfig's parameter type only models Vite options; `test` is Vitest's extension of it.
  test: { name: 'astro', include: ['test/**/*.astro.test.ts'], environment: 'node' },
} as Parameters<typeof getViteConfig>[0]);
