import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@makanmakan/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@makanmakan/utils': resolve(__dirname, '../../packages/utils/src')
    }
  },
  server: {
    host: true,
    port: 3002, // 不同於 admin-dashboard 的 3001
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Core dependencies
          if (id.includes('vue') && !id.includes('toastification')) {
            return 'vue-core'
          }
          if (id.includes('pinia') || id.includes('vue-router')) {
            return 'vue-ecosystem'
          }
          
          // UI components and icons
          if (id.includes('@headlessui') || id.includes('@heroicons')) {
            return 'ui-components'
          }
          
          // Audio processing
          if (id.includes('howler') || id.includes('audio')) {
            return 'audio-system'
          }
          
          // Statistics and analytics
          if (id.includes('chart') || id.includes('statistics') || id.includes('analytics')) {
            return 'statistics'
          }
          
          // Utilities and helpers
          if (id.includes('@vueuse') || id.includes('date-fns')) {
            return 'utilities'
          }
          
          // HTTP and data fetching
          if (id.includes('axios') || id.includes('@tanstack/vue-query')) {
            return 'data-fetching'
          }
          
          // Toast and notifications
          if (id.includes('toastification')) {
            return 'notifications'
          }
          
          // Large third-party libraries
          if (id.includes('sortablejs')) {
            return 'sortable'
          }
          
          // Node modules (vendor chunk for other dependencies)
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
        chunkFileNames: () => {
          return `assets/[name]-[hash].js`
        },
        assetFileNames: (assetInfo) => {
          if (/\.(mp3|wav|ogg|m4a)$/i.test(assetInfo.name!)) {
            return `assets/audio/[name]-[hash][extname]`
          }
          if (/\.(png|jpe?g|gif|svg)$/i.test(assetInfo.name!)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/\.css$/i.test(assetInfo.name!)) {
            return `assets/css/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      },
      treeshake: {
        preset: 'recommended'
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/setup.ts',
        'dist/',
        '**/*.d.ts'
      ]
    }
  }
})