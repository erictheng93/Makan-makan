import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    name: "Integration Tests",
    include: ["src/tests/component-flows/**/*.test.ts"],
    exclude: ["src/tests/unit/**/*", "src/tests/e2e/**/*"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/tests/setup/integration-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/views/**/*.vue",
        "src/services/**/*.ts",
        "src/composables/**/*.ts",
      ],
      exclude: ["src/tests/**/*", "src/**/*.test.ts", "src/**/*.spec.ts"],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    reporters: ["verbose", "json"],
    outputFile: {
      json: "test-results/integration-results.json",
    },
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
  },
});
