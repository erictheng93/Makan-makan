import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/services/__tests__/setup.ts"],
    include: ["src/**/__tests__/**/*.test.{js,ts}", "src/**/*.test.{js,ts}"],
    exclude: ["node_modules/", "dist/"],
    // Memory optimization settings - use forks for better isolation
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    // Run test files sequentially to prevent memory issues
    fileParallelism: false,
    // Limit concurrent tests to reduce memory pressure
    maxConcurrency: 1,
    // Sequence tests to avoid race conditions
    sequence: {
      shuffle: false,
      groupOrder: "database",
    },
    // Increase test timeout for slower tests
    testTimeout: 30000,
    // Clear mocks between tests automatically
    clearMocks: true,
    restoreMocks: true,
    // Use default reporter without summary for minimal output
    reporters: [["default", { summary: false }]],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
