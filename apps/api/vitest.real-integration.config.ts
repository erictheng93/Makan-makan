import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/__tests__/integration/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Per-attempt miniflare boot + full runMigrations is ~8-12s. When the
    // workerd IPC hits the ~5% `fetch failed` path (handled by the retry
    // loop in `packages/database/src/testing/create-test-database.ts`),
    // wall time becomes 2-3× that: up to ~36s in the worst case.
    //
    // 30s used to straddle the 2-retry cliff — `discovery.real.integration.
    // test.ts`'s `beforeAll` hit that exact edge and flaked.
    //
    // 60s absorbs the full retry budget with headroom. Both timeouts are
    // bumped because this suite has two different ownership models:
    //   - `discovery` / `seed-helper` use `beforeAll` (hookTimeout matters)
    //   - `start-test-api-server` / `real-test-app` create a fresh
    //     miniflare in each `it()` (testTimeout matters)
    testTimeout: 60000,
    hookTimeout: 60000,
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
