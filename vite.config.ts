import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Code splitting strategy for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          // UI Libraries
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-ui'
          }
          // State management
          if (id.includes('node_modules/zustand/')) {
            return 'vendor-state'
          }
          
          // Supabase client in separate chunk
          if (id.includes('lib/supabase') || id.includes('node_modules/@supabase/')) {
            return 'supabase'
          }

          // Split large contexts to prevent bundle bloat
          if (id.includes('AuthContext')) {
            return 'context-auth'
          }
          if (id.includes('CartContext')) {
            return 'context-cart'
          }
          if (
            id.includes('ToastContext') ||
            id.includes('WishlistContext') ||
            id.includes('QuickViewContext') ||
            id.includes('BrowsingHistoryContext')
          ) {
            return 'context-other'
          }

          // Snap Camera Kit AR SDK — heavy and only needed inside the
          // Try-On experience, which is dynamically imported on demand.
          // Must stay in its own chunk so it never loads with the storefront.
          if (id.includes('node_modules/@snap/')) {
            return 'snap-camera-kit'
          }

          // Catch-all for other node_modules
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },

    // Optimize chunk sizes
    chunkSizeWarningLimit: 500,

    // Source maps only in dev
    sourcemap: false,
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
})
