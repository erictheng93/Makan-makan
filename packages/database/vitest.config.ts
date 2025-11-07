import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/services/__tests__/setup.ts'],
    include: [
      'src/**/__tests__/**/*.test.{js,ts}',
      'src/**/*.test.{js,ts}'
    ],
    exclude: [
      'node_modules/',
      'dist/'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
