import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/__tests__/integration/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Miniflare boot + migration takes 8-12s per attempt; allow retry budget.
    testTimeout: 180000,
    hookTimeout: 180000,
    teardownTimeout: 15000,
    reporters: ["verbose"],
    passWithNoTests: true,
    // Single file = single Miniflare boot — no parallel IPC contention.
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@makanmakan/database": resolve(__dirname, "../../packages/database/src"),
      "@makanmakan/database/testing": resolve(
        __dirname,
        "../../packages/database/src/testing",
      ),
      "@makanmakan/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
      "@makanmakan/utils": resolve(__dirname, "../../packages/utils/src"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
