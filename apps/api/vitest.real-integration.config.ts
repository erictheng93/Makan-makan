import { defineConfig } from "vitest/config";
import { resolve } from "path";

process.env.MAKANMAKAN_REAL_D1_REUSE_DB ??= "1";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // The database test helper builds one migrated D1 baseline per migration
    // hash, then copies it into an isolated Miniflare workdir for each file.
    // Keeping files serial avoids concurrent Miniflare boot flakiness while
    // avoiding per-file migrations.
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
