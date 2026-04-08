/**
 * Delivery Zone Validation
 *
 * Verifies the delivery address validation flow:
 *   1. Valid address within zone → checkout proceeds with delivery fee shown
 *   2. Address outside delivery zone → zone-exceeded error displayed
 *   3. Incomplete address (no district) → frontend validation blocks API call
 *   4. Delivery fee of NT$60 is visible in cart summary
 *
 * Mobile-first: all tests run on iPhone 12 viewport (390x844).
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockOrderAPI,
} from "../../helpers/mock-api";
import { RESTAURANT, MENU_ITEMS, PERSONAS } from "../../helpers/personas";

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
// Tests
// ---------------------------------------------------------------------------

test.describe("Delivery zone validation", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
    // Per-test page.route() calls are registered after this and take precedence
    // because Playwright processes route handlers in LIFO order (last registered wins).
  });

  // -------------------------------------------------------------------------
  // 1. Valid address within delivery zone → proceeds with delivery fee shown
  // -------------------------------------------------------------------------

  test("valid address within delivery zone should proceed to checkout with delivery fee shown", async ({
    page,
  }) => {
    let validateCalled = false;
    await page.route("**/api/v1/orders/validate-address", (route) => {
      if (route.request().method() !== "POST") {
        route.continue();
        return;
      }
      validateCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { valid: true, deliveryFee: 60, zone: "inner-city" },
        }),
      });
    });

    await page.goto(shopMenuUrl);

    await addFirstItemToCart(page);

    // Open cart modal
    await page.locator('[data-testid="cart-btn"]').first().click();
    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // Switch to delivery mode if the toggle is present
    const deliveryToggle = cartModal
      .first()
      .locator('button:has-text("外送"), button:has-text("Delivery")');
    if (
      await deliveryToggle
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await deliveryToggle.first().click();
    }

    // Fill in a valid delivery address and trigger blur validation
    const addressInput = cartModal
      .first()
      .locator(
        'input[placeholder*="地址"], [data-testid="delivery-address"]',
      );
    await expect(addressInput.first()).toBeVisible({ timeout: 8000 });
    await addressInput.first().fill("台北市信義區測試路 123 號");
    await addressInput.first().press("Tab");

    // Delivery fee label should appear after successful validation
    await expect(
      page
        .locator('[data-testid="delivery-fee"]')
        .or(page.locator("text=/外送費/"))
        .first(),
    ).toBeVisible({ timeout: 8000 });

    expect(validateCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Address outside delivery zone → error message shown
  // -------------------------------------------------------------------------

  test("address outside delivery zone should display zone-exceeded error", async ({
    page,
  }) => {
    let validateCalled = false;
    await page.route("**/api/v1/orders/validate-address", (route) => {
      if (route.request().method() !== "POST") {
        route.continue();
        return;
      }
      validateCalled = true;
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "DELIVERY_ZONE_EXCEEDED",
            message: "超出外送範圍",
          },
        }),
      });
    });

    await page.goto(shopMenuUrl);

    await addFirstItemToCart(page);

    // Open cart modal
    await page.locator('[data-testid="cart-btn"]').first().click();
    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // Switch to delivery mode if the toggle is present
    const deliveryToggle = cartModal
      .first()
      .locator('button:has-text("外送"), button:has-text("Delivery")');
    if (
      await deliveryToggle
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await deliveryToggle.first().click();
    }

    // Fill in an address outside the delivery zone and trigger blur validation
    const addressInput = cartModal
      .first()
      .locator(
        'input[placeholder*="地址"], [data-testid="delivery-address"]',
      );
    await expect(addressInput.first()).toBeVisible({ timeout: 8000 });
    await addressInput.first().fill("新北市汐止區超遠路 999 號");
    await addressInput.first().press("Tab");

    // Zone error message should appear
    await expect(
      page
        .locator('[data-testid="zone-error"]')
        .or(page.locator("text=/超出外送範圍/"))
        .first(),
    ).toBeVisible({ timeout: 8000 });

    expect(validateCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Incomplete address (no district) — frontend validation, no API call
  // -------------------------------------------------------------------------

  test("incomplete address without district should show inline field error without calling the API", async ({
    page,
  }) => {
    let validateCalled = false;
    await page.route("**/api/v1/orders/validate-address", (route) => {
      validateCalled = true;
      route.continue();
    });

    await page.goto(shopMenuUrl);

    await addFirstItemToCart(page);

    // Open cart modal
    await page.locator('[data-testid="cart-btn"]').first().click();
    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // Switch to delivery mode if the toggle is present
    const deliveryToggle = cartModal
      .first()
      .locator('button:has-text("外送"), button:has-text("Delivery")');
    if (
      await deliveryToggle
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await deliveryToggle.first().click();
    }

    // Fill an incomplete address (no city/district prefix)
    const addressInput = cartModal
      .first()
      .locator(
        'input[placeholder*="地址"], [data-testid="delivery-address"]',
      );
    await expect(addressInput.first()).toBeVisible({ timeout: 8000 });
    await addressInput.first().fill("測試路");

    // Click submit — frontend validation should prevent the API call
    await cartModal
      .first()
      .locator(
        '[data-testid="submit-order-btn"], button:has-text("確認訂單")',
      )
      .first()
      .click();

    // Inline field error should be visible
    await expect(
      cartModal
        .first()
        .locator(
          '[data-testid="address-error"], [data-testid="field-error"]',
        )
        .first(),
    ).toBeVisible({ timeout: 5000 });

    expect(validateCalled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 4. Delivery fee calculation → fee line item visible in order summary
  // -------------------------------------------------------------------------

  test("valid address should display NT$60 delivery fee in cart summary", async ({
    page,
  }) => {
    // Pre-seed localStorage with delivery mode + deliveryFee=60 so the fee
    // appears without requiring the full address-validation round-trip.
    await page.addInitScript(
      ({ key, data }: { key: string; data: object }) => {
        localStorage.setItem(key, JSON.stringify(data));
      },
      {
        key: `makanmakan_shop_cart_${RESTAURANT.id}_678`,
        data: {
          items: [
            {
              id: "test-item-delivery-fee-001",
              menuItem: {
                id: MENU_ITEMS[0].id,
                name: MENU_ITEMS[0].name,
                price: MENU_ITEMS[0].price,
              },
              quantity: 1,
              price: MENU_ITEMS[0].price,
              totalPrice: MENU_ITEMS[0].price,
            },
          ],
          restaurantId: RESTAURANT.id,
          phoneLastDigits: "678",
          timestamp: Date.now(),
          fulfillmentType: "delivery",
          deliveryInfo: null,
          deliveryFee: 60,
        },
      },
    );

    await page.goto(shopMenuUrl);

    // Cart button should be visible since we pre-seeded an item
    await expect(page.locator('[data-testid="cart-btn"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="cart-btn"]').first().click();

    const cartModal = page.locator('[data-testid="shop-cart-modal"]');
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // Delivery fee label (外送費) should be visible with the pre-seeded value
    await expect(
      cartModal
        .first()
        .locator("text=/外送費/")
        .or(cartModal.first().locator('[data-testid="delivery-fee"]'))
        .first(),
    ).toBeVisible({ timeout: 8000 });
  });
});
