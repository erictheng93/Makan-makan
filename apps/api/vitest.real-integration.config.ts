import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/__tests__/integration/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    reporters: ["verbose"],
    passWithNoTests: true,
    // Miniflare's workerd IPC fails with `fetch failed` at migration 0006
    // when multiple instances boot in parallel (observed at 4 files × 1
    // vitest worker each). Serialise files to keep each smoke's miniflare
    // boot isolated. Tests inside the same file still share one miniflare.
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@makanmakan/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
      "@makanmakan/database": resolve(__dirname, "../../packages/database/src"),
      "@makanmakan/database/testing": resolve(
        __dirname,
        "../../packages/database/src/testing",
      ),
      "@makanmakan/testing-utils": resolve(
        __dirname,
        "../../packages/testing-utils/src",
      ),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
