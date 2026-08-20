import { defineConfig } from "vitest/config";
import path from "path";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    globals: true,
    environment: "jsdom",
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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Monorepo internal packages - point to index.ts for reliable resolution
      "@makanmasak/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts",
      ),
      "@makanmasak/utils": path.resolve(
        __dirname,
        "../../packages/utils/src/index.ts",
      ),
      "@makanmasak/database": path.resolve(
        __dirname,
        "../../packages/database/src/index.ts",
      ),
      "cloudflare:workers": path.resolve(
        __dirname,
        "./src/__tests__/cloudflare-workers.ts",
      ),
    },
  },
  esbuild: {
    target: "node14",
  },
});
