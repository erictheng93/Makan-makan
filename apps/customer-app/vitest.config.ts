import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**", // Exclude Playwright E2E tests
      "**/*.spec.ts", // Playwright uses .spec.ts convention
      // Phase 2 real-integration tests boot miniflare; they run under
      // the dedicated `vitest.real-integration.config.ts`, not the
      // default unit-test run. Mirrors kitchen-display's vitest.config.
      "**/*.real.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@makanmakan/shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src", import.meta.url),
      ),
      "@makanmakan/i18n": fileURLToPath(
        new URL("../../packages/shared/src/i18n/src", import.meta.url),
      ),
    },
  },
});
