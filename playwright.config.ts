import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs on their own port so the config below can supply its own dev-server
 * env without disturbing a preview/dev server on the default 5173, and so
 * local runs exercise the same server environment as CI.
 */
const E2E_PORT = 5174
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
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
  ],

  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120000,
  },
})