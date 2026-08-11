import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "@makanmasak/queue-service",
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.{js,ts}", "src/**/*.test.{js,ts}"],
    exclude: ["node_modules/", "dist/"],
  },
  resolve: {
    alias: {
      "@makanmasak/queue-core": path.resolve(
        __dirname,
        "../queue-core/src/index.ts",
      ),
    },
  },
});
