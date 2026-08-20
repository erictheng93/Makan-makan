import { defineConfig } from "vitest/config";
import path from "path";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.{js,ts}", "**/*.test.{js,ts}"],
    exclude: ["node_modules/", "dist/", "src/i18n/node_modules/"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
