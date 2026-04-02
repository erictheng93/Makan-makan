import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "@makanmakan/queue-service",
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.{js,ts}", "src/**/*.test.{js,ts}"],
    exclude: ["node_modules/", "dist/"],
  },
  resolve: {
    alias: {
      "@makanmakan/queue-core": path.resolve(
        __dirname,
        "../queue-core/src/index.ts",
      ),
    },
  },
});
