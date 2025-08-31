import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
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
        '**/dist/'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@makanmakan/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@makanmakan/database': resolve(__dirname, '../../packages/database/src')
    }
  },
  define: {
    // Mock environment variables for testing
    'process.env.NODE_ENV': '"test"'
  }
})