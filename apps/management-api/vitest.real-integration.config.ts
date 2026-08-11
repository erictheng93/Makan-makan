import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/__tests__/integration/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 300000,
    hookTimeout: 300000,
    teardownTimeout: 15000,
    reporters: ["verbose"],
    passWithNoTests: true,
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@makanmasak/database": resolve(__dirname, "../../packages/database/src"),
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
