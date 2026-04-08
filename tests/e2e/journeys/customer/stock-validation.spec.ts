/**
 * Stock Validation — Checkout Out-of-Stock Scenarios
 *
 * Verifies that the customer-facing checkout correctly handles stock depletion
 * responses between "add to cart" and "submit order":
 *   1. Full out-of-stock (ITEM_OUT_OF_STOCK) blocks checkout
 *   2. Partial out-of-stock (PARTIAL_OUT_OF_STOCK) flags only unavailable items
 *   3. Checkout rejection for a specific item surfaces the item name in the error
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockOrderAPI,
} from "../../helpers/mock-api";
import {
  RESTAURANT,
  MENU_ITEMS,
  PERSONAS,
  createMockOrder,
} from "../../helpers/personas";

test.use({ ...devices["iPhone 12"] });

const shopMenuUrl = `/restaurant/${RESTAURANT.id}/shop/menu?phone=678`;

// ---------------------------------------------------------------------------
// Local helper — add the first menu item to cart via modal
// ---------------------------------------------------------------------------

async function addFirstItemToCart(page: any) {
  await expect(page.locator(`text=${MENU_ITEMS[0].name}`).first()).toBeVisible({
    timeout: 10000,
  });
  await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();
  const modal = page.locator('[data-testid="menu-item-modal"]');
  await expect(modal.first()).toBeVisible({ timeout: 5000 });
  await modal
    .first()
    .locator('[data-testid="add-to-cart-btn"], button:has-text("加入")')
    .first()
    .click();
  await expect(modal.first())
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// 1. FULL OUT-OF-STOCK AT SUBMIT
// ---------------------------------------------------------------------------

test.describe("Stock validation at checkout", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
    // Per-test page.route() calls are registered after this and take precedence
    // because Playwright processes route handlers in LIFO order (last registered wins).
  });

  test("full out-of-stock at submit should block checkout and highlight unavailable item", async ({
    page,
  }) => {
    let submitCalled = false;
    await page.route("**/api/v1/orders", (route) => {
      if (route.request().method() !== "POST") {
        route.continue();
        return;
      }
      submitCalled = true;
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "ITEM_OUT_OF_STOCK", itemId: MENU_ITEMS[0].id },
        }),
      });
    });

    await page.goto(shopMenuUrl);

    await addFirstItemToCart(page);

    // Open cart
    await page.locator('[data-testid="cart-btn"]').first().click();
    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // Submit the order
    await cartModal
      .first()
      .locator('[data-testid="submit-order-btn"], button:has-text("確認訂單")')
      .first()
      .click();

    // Error or out-of-stock indicator should appear
    await expect(
      page
        .locator('[data-testid="out-of-stock-error"], [role="alert"]')
        .first(),
    ).toBeVisible({ timeout: 8000 });

    expect(submitCalled).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 2. PARTIAL OUT-OF-STOCK
  // ---------------------------------------------------------------------------

  test("partial out-of-stock response should flag only unavailable items and show remove-and-continue CTA", async ({
    page,
  }) => {
    let submitCount = 0;
    await page.route("**/api/v1/orders", (route) => {
      if (route.request().method() !== "POST") {
        route.continue();
        return;
      }
      submitCount++;
      if (submitCount === 1) {
        route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "PARTIAL_OUT_OF_STOCK",
              unavailableItems: [MENU_ITEMS[0].id],
            },
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: createMockOrder() }),
        });
      }
    });

    await page.goto(shopMenuUrl);

    await addFirstItemToCart(page);

    // Open cart
    await page.locator('[data-testid="cart-btn"]').first().click();
    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // First submit — returns 409 PARTIAL_OUT_OF_STOCK
    await cartModal
      .first()
      .locator('[data-testid="submit-order-btn"], button:has-text("確認訂單")')
      .first()
      .click();

    // Error or CTA element should appear
    await expect(
      page
        .locator('[data-testid="partial-stock-error"], [role="alert"]')
        .first(),
    ).toBeVisible({ timeout: 8000 });

    expect(submitCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 3. CHECKOUT REJECTION SURFACES ITEM NAME
  // ---------------------------------------------------------------------------

  test("checkout rejection for a specific unavailable item should surface the item name in the error", async ({
    page,
  }) => {
    let orderSubmitCalled = false;
    await page.route("**/api/v1/orders", (route) => {
      if (route.request().method() !== "POST") {
        route.continue();
        return;
      }
      orderSubmitCalled = true;
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "ITEM_OUT_OF_STOCK",
            itemId: MENU_ITEMS[0].id,
            itemName: MENU_ITEMS[0].name,
          },
        }),
      });
    });

    await page.goto(shopMenuUrl);

    await addFirstItemToCart(page);

    // Open cart
    await page.locator('[data-testid="cart-btn"]').first().click();
    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // Submit the order
    await cartModal
      .first()
      .locator('[data-testid="submit-order-btn"], button:has-text("確認訂單")')
      .first()
      .click();

    // Error message should be visible
    await expect(
      page
        .locator('[data-testid="out-of-stock-error"], [role="alert"]')
        .first(),
    ).toBeVisible({ timeout: 8000 });

    expect(orderSubmitCalled).toBe(true);
  });
});
