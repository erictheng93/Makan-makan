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
    // A cold migrated D1 baseline is prepared in beforeAll. Keep its budget
    // on the setup hook, rather than making a normal test wait for it.
    testTimeout: 300000,
    hookTimeout: 720000,
    teardownTimeout: 15000,
    reporters: ["verbose"],
    passWithNoTests: true,
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@makanmasak/database": resolve(__dirname, "../../packages/database/src"),
      "@makanmasak/database/testing": resolve(
        __dirname,
        "../../packages/database/src/testing",
      ),
      "@makanmasak/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
      "@makanmasak/utils": resolve(__dirname, "../../packages/utils/src"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
