import { defineConfig } from "vitest/config";
import { resolve } from "path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/",
        "**/coverage/",
      ],
    },
    testTimeout: 10000,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Phase 2 real-integration tests boot miniflare; they run under
      // the dedicated `vitest.real-integration.config.ts`, not the
      // default unit-test run. Mirrors kitchen-display's vitest.config.
      "**/*.real.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@makanmakan/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
      "@makanmakan/database": resolve(__dirname, "../../packages/database/src"),
      "@makanmakan/utils": resolve(__dirname, "../../packages/utils/src"),
      pinia: resolve(__dirname, "./node_modules/pinia"),
      vue: resolve(__dirname, "./node_modules/vue"),
    },
  },
  define: {
    // Mock environment variables for testing
    "import.meta.env.MODE": '"test"',
    "import.meta.env.VITE_API_BASE_URL": '"http://localhost:8787"',
    "import.meta.env.VITE_WS_URL": '"ws://localhost:8787"',
  },
  esbuild: {
    target: "node14",
  },
});
