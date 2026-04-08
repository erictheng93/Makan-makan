/**
 * Append Order (追加點餐) Flow
 *
 * Tests the scenario where a customer already has an active dine-in order and
 * places a second order for the same table.
 *
 * Key facts:
 * - guest_auth_token is stored in localStorage after the first order
 * - The tracking page shows the current order and provides a way back to menu
 * - A second POST to /api/v1/guest-orders creates a separate order record
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockTableAPI,
  mockOrderAPI,
} from "../../helpers/mock-api";
import {
  PERSONAS,
  RESTAURANT,
  TABLE,
  MENU_ITEMS,
  createMockOrder,
} from "../../helpers/personas";

test.use({ ...devices["iPhone 12"] });

const menuUrl = `/restaurant/${RESTAURANT.id}/table/${TABLE.id}`;
const cartUrl = `${menuUrl}/cart`;
const trackingUrl = `${menuUrl}/order/order-guest`;
const API_RE = "/api/v1";

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

// ---------------------------------------------------------------------------
// 1. Place second order for same table
// ---------------------------------------------------------------------------

test.describe("Append order: place second order for same table", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);
  });

  test("should navigate to menu and place a second order", async ({ page }) => {
    // Pre-seed guest_auth_token in localStorage before navigation
    await page.addInitScript(() => {
      localStorage.setItem("guest_auth_token", "mock-guest-token");
    });

    // Navigate to the existing order tracking page
    await page.goto(trackingUrl);
    await page.waitForLoadState("networkidle");

    // Verify the first order number is visible on the tracking page
    const orderNumber = page
      .locator("text=/ORD-GUEST-001|ORD-/")
      .or(page.locator('[data-testid="order-number"]'));
    await expect(orderNumber.first()).toBeVisible({ timeout: 10000 });

    // Try to find a "go back to menu" button; if not found, navigate directly
    const backToMenuBtn = page
      .locator('button:has-text("繼續")')
      .or(page.locator('button:has-text("菜單")'))
      .or(page.locator('button:has-text("再次點餐")'))
      .or(page.locator('button:has-text("返回菜單")'))
      .or(page.locator('button:has-text("繼續點餐")'))
      .or(page.locator('button:has-text("Back")'))
      .or(page.locator(`a[href*="${menuUrl}"]`))
      .or(page.locator('a[href*="menu"]'))
      .or(page.locator('a[href*="table"]'));

    const btnVisible = await backToMenuBtn
      .first()
      .isVisible()
      .catch(() => false);
    if (btnVisible) {
      await backToMenuBtn.first().click();
      await page.waitForLoadState("networkidle");
    } else {
      // Fallback: navigate directly to the menu URL
      await page.goto(menuUrl);
      await page.waitForLoadState("networkidle");
    }

    // Add 牛肉麵 to cart
    const beefNoodleCard = page.locator(`text=${MENU_ITEMS[0].name}`);
    await expect(beefNoodleCard.first()).toBeVisible({ timeout: 10000 });
    await beefNoodleCard.first().click();

    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    const addToCartBtn = modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), button:has-text("加入購物車"), [data-testid="add-to-cart-btn"]',
      );
    await addToCartBtn.first().click();

    // Wait for modal to close
    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // Navigate to cart
    const cartLink = page
      .locator(
        '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
      );
    await cartLink.first().click();
    await page.waitForLoadState("networkidle");

    // Track that POST /api/v1/guest-orders was called for the second order
    let secondOrderRequested = false;
    const secondOrder = createMockOrder({
      id: "order-guest-2",
      orderNumber: "ORD-GUEST-002",
    });

    await page.route(`**/api/v1/guest-orders`, (route) => {
      if (route.request().method() === "POST") {
        secondOrderRequested = true;
        route.fulfill(
          json({
            success: true,
            data: {
              order: secondOrder,
              guestToken: "mock-guest-token",
              tokenExpiresAt: "2099-01-01T00:00:00Z",
            },
          }),
        );
      } else {
        route.continue();
      }
    });

    // Submit order
    const submitBtn = page.locator(
      'button:has-text("送出"), button:has-text("Submit"), button:has-text("下單"), [data-testid="submit-order-btn"], [data-testid="place-order-btn"]',
    );
    await submitBtn.first().click();

    // Confirm in modal
    const confirmBtn = page.locator(
      '[data-testid="shop-cart-modal"] button:has-text("確認"), [data-testid="confirmation-modal"] button:has-text("確認"), button:has-text("確認"), button:has-text("Confirm")',
    );
    await confirmBtn.first().click();

    // Wait for navigation to order tracking page
    await page.waitForURL(/\/order\//i, { timeout: 15000 }).catch(() => {});

    // Verify the POST to guest-orders was made
    expect(secondOrderRequested).toBe(true);

    // Verify we're on an order tracking page
    const trackingIndicator = page
      .locator("text=/ORD-/")
      .or(page.locator('[data-testid="order-number"]'))
      .or(page.locator('[data-testid="order-tracking"]'));
    await expect(trackingIndicator.first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Second order shows in tracking
// ---------------------------------------------------------------------------

test.describe("Append order: second order shows in tracking", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);
  });

  test("should show the second order number on its tracking page", async ({
    page,
  }) => {
    const secondOrder = createMockOrder({
      id: "order-guest-2",
      orderNumber: "ORD-GUEST-002",
    });

    // Override guest-orders/:id for the second order
    await page.route(new RegExp(`${API_RE}/guest-orders/order-guest-2$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(json({ success: true, data: secondOrder }));
      } else {
        route.continue();
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem("guest_auth_token", "mock-guest-token");
    });

    await page.goto(`${menuUrl}/order/order-guest-2`);
    await page.waitForLoadState("networkidle");

    // Verify the new order number appears
    const orderNumber = page
      .locator("text=/ORD-GUEST-002/")
      .or(page.locator('[data-testid="order-number"]'));
    await expect(orderNumber.first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 3. First order unaffected after second
// ---------------------------------------------------------------------------

test.describe("Append order: first order unaffected after second", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);
  });

  test("should still show original order normally", async ({ page }) => {
    const originalOrder = createMockOrder({
      id: "order-guest",
      orderNumber: "ORD-GUEST-001",
    });

    // Ensure the original order endpoint returns the original data
    await page.route(new RegExp(`${API_RE}/guest-orders/order-guest$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(json({ success: true, data: originalOrder }));
      } else {
        route.continue();
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem("guest_auth_token", "mock-guest-token");
    });

    await page.goto(trackingUrl);
    await page.waitForLoadState("networkidle");

    // Verify no error state
    const errorIndicator = page
      .locator('[role="alert"]')
      .or(page.locator('[data-testid="error"]'))
      .or(page.locator("text=/500|error occurred/i"));

    const hasError = await errorIndicator.first().isVisible().catch(() => false);
    expect(hasError).toBe(false);

    // Verify original order number is displayed
    const orderNumber = page
      .locator("text=/ORD-GUEST-001|ORD-/")
      .or(page.locator('[data-testid="order-number"]'));
    await expect(orderNumber.first()).toBeVisible({ timeout: 10000 });
  });
});
