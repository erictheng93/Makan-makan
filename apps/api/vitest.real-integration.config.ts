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
    maxWorkers: 4,
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
