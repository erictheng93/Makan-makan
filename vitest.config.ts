import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    // Workspace projects configuration
    // Each project uses its own vitest.config.ts or inline config
    projects: [
      // Root-level tests (generic tests)
      {
        extends: true,
        test: {
          name: "root",
          root: ".",
          include: [
            "tests/unit/**/*.test.{js,ts}",
            "tests/e2e/**/*.test.{js,ts}",
          ],
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/legacy/**",
            "**/Backup/**",
          ],
          environment: "node",
          globals: true,
          testTimeout: 60000,
          hookTimeout: 60000,
        },
      },
      // Apps - each uses its own vitest.config.ts
      "apps/admin-dashboard",
      "apps/customer-app",
      "apps/kitchen-display",
      "apps/api",
      "apps/realtime",
      // Packages - each uses its own vitest.config.ts
      "packages/database",
      "packages/queue-core",
      "packages/utils",
    ],

    // Pool configuration (Vitest 4 flat format)
    pool: "threads",
    maxWorkers: 2,
    minWorkers: 1,
    execArgv: ["--max-old-space-size=8192"],

    // Coverage configuration (global)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        "apps/api/src/features/**/*.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "apps/realtime/src/**/*.ts": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/tests/**",
        "**/__tests__/**",
        "**/coverage/**",
        "**/legacy/**",
        "**/Backup/**",
      ],
      include: ["apps/*/src/**/*.{ts,tsx,vue}", "packages/*/src/**/*.{ts,tsx}"],
    },
  },
  resolve: {
    alias: {
      "@tests": path.resolve(__dirname, "./tests"),
      "@": path.resolve(__dirname, "./src"),
      "@makanmakan/ai-analytics": path.resolve(
        __dirname,
        "./packages/ai-analytics/src/index.ts",
      ),
      "@makanmakan/database": path.resolve(
        __dirname,
        "./packages/database/src/index.ts",
      ),
      "@makanmakan/queue-core": path.resolve(
        __dirname,
        "./packages/queue-core/src/index.ts",
      ),
      "@makanmakan/queue-service": path.resolve(
        __dirname,
        "./packages/queue-service/src/index.ts",
      ),
      "@makanmakan/shared": path.resolve(
        __dirname,
        "./packages/shared/src/index.ts",
      ),
      "@makanmakan/shared-types": path.resolve(
        __dirname,
        "./packages/shared-types/src/index.ts",
      ),
      "@makanmakan/utils": path.resolve(
        __dirname,
        "./packages/utils/src/index.ts",
      ),
    },
  },
});
