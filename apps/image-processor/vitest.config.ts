import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/",
        "**/types/*.ts",
      ],
    },
    testTimeout: 10000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        find: "@makanmasak/database/testing",
        replacement: path.resolve(
          __dirname,
          "../../packages/database/src/testing",
        ),
      },
      {
        find: "@makanmasak/shared-types",
        replacement: path.resolve(
          __dirname,
          "../../packages/shared-types/src/index.ts",
        ),
      },
      {
        find: "@makanmasak/database",
        replacement: path.resolve(
          __dirname,
          "../../packages/database/src/index.ts",
        ),
      },
      {
        find: "@makanmasak/utils",
        replacement: path.resolve(
          __dirname,
          "../../packages/utils/src/index.ts",
        ),
      },
    ],
  },
});
