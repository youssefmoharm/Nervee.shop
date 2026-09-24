import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Code splitting strategy for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Normalize Windows backslashes so path matching works on all platforms
          const n = id.replace(/\\/g, '/');

          // React core
          if (n.includes('node_modules/react/') || n.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // UI Libraries
          if (n.includes('node_modules/lucide-react/')) {
            return 'vendor-ui';
          }
          // Supabase client in separate chunk — check BEFORE AuthContext so
          // supabase-js never lands in the auth chunk on any OS path format.
          if (n.includes('lib/supabase') || n.includes('node_modules/@supabase/')) {
            return 'supabase';
          }

          // Split large contexts to prevent bundle bloat
          if (n.includes('AuthContext')) {
            return 'context-auth';
          }
          if (n.includes('CartContext')) {
            return 'context-cart';
          }
          if (
            n.includes('ToastContext') ||
            n.includes('WishlistContext') ||
            n.includes('QuickViewContext') ||
            n.includes('BrowsingHistoryContext')
          ) {
            return 'context-other';
          }

          // Catch-all for other node_modules
          if (n.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },

    // Optimize chunk sizes
    chunkSizeWarningLimit: 500,

    // Hidden source maps in production (readable by Sentry, not linked from bundle)
    sourcemap: 'hidden',
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
