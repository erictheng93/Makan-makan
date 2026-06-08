import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/e2e/kitchen-display",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../playwright-report/kitchen-display" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_KITCHEN_URL ?? "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  webServer: {
    command: "pnpm dev -- --host localhost",
    url: process.env.E2E_KITCHEN_URL ?? "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
