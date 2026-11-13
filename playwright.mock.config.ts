import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// These specs intercept every API operation they assert. A dedicated server
// enables the API code path without enabling or contacting a real project.
process.env.VITE_SUPABASE_URL = 'https://fixture.supabase.test';
process.env.VITE_SUPABASE_ANON_KEY = 'fixture-only-public-key';
export default defineConfig({
  ...base,
  projects: base.projects?.filter(project => project.name !== 'mobile-chromium'),
  testIgnore: [],
  testMatch: ['**/admin-operations.spec.ts', '**/discovery.spec.ts'],
  grep: /Admin|mocked catalog/,
  grepInvert: /@live/,
  use: { ...base.use, baseURL: 'http://localhost:5175' },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    },
  },
});
