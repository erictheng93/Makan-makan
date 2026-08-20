import { defineConfig } from "vitest/config";
import path from "path";
import { sharedTestConfig } from "../../vitest.shared";

// Standalone config for the `api` project. It used to live inline in the root
// vitest.config.ts, which forced `pnpm --filter @makanmasak/api test` to bounce
// back into the root workspace and run the whole workspace resolution. Owning
// the config here lets `turbo run test` execute (and cache) the api suite on
// its own, and the root workspace just references this directory like every
// other app does.
//
// The *.real.integration.test.ts suites boot miniflare with 300s timeouts and
// run serially under vitest.real-integration.config.ts, so they stay excluded
// from the default unit run — under the 10s timeout here they would time out.
export default defineConfig({
  test: {
    ...sharedTestConfig,
    name: "api",
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.real.integration.test.ts",
    ],
    environment: "node",
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: "forks",
  },
  resolve: {
    // The inline root-config version of this project used `extends: true` and
    // so inherited the root `resolve.alias` block. Standalone project configs
    // do not inherit it, so the workspace aliases are repeated here. Dropping
    // them would silently switch resolution from package source to built
    // `dist/`, which is a different thing to be testing.
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@makanmasak/ai-analytics": path.resolve(
        __dirname,
        "../../packages/ai-analytics/src/index.ts",
      ),
      "@makanmasak/database/testing": path.resolve(
        __dirname,
        "../../packages/database/src/testing/index.ts",
      ),
      "@makanmasak/database": path.resolve(
        __dirname,
        "../../packages/database/src/index.ts",
      ),
      "@makanmasak/queue-core": path.resolve(
        __dirname,
        "../../packages/queue-core/src/index.ts",
      ),
      "@makanmasak/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts",
      ),
      "@makanmasak/utils": path.resolve(
        __dirname,
        "../../packages/utils/src/index.ts",
      ),
    },
  },
});
