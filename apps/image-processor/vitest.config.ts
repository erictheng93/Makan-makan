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
        find: "@makanmakan/database/testing",
        replacement: path.resolve(
          __dirname,
          "../../packages/database/src/testing",
        ),
      },
      {
        find: "@makanmakan/shared-types",
        replacement: path.resolve(
          __dirname,
          "../../packages/shared-types/src/index.ts",
        ),
      },
      {
        find: "@makanmakan/database",
        replacement: path.resolve(
          __dirname,
          "../../packages/database/src/index.ts",
        ),
      },
      {
        find: "@makanmakan/utils",
        replacement: path.resolve(
          __dirname,
          "../../packages/utils/src/index.ts",
        ),
      },
    ],
  },
});
