import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  mockAllAPIs,
  expectPageRendered,
} from "./helpers/visual-test-utils";

const BASE_URL = APP_URLS.management; // http://localhost:3010

test.describe("Management Portal — Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
  });

  test("dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForPageStable(page);
    await expectPageRendered(page, { mustContain: /MakanMasak|總覽/ });
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("management-dashboard.png");
  });

  test("tenants list", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenants`);
    await waitForPageStable(page);
    await expectPageRendered(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("management-tenants.png");
  });

  test("deployments", async ({ page }) => {
    await page.goto(`${BASE_URL}/deployments`);
    await waitForPageStable(page);
    await expectPageRendered(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("management-deployments.png");
  });

  test("system health", async ({ page }) => {
    await page.goto(`${BASE_URL}/health`);
    await waitForPageStable(page);
    await expectPageRendered(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("management-health.png");
  });
});
