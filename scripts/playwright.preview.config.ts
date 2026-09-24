import { defineConfig, devices } from '@playwright/test';

/**
 * Preview-deploy Playwright config: same tests/reporters as playwright.config.ts
 * but pointed at an external preview URL (no local webServer) and chromium only.
 *
 * baseURL comes from PLAYWRIGHT_BASE_URL (set by .github/workflows/preview-gate.yml
 * from vars.PREVIEW_URL / secrets.PREVIEW_URL).
 */
const previewBaseUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.PREVIEW_URL || '';

if (!previewBaseUrl) {
  throw new Error(
    'PLAYWRIGHT_BASE_URL (or PREVIEW_URL) must be set to run the preview gate config.',
  );
}

export default defineConfig({
  testDir: '../tests/e2e',
  outputDir: '../test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../playwright-report' }],
    ['github'],
    ['junit', { outputFile: '../test-results/junit.xml' }],
  ],
  grepInvert: /@live/,
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: previewBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
