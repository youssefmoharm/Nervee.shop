import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Code splitting strategy for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separate vendor chunks
          if (id.includes('node_modules/react')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-ui'
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-form'
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

          // Supabase client in separate chunk
          if (id.includes('lib/supabase')) {
            return 'supabase'
          }
        },
      },
    },

    // Optimize chunk sizes
    chunkSizeWarningLimit: 600,

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
      ],
    },
  },
})
