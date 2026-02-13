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
    singleFork: true, // Use single fork to reduce memory (moved from poolOptions in vitest 4.x)
    isolate: false, // Share memory between tests (moved from poolOptions in vitest 4.x)
    // Run test files sequentially to prevent memory issues
    fileParallelism: false,
    // Limit concurrent tests to reduce memory pressure
    maxConcurrency: 1,
    // Sequence tests to avoid race conditions
    sequence: {
      shuffle: false,
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
