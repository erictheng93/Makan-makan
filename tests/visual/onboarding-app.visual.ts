import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  mockAllAPIs,
} from "./helpers/visual-test-utils";

const BASE_URL = APP_URLS.onboarding; // http://localhost:3011

test.describe("Onboarding App — Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
  });

  test("home page", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForPageStable(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-home.png");
  });

  test("application form", async ({ page }) => {
    await page.goto(`${BASE_URL}/apply`);
    await waitForPageStable(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-apply.png");
  });

  test("connect page", async ({ page }) => {
    await page.goto(`${BASE_URL}/connect`);
    await waitForPageStable(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-connect.png");
  });

  test("success page", async ({ page }) => {
    await page.goto(`${BASE_URL}/success`);
    await waitForPageStable(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-success.png");
  });
});
