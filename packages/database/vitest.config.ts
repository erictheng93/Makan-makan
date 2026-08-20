import { defineConfig } from "vitest/config";
import path from "path";
import { sharedTestConfig } from "../../vitest.shared";

// packages/database was the one workspace project listed in the root
// vitest.config.ts without a config file of its own. Running vitest from this
// directory therefore walked up to the root config and tried to resolve its
// `projects` entries relative to packages/database, so
// `pnpm --filter @makanmasak/database test` died with
// "Projects definition references a non-existing file or a directory:
//  packages/database/apps/admin-dashboard".
//
// Owning the config here fixes the standalone invocation and lets
// `turbo run test` execute and cache this package on its own. Discovery is
// kept identical to what the root workspace resolved before (37 files):
// vitest defaults scoped to src/, node environment, no globals — every test
// file imports describe/it/expect from "vitest" explicitly.
export default defineConfig({
  test: {
    ...sharedTestConfig,
    // Must stay in sync with the package name: `pnpm test:packages` and
    // `vitest --project @makanmasak/database` select on it.
    name: "@makanmasak/database",
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    pool: "forks",
  },
  resolve: {
    // Mirrors the root config's workspace aliases so the suite keeps testing
    // package source rather than the built dist/ output.
    alias: {
      "@makanmasak/queue-core": path.resolve(
        __dirname,
        "../queue-core/src/index.ts",
      ),
      "@makanmasak/shared-types": path.resolve(
        __dirname,
        "../shared-types/src/index.ts",
      ),
      "@makanmasak/utils": path.resolve(__dirname, "../utils/src/index.ts"),
    },
  },
});
