import { defineConfig, devices } from "@playwright/test";

/**
 * MakanMakan E2E 測試配置
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI workers: 4 — empirically the customer-app tests are read-mostly
  // (they hit a static preview build, no backend mutations), so parallel
  // workers don't contend on shared state. The previous `workers: 1`
  // forced ~158 tests through one process and pushed runtime past the
  // 25-minute job timeout. Bumping to 4 brings expected runtime to
  // ~6-8 minutes per browser. The `integration` project keeps its own
  // `fullyParallel: false` so its sequential semantics aren't affected
  // by this global setting.
  workers: process.env.CI ? 4 : undefined,
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
      testIgnore: ["**/admin/**", "**/integration/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: ["**/admin/**", "**/integration/**"],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: ["**/admin/**", "**/integration/**"],
      use: { ...devices["Desktop Safari"] },
    },

    // Mobile devices — customer & journey tests only
    {
      name: "Mobile Chrome",
      testIgnore: ["**/admin/**", "**/integration/**"],
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      testIgnore: ["**/admin/**", "**/integration/**"],
      use: { ...devices["iPhone 12"] },
    },

    // Tablet — customer & journey tests only
    {
      name: "Tablet",
      testIgnore: ["**/admin/**", "**/integration/**"],
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
