import { getViteConfig } from 'astro/config';

// Component tests: the Astro Container API needs Astro's Vite plugins.
export default getViteConfig({
  test: { include: ['test/**/*.astro.test.ts'], environment: 'node' },
} as any);
