import { defineConfig, devices } from "@playwright/test";

/**
 * Fast CI smoke for push pipelines.
 *
 * The full E2E suite is useful for release investigation but currently too
 * large and unstable for every main/develop push. This config verifies both
 * preview servers boot and serve browser-renderable HTML within a small,
 * deterministic budget.
 */
export default defineConfig({
  testDir: "./tests/e2e/ci-smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "customer-preview",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
      },
    },
    {
      name: "admin-preview",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.E2E_ADMIN_URL || "http://localhost:3001",
      },
    },
  ],
});
