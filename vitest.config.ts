import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom', // Changed from 'node' to support browser APIs

    // 🔥 記憶體優化 - 多層次策略
    pool: 'threads',  // 使用 threads 而非 forks (更高效的記憶體共享)
    poolOptions: {
      threads: {
        maxThreads: 2,      // 降低並行度 (從 3 降到 2)
        minThreads: 1,
        singleThread: false,

        // 🔥 關鍵: 直接傳遞記憶體參數給 worker threads
        // 這確保每個 worker 都有 8GB heap limit
        execArgv: ['--max-old-space-size=8192']
      }
    },

    // 測試隔離 - 防止記憶體洩漏累積
    isolate: true,

    // 超時設定 (增加到 60 秒以配合較慢的執行速度)
    testTimeout: 60000,     // 60秒測試超時
    hookTimeout: 60000,     // 60秒 hook 超時

    // 測試覆蓋率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // 覆蓋率門檻
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // 關鍵模組要求更高覆蓋率
        'apps/api/src/features/**/*.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'apps/realtime/src/**/*.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },

      // 排除不需要覆蓋的文件
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/tests/**',
        '**/__tests__/**',
        '**/coverage/**',
        '**/legacy/**',
        '**/Backup/**',
      ],

      // 包含的文件
      include: [
        'apps/*/src/**/*.{ts,tsx,vue}',
        'packages/*/src/**/*.{ts,tsx}',
      ],
    },

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
    ],
    // Workspace projects configuration (migrated from vitest.workspace.ts)
    // Each project can have its own configuration from their vitest.config.ts
    projects: [
      // Root-level tests (generic tests)
      {
        test: {
          name: 'root',
          root: '.',
          include: ['tests/**/*.test.{js,ts}'],
          environment: 'node'
        }
      },
      // Apps - each uses its own vitest.config.ts
      'apps/admin-dashboard',
      'apps/customer-app',
      'apps/kitchen-display',
      'apps/api',
      'apps/realtime',
      // Packages - each uses its own vitest.config.ts
      'packages/database',
      'packages/queue-core',
      'packages/utils'
    ]
  },
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname, './tests'),
      // Path aliases for each app (support @/ imports in tests)
      '@': path.resolve(__dirname, './src'), // Fallback for root-level tests

      // Monorepo internal packages - critical for test environment
      '@makanmakan/ai-analytics': path.resolve(__dirname, './packages/ai-analytics/src/index.ts'),
      '@makanmakan/database': path.resolve(__dirname, './packages/database/src/index.ts'),
      '@makanmakan/queue-core': path.resolve(__dirname, './packages/queue-core/src/index.ts'),
      '@makanmakan/queue-service': path.resolve(__dirname, './packages/queue-service/src/index.ts'),
      '@makanmakan/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@makanmakan/shared-types': path.resolve(__dirname, './packages/shared-types/src/index.ts'),
      '@makanmakan/utils': path.resolve(__dirname, './packages/utils/src/index.ts')
    }
  }
})