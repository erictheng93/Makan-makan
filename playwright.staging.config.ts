import { defineConfig, devices } from "@playwright/test";

/**
 * Staging Smoke Config
 *
 * Used by `pnpm run test:smoke:staging` and chained from the
 * `deploy-staging` job in `.github/workflows/test.yml`. Targets only
 * `tests/e2e/smoke/` and runs serially with retries so a transient
 * staging blip doesn't false-positive a deploy gate.
 *
 * Required env vars (provided by CI secrets):
 *   STAGING_API_URL       — staging API base URL
 *   STAGING_CUSTOMER_URL  — staging customer app base URL
 *   STAGING_AUTH_USERNAME — seeded smoke user on staging
 *   STAGING_AUTH_PASSWORD — password for STAGING_AUTH_USERNAME
 *   STAGING_RESTAURANT_ID — seeded restaurant UUID on staging
 *   STAGING_MENU_ITEM_ID  — seeded menu item id on staging
 *
 * The smoke spec itself reads SMOKE_* env vars; this config maps the
 * STAGING_* secrets onto SMOKE_* so the same spec works against any env.
 */

// Map STAGING_* → SMOKE_* before the spec module loads.
// STAGING_URL is the legacy single-URL secret; if STAGING_API_URL /
// STAGING_CUSTOMER_URL aren't set explicitly, fall back to it for both so
// older CI configs still produce Layer 1 liveness coverage.
process.env.SMOKE_API_URL ??=
  process.env.STAGING_API_URL ?? process.env.STAGING_URL;
process.env.SMOKE_CUSTOMER_URL ??=
  process.env.STAGING_CUSTOMER_URL ?? process.env.STAGING_URL;
process.env.SMOKE_AUTH_USERNAME ??= process.env.STAGING_AUTH_USERNAME;
process.env.SMOKE_AUTH_PASSWORD ??= process.env.STAGING_AUTH_PASSWORD;
process.env.SMOKE_RESTAURANT_ID ??= process.env.STAGING_RESTAURANT_ID;
process.env.SMOKE_MENU_ITEM_ID ??= process.env.STAGING_MENU_ITEM_ID;

export default defineConfig({
  testDir: "./tests/e2e/smoke",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Retry once: staging may have a brief warm-up window after deploy.
  // Two retries would mask actual instability — one is the cap.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Hard upper bound: a smoke run that needs more than 90s is no longer
  // a smoke test — it's hiding a real performance regression.
  timeout: 30_000,
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report/smoke-staging.json" }],
  ],

  use: {
    // Smoke spec hits API directly via fetch(); baseURL is unused for
    // the spec itself but Playwright requires it for `page` objects if
    // any are introduced later.
    baseURL: process.env.SMOKE_CUSTOMER_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "smoke-staging",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
