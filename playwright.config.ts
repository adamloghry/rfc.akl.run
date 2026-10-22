import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against Cloudflare's local runtime (workerd via `wrangler dev --local`) serving dist/.
 *
 *   npm run build:offline      # dist/ must exist first
 *   npm run test:e2e
 *
 * Env:
 *   WRANGLER_BIN   wrangler executable (default: `wrangler` from PATH; npm's bundled workerd may not run on NixOS)
 *   E2E_BASE_URL   test an already-running server instead (e.g. a preview URL); skips the webServer
 *   PLAYWRIGHT_EXECUTABLE_PATH  use this browser instead of Playwright's download (e.g. a Nix chromium:
 *                   `nix shell nixpkgs#chromium -c env PLAYWRIGHT_EXECUTABLE_PATH=$(which chromium) npm run test:e2e`)
 */
const PORT = 8787;
const external = process.env.E2E_BASE_URL;
const baseURL = external || `http://localhost:${PORT}`;
const wrangler = process.env.WRANGLER_BIN || 'wrangler';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

if (!external && !fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))) {
  throw new Error('dist/ is missing: run `npm run build:offline` (or `npm run build`) before `npm run test:e2e`.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    permissions: [],
    // Containers and the Nix build sandbox have a tiny /dev/shm; without this Chromium crashes mid-test
    // ("Target page, context or browser has been closed").
    launchOptions: { args: ['--disable-dev-shm-usage'], ...(executablePath ? { executablePath } : {}) },
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    // chromium with a phone-sized viewport (not the Pixel device profile, which needs no extra browser)
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `${wrangler} dev --local --port ${PORT}`,
        url: `http://localhost:${PORT}/rfc903`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
          ...(process.env as Record<string, string>),
          WRANGLER_SEND_METRICS: 'false',
          CI: '1',
        },
      },
});
