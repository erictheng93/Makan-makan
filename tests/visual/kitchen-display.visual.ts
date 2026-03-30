import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  loginAs,
  mockAllAPIs,
} from "./helpers/visual-test-utils";

const BASE_URL = APP_URLS.kitchen; // http://localhost:3002

test.describe("Kitchen Display — Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
  });

  test.describe("Auth pages", () => {
    test("login page", async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("kitchen-login.png");
    });
  });

  test.describe("Kitchen pages", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, "chef", APP_URLS.kitchen);
    });

    test("order queue", async ({ page }) => {
      await page.goto(`${BASE_URL}/kitchen/test-restaurant-1`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("kitchen-order-queue.png");
    });

    test("settings", async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("kitchen-settings.png");
    });

    test("order history", async ({ page }) => {
      await page.goto(`${BASE_URL}/history`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("kitchen-history.png");
    });
  });
});
