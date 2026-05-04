import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  loginAs,
  mockAllAPIs,
  expectPageRendered,
} from "./helpers/visual-test-utils";

test.describe("Admin Dashboard — Visual Regression", () => {
  // ── Auth pages (no login needed) ──────────────────────────────
  test.describe("Auth pages", () => {
    test.beforeEach(async ({ page }) => {
      await mockAllAPIs(page);
    });

    test("login page", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/login`);
      await waitForPageStable(page);
      await expectPageRendered(page, { mustContain: /MakanMasak/ });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-login.png");
    });

    test("forgot password page", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/forgot-password`);
      await waitForPageStable(page);
      await expectPageRendered(page, { mustContain: /MakanMasak/ });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-forgot-password.png");
    });
  });

  // ── Dashboard pages (logged in as admin) ──────────────────────
  test.describe("Dashboard pages", () => {
    test.beforeEach(async ({ page }) => {
      await mockAllAPIs(page);
      await loginAs(page, "admin", APP_URLS.admin);
      await page.goto(APP_URLS.admin);
    });

    test("dashboard home", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard`);
      await waitForPageStable(page);
      await expectPageRendered(page, { notAt: "/login" });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-dashboard-home.png");
    });

    test("orders management", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/orders`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/orders",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-orders.png");
    });

    test("menu management", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/menu`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/menu",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-menu.png");
    });

    test("employee management", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/employees`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/employees",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-employees.png");
    });

    test("analytics", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/analytics`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/analytics",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-analytics.png");
    });

    test("settings", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/settings`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/settings",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-settings.png");
    });

    test("POS checkout", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/pos/checkout`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/pos",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-pos-checkout.png");
    });

    test("seating management", async ({ page }) => {
      await page.goto(`${APP_URLS.admin}/dashboard/seating`);
      await waitForPageStable(page);
      await expectPageRendered(page, {
        notAt: "/login",
        urlContains: "/dashboard/seating",
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("admin-seating.png");
    });
  });
});
