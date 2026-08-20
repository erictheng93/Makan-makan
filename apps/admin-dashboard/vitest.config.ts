import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";
import { sharedTestConfig } from "../../vitest.shared";

// The default unit-test config reuses vite.config (vue plugin, @ alias, the
// pinia/vue dedupe for pnpm). The *.real.integration.test.ts suites boot
// miniflare and run under the dedicated vitest.real-integration.config.ts
// (long timeouts, serial), so they are excluded here — otherwise they time
// out under the default unit-test timeout. Component tests declare their own
// environment via `// @vitest-environment jsdom`.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      ...sharedTestConfig,
      globals: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.real.integration.test.ts",
      ],
    },
  }),
);
