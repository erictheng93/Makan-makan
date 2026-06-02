import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/__tests__/integration/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Per-attempt miniflare boot + full runMigrations is ~8-12s. When workerd
    // IPC hits the ~5% retry path (`fetch failed`) in
    // `packages/database/src/testing/create-test-database.ts`, first-run wall time
    // can stretch to ~3× and occasionally exceed 2 minutes.
    //
    // 5 minutes has been stabilized as a safe upper bound for hook + test wall
    // time across real integration suites, so this is set globally instead of
    // file-by-file overrides.
    testTimeout: 300000,
    hookTimeout: 300000,
    teardownTimeout: 15000,
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
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
