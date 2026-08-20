import { defineConfig } from "vitest/config";
import path from "path";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{js,ts}", "src/**/*.test.{js,ts}"],
    exclude: ["node_modules/", "dist/"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@makanmasak/database": path.resolve(__dirname, "../database/src"),
      "@makanmasak/shared-types": path.resolve(
        __dirname,
        "../shared-types/src",
      ),
    },
  },
});
