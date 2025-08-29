import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.{js,ts}',
      'tests/e2e/**/*.test.{js,ts}'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'legacy/',
      'Backup/',
      'apps/',
      'packages/'
    ]
  },
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname, './tests')
    }
  }
})