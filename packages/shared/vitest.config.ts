import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
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
