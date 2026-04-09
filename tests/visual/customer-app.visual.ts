import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  loginAs,
  mockAllAPIs,
  expectPageRendered,
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
      await expectPageRendered(page, { mustContain: /MakanMakan/ });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-home.png");
    });

    test("menu browsing", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/menu`);
      await waitForPageStable(page);
      await expectPageRendered(page, { mustContain: /MakanMakan/ });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-menu.png");
    });

    test("QR scan page", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/scan`);
      await waitForPageStable(page);
      await expectPageRendered(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-scan.png");
    });

    test("404 page", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/non-existent-route`);
      await waitForPageStable(page);
      await expectPageRendered(page);
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-404.png");
    });
  });

  // Restaurant context pages
  test.describe("Restaurant context", () => {
    test("table menu", async ({ page }) => {
      // tableId MUST be numeric — the customer-app router's beforeEach guard
      // runs Number(tableId) and redirects to /error on NaN.
      await page.goto(
        `${APP_URLS.customer}/restaurant/test-restaurant-1/table/1`,
      );
      await waitForPageStable(page);
      await expectPageRendered(page, {
        urlContains: "/restaurant/test-restaurant-1/table/1",
        // Mock menu includes this item — proves the full menu payload
        // (not just a stub) was fetched and rendered.
        mustContain: /海南雞飯|MakanMakan 測試餐廳/,
      });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-table-menu.png");
    });

    test("shopping cart", async ({ page }) => {
      // Pre-populate the cart in localStorage BEFORE the page loads.
      // CartView's onMounted redirects to the menu page if the cart is empty
      // (`cartStore.isEmpty` → `router.replace(menu)`), so we need to seed
      // the expected storage key with valid CartData before first render.
      // The schema is in apps/customer-app/src/stores/cart.ts (CartDataSchema).
      const restaurantId = "test-restaurant-1";
      const tableId = 1;
      const storageKey = `makanmakan_cart_${restaurantId}_${tableId}`;
      await page.addInitScript(
        ({ key, data }) => {
          localStorage.setItem(key, JSON.stringify(data));
        },
        {
          key: storageKey,
          data: {
            items: [
              {
                id: "cart-item-1",
                menuItem: {
                  id: 1,
                  name: "海南雞飯",
                  price: 120,
                  description: "正宗海南雞飯",
                  imageUrl: "",
                  isAvailable: true,
                },
                quantity: 2,
                price: 120,
                totalPrice: 240,
              },
              {
                id: "cart-item-2",
                menuItem: {
                  id: 2,
                  name: "叻沙",
                  price: 150,
                  description: "椰漿叻沙",
                  imageUrl: "",
                  isAvailable: true,
                },
                quantity: 1,
                price: 150,
                totalPrice: 150,
              },
            ],
            restaurantId,
            tableId,
            timestamp: Date.now(),
          },
        },
      );

      await page.goto(
        `${APP_URLS.customer}/restaurant/${restaurantId}/table/${tableId}/cart`,
      );
      await waitForPageStable(page);
      await expectPageRendered(page, {
        urlContains: "/cart",
        mustContain: /海南雞飯/,
      });
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
      await expectPageRendered(page, { notAt: "/login" });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-orders.png");
    });

    test("user profile", async ({ page }) => {
      await page.goto(`${APP_URLS.customer}/profile`);
      await waitForPageStable(page);
      await expectPageRendered(page, { notAt: "/login" });
      await mockDynamicContent(page);
      await expect(page).toHaveScreenshot("customer-profile.png");
    });
  });
});
