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
    host: 'localhost', // SECURITY FIX: Restrict to localhost only in development
    port: 3001,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production', // SECURITY FIX: Disable sourcemaps in production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          charts: ['chart.js', 'vue-chartjs']
        }
      }
    }
  }
})