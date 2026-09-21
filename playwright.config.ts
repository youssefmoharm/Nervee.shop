import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs on their own port so the config below can supply its own dev-server
 * env without disturbing a preview/dev server on the default 5173, and so
 * local runs exercise the same server environment as CI.
 */
const E2E_PORT = 5174
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`

/**
 * Try-on E2E sandbox (DEV server only).
 *
 * Neither value is a credential: the "token" is a literal placeholder that
 * cannot authenticate against Snap, and the lens ids belong to no real lens.
 * They only let the storefront resolve a lens for one product so the gating,
 * QR and modal states can be asserted deterministically. Passed to the dev
 * server as VITE_TRYON_DEV_CONFIG (see src/lib/tryOnConfig.ts), which is
 * ignored by production builds — so real AR still requires real Snap
 * credentials, and the live-session path still fails honestly here.
 */
const E2E_TRYON_SANDBOX = {
  apiToken: 'e2e-sandbox-token-not-a-credential',
  lenses: {
    'nerve-oversized-tee': {
      lensId: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
      lensGroupId: '1a2b3c4d5e6f708192a3b4c5d6e7f809',
    },
  },
}

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
    // Always start our own server: a server started elsewhere (e.g. the
    // preview on 5173) would not have the try-on sandbox env below.
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      // DEV-only sandbox (src/lib/tryOnConfig.ts): one product gets a lens so
      // try-on gating/QR/modal states can be asserted deterministically.
      VITE_TRYON_DEV_CONFIG: JSON.stringify(E2E_TRYON_SANDBOX),
    },
  },
})