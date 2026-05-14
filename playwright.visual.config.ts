import { defineConfig, devices } from "@playwright/test";

/**
 * MakanMakan Visual Regression Testing 配置
 *
 * 使用 Playwright 原生 toHaveScreenshot() 進行視覺回歸測試
 * 只用 Chromium 系列（跨瀏覽器渲染差異由 E2E tests 涵蓋）
 */
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.visual.ts",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-linux{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report/visual" }],
    ["json", { outputFile: "playwright-report/visual/results.json" }],
  ],

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: "disabled",
    },
  },

  use: {
    trace: "on-first-retry",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
