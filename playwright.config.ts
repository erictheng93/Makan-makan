import { defineConfig, devices } from "@playwright/test";

/**
 * MakanMasak E2E 測試配置
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI workers: 2 — conservative parallelism inside the Playwright
  // Docker container. 4 workers caused Firefox OOM / browser-crash
  // ("Target page, context or browser has been closed") because the
  // GitHub Actions runner only has ~7 GB RAM and 4 simultaneous
  // Firefox processes exceeded that. 2 workers halves sequential
  // runtime (158 tests → ~8 min per browser) while staying within
  // the container's memory budget. The `integration` project keeps
  // its own `fullyParallel: false` so its sequential semantics are
  // unaffected by this global setting.
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    // Desktop browsers — customer & journey tests only
    {
      name: "chromium",
      testIgnore: ["**/admin/**", "**/integration/**", "**/smoke/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: ["**/admin/**", "**/integration/**", "**/smoke/**"],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: ["**/admin/**", "**/integration/**", "**/smoke/**"],
      use: { ...devices["Desktop Safari"] },
    },

    // Mobile devices — customer & journey tests only
    {
      name: "Mobile Chrome",
      testIgnore: ["**/admin/**", "**/integration/**", "**/smoke/**"],
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      testIgnore: ["**/admin/**", "**/integration/**", "**/smoke/**"],
      use: { ...devices["iPhone 12"] },
    },

    // Tablet — customer & journey tests only
    {
      name: "Tablet",
      testIgnore: ["**/admin/**", "**/integration/**", "**/smoke/**"],
      use: { ...devices["iPad Pro"] },
    },

    // Admin dashboard tests — baseURL points to the admin app (port 3001)
    {
      name: "admin",
      testDir: "./tests/e2e/admin",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.E2E_ADMIN_URL || "http://localhost:3001",
        viewport: { width: 1280, height: 800 },
      },
    },

    // Integration tests (real API, no mocking) — serial to avoid active-order dedup
    {
      name: "integration",
      testDir: "./tests/e2e/integration",
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
    },

    // Smoke tests — minimal canary against any deployed env (local / staging /
    // production). Reads SMOKE_* env vars; falls back to localhost so the
    // suite is runnable against `pnpm dev` with no extra setup. The
    // `playwright.staging.config.ts` overrides this for the deploy gate.
    {
      name: "smoke",
      testDir: "./tests/e2e/smoke",
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.SMOKE_CUSTOMER_URL ?? "http://localhost:3000",
      },
    },
  ],

  // webServer: {
  //   command: 'pnpm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000
  // },

  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
