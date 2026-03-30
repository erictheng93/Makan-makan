import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  loginAs,
  mockAllAPIs,
} from "./helpers/visual-test-utils";

test.describe("Customer App — Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
  });

  // Public pages
  test.describe("Public pages", () => {
    test("home page", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-home.png");
    });

    test("menu browsing", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/menu`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-menu.png");
    });

    test("QR scan page", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/scan`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-scan.png");
    });

    test("404 page", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/non-existent-route`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-404.png");
    });
  });

  // Restaurant context pages
  test.describe("Restaurant context", () => {
    test("table menu", async ({ page }) => {
      await page.goto(
        `${APP_URLS.customer}/restaurant/test-restaurant-1/table/table-1`,
      );
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-table-menu.png");
    });

    test("shopping cart", async ({ page }) => {
      await page.goto(
        `${APP_URLS.customer}/restaurant/test-restaurant-1/table/table-1/cart`,
      );
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-cart.png");
    });
  });

  // Authenticated pages
  test.describe("Authenticated pages", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, "customer", APP_URLS.customer);
    });

    test("order history", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/orders`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-orders.png");
    });

    test("user profile", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/profile`);
      await waitForPageStable(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-profile.png");
    });
  });
});
