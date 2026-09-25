import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Code splitting strategy for better caching.
    // Vite 8 bundles with Rolldown, where the function form of
    // output.manualChunks is deprecated and its @supabase branch never
    // materialized (supabase-js stayed glued inside context-auth).
    // advancedChunks is the supported Rolldown API - same grouping,
    // explicit priorities so the narrowest test wins.
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: 'supabase',
              priority: 90,
              test: (id: string) => {
                const n = id.replace(/\\/g, '/');
                return n.includes('lib/supabase') || n.includes('node_modules/@supabase/');
              },
            },
            {
              name: 'vendor-react',
              priority: 80,
              test: (id: string) =>
                /node_modules\/(react|react-dom|scheduler)\//.test(id.replace(/\\/g, '/')),
            },
            {
              name: 'vendor-ui',
              priority: 70,
              test: (id: string) => id.replace(/\\/g, '/').includes('node_modules/lucide-react/'),
            },
            {
              name: 'context-auth',
              priority: 60,
              test: (id: string) => id.includes('AuthContext'),
            },
            {
              name: 'context-cart',
              priority: 60,
              test: (id: string) => id.includes('CartContext'),
            },
            {
              name: 'context-other',
              priority: 60,
              test: (id: string) =>
                id.includes('ToastContext') ||
                id.includes('WishlistContext') ||
                id.includes('QuickViewContext') ||
                id.includes('BrowsingHistoryContext'),
            },
            {
              name: 'vendor',
              priority: 50,
              test: (id: string) => id.replace(/\\/g, '/').includes('node_modules'),
            },
          ],
        },
      },
    },

    // Optimize chunk sizes
    chunkSizeWarningLimit: 500,

    // Source maps exist only for Sentry symbolication: CI sets SENTRY_UPLOAD=1
    // before building so .js.map files can be uploaded, then they are never
    // emitted for the Vercel deployment (Vercel builds without the flag).
    sourcemap: process.env.SENTRY_UPLOAD ? 'hidden' : false,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/*.config.{js,ts,cjs,mjs}',
      'tests/e2e/**',
      'tests/fixtures/**',
      // Deno-only suites (Deno.test) — must not run under vitest/jsdom
      'tests/deno/**',
      'supabase/**/*.test.ts',
      '**/Nervee.shop/**',
      // Agent/worktree scratch dirs: they contain duplicate copies of src/,
      // which would otherwise run the same specs twice (and report failures
      // against files that are not part of this project's source).
      '**/.kilo/**',
      '**/.freebuff/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
      exclude: [
        'node_modules/',
        'src/test/',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'dist/',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'Nervee.shop/**',
        '.kilo/**',
        '.freebuff/**',
      ],
    },
  },
});
