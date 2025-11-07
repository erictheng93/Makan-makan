import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom', // Changed from 'node' to support browser APIs
    include: [
      // Root-level tests
      'tests/unit/**/*.test.{js,ts}',
      'tests/e2e/**/*.test.{js,ts}',

      // Apps tests - enable all test files in apps/
      'apps/**/__tests__/**/*.test.{js,ts}',
      'apps/**/tests/**/*.test.{js,ts}',
      'apps/**/src/**/*.test.{js,ts}',

      // Packages tests - enable all test files in packages/
      'packages/**/__tests__/**/*.test.{js,ts}',
      'packages/**/tests/**/*.test.{js,ts}',
      'packages/**/src/**/*.test.{js,ts}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/legacy/**',
      '**/Backup/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
      // Removed: 'apps/', 'packages/' - now included in testing
    ]
  },
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname, './tests'),
      // Path aliases for each app (support @/ imports in tests)
      '@': path.resolve(__dirname, './src') // Fallback for root-level tests
    }
  }
})