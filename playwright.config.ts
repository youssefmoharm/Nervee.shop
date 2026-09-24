import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs on their own port so the config below can supply its own dev-server
 * env without disturbing a preview/dev server on the default 5173, and so
 * local runs exercise the same server environment as CI.
 */
const E2E_PORT = 5174;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/**
 * `@live`-tagged specs (tests/e2e/live-smoke.spec.ts, security-idor.spec.ts)
 * hit the production site / live Supabase backend directly. They are excluded
 * from regular runs (grepInvert) so CI never depends on production.
 * The nightly live-smoke.yml workflow sets PLAYWRIGHT_LIVE=1 and runs
 * `npx playwright test --grep @live` to execute ONLY those specs.
 */
const LIVE = process.env.PLAYWRIGHT_LIVE === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [['html'], ['github'], ['junit', { outputFile: 'test-results/junit.xml' }]],
  grepInvert: LIVE ? undefined : /@live/,
  timeout: 30000, // Increase test timeout
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
