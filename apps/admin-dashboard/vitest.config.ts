import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/coverage/'
      ]
    },
    testTimeout: 10000,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@makanmakan/shared-types': resolve(__dirname, '../../packages/shared-types/src')
    }
  },
  define: {
    // Mock environment variables for testing
    'import.meta.env.MODE': '"test"',
    'import.meta.env.VITE_API_BASE_URL': '"http://localhost:8787"'
  },
  esbuild: {
    target: 'node14'
  }
})