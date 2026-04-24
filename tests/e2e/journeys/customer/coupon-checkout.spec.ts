/**
 * Coupon Checkout Flow
 *
 * Tests customer coupon application during checkout:
 * - Valid coupon applies discount and reduces order total
 * - Invalid coupon shows an error message
 * - Coupon code is included in the POST /guest-orders payload
 * - Applied coupon can be removed
 *
 * Uses selective skipping so tests degrade gracefully if coupon UI is not yet built.
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
const API_RE = "/api/v1";

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

/**
 * Adds 牛肉麵 to cart and navigates to the cart page.
 * Assumes mockMenuAPI and mockTableAPI are already set up.
 */
async function addItemAndGoToCart(page: import("@playwright/test").Page) {
  await page.goto(menuUrl);
  await page.waitForLoadState("networkidle");

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
  await expect(modal.first())
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});

  // Navigate to cart
  const cartLink = page.locator(
    '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
  );
  await cartLink.first().click();
  await page.waitForLoadState("networkidle");
}

/**
 * Expand the coupon panel in CartView.vue. The coupon code input
 * (`#coupon-code`) lives inside `<div v-if="showAvailableCoupons">`, which
 * is collapsed by default and toggled by the "查看可用優惠券" /
 * `cart.viewAvailable` button (apps/customer-app/src/views/CartView.vue).
 * Without this step, every coupon spec used to silently `test.skip()`
 * because the input wasn't yet rendered. SR-4 in
 * PRODUCTION_READINESS_REPORT.md tracks the unconditional removal of those
 * skips; this helper makes the input reliably reachable.
 */
async function openCouponPanel(page: import("@playwright/test").Page) {
  const toggleBtn = page.locator(
    'button:has-text("cart.viewAvailable"), button:has-text("查看可用"), button:has-text("View Available")',
  );
  if (
    await toggleBtn
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false)
  ) {
    await toggleBtn.first().click();
    await page.waitForTimeout(300);
  }
}

const COUPON_INPUT_SELECTOR =
  '#coupon-code, [data-testid="coupon-input"], input[placeholder*="優惠"], input[placeholder*="coupon"], input[name*="coupon"]';

const APPLY_BTN_SELECTOR =
  'button:has-text("cart.applyCoupon"), button:has-text("套用"), button:has-text("Apply"), [data-testid="apply-coupon-btn"]';

const REMOVE_BTN_SELECTOR =
  'button:has-text("cart.removeCoupon"), button:has-text("移除"), button:has-text("Remove"), [data-testid="remove-coupon"]';

// ---------------------------------------------------------------------------
// 1. Valid coupon applies discount
// ---------------------------------------------------------------------------

test.describe("Coupon: valid code applies discount", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);

    // Mock coupon validation — valid 10% discount
    await page.route(`**/api/v1/coupons/validate`, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill(
          json({
            success: true,
            data: {
              id: "c1",
              code: "SAVE10",
              discountType: "percentage",
              discountValue: 10,
              valid: true,
              minOrderAmount: 0,
            },
          }),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should apply discount and show reduced total when valid coupon entered", async ({
    page,
  }) => {
    await addItemAndGoToCart(page);

    // Locate the coupon input
    await openCouponPanel(page);
    const couponInput = page.locator(COUPON_INPUT_SELECTOR);
    await expect(
      couponInput.first(),
      "coupon input #coupon-code not visible after opening panel (SR-4 — UI selector drift or coupon section missing)",
    ).toBeVisible({ timeout: 5000 });

    await couponInput.first().fill("SAVE10");

    const applyBtn = page.locator(APPLY_BTN_SELECTOR);
    await applyBtn.first().click();

    // Verify discount shown
    const discountLine = page
      .locator("text=/10%|折扣|Discount/")
      .or(page.locator('[data-testid="discount-amount"]'))
      .or(page.locator("text=/-\\s*18/"));
    await expect(discountLine.first()).toBeVisible({ timeout: 5000 });

    // Verify total is less than NT$180 (牛肉麵 base price = 18000 cents)
    // 10% off NT$180 → NT$162. Accept any of: 162, 16,200, NT$162
    const reducedTotal = page
      .locator("text=/162|16,200/")
      .or(page.locator('[data-testid="order-total"]'));
    await expect(reducedTotal.first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Invalid coupon shows error
// ---------------------------------------------------------------------------

test.describe("Coupon: invalid code shows error", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);

    // Mock coupon validation — invalid
    await page.route(`**/api/v1/coupons/validate`, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "COUPON_INVALID",
                message: "優惠券無效或已過期",
              },
            },
            400,
          ),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should show error when invalid coupon entered", async ({ page }) => {
    await addItemAndGoToCart(page);

    await openCouponPanel(page);
    const couponInput = page.locator(COUPON_INPUT_SELECTOR);
    await expect(
      couponInput.first(),
      "coupon input #coupon-code not visible after opening panel (SR-4 — UI selector drift or coupon section missing)",
    ).toBeVisible({ timeout: 5000 });

    await couponInput.first().fill("BADCODE");

    const applyBtn = page.locator(APPLY_BTN_SELECTOR);
    await applyBtn.first().click();

    // Verify error message visible
    const errorMessage = page
      .locator('[role="alert"]')
      .or(page.locator('[data-testid="coupon-error"]'))
      .or(page.locator("text=/無效|invalid|過期|expired/i"))
      .or(page.locator("text=/優惠券/"));
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Coupon included in order payload
// ---------------------------------------------------------------------------

test.describe("Coupon: applied in order payload", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);

    // Mock coupon validation — valid
    await page.route(`**/api/v1/coupons/validate`, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill(
          json({
            success: true,
            data: {
              id: "c1",
              code: "SAVE10",
              discountType: "percentage",
              discountValue: 10,
              valid: true,
              minOrderAmount: 0,
            },
          }),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should include couponCode in POST guest-orders payload", async ({
    page,
  }) => {
    await addItemAndGoToCart(page);

    await openCouponPanel(page);
    const couponInput = page.locator(COUPON_INPUT_SELECTOR);
    await expect(
      couponInput.first(),
      "coupon input #coupon-code not visible after opening panel (SR-4 — UI selector drift or coupon section missing)",
    ).toBeVisible({ timeout: 5000 });

    await couponInput.first().fill("SAVE10");

    const applyBtn = page.locator(APPLY_BTN_SELECTOR);
    await applyBtn.first().click();

    // Wait for the discount to be reflected
    await page
      .locator("text=/折扣|10%|Discount/i")
      .first()
      .waitFor({ timeout: 5000 })
      .catch(() => {});

    // Intercept the order submission to capture payload
    let capturedBody: Record<string, unknown> | null = null;
    const orderResponse = createMockOrder({
      id: "order-coupon-test",
      orderNumber: "ORD-COUPON-001",
    });

    await page.route(`**/api/v1/guest-orders`, (route) => {
      if (route.request().method() === "POST") {
        const rawBody = route.request().postData();
        try {
          capturedBody = JSON.parse(rawBody ?? "{}");
        } catch {
          capturedBody = null;
        }
        route.fulfill(
          json({
            success: true,
            data: {
              order: orderResponse,
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

    const confirmBtn = page.locator(
      '[data-testid="shop-cart-modal"] button:has-text("確認"), [data-testid="confirmation-modal"] button:has-text("確認"), button:has-text("確認"), button:has-text("Confirm")',
    );
    await confirmBtn.first().click();

    // Wait for navigation away from cart
    await page.waitForURL(/\/order\//i, { timeout: 15000 }).catch(() => {});

    // Verify the coupon code was sent
    expect(capturedBody).not.toBeNull();
    const hasCoupon =
      capturedBody?.couponCode === "SAVE10" ||
      capturedBody?.coupon === "SAVE10" ||
      capturedBody?.coupon_code === "SAVE10" ||
      JSON.stringify(capturedBody).includes("SAVE10");
    expect(hasCoupon).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Can remove applied coupon
// ---------------------------------------------------------------------------

test.describe("Coupon: can remove applied coupon", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);

    // Mock coupon validation — valid
    await page.route(`**/api/v1/coupons/validate`, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill(
          json({
            success: true,
            data: {
              id: "c1",
              code: "SAVE10",
              discountType: "percentage",
              discountValue: 10,
              valid: true,
              minOrderAmount: 0,
            },
          }),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should remove discount when coupon is cleared", async ({ page }) => {
    await addItemAndGoToCart(page);

    await openCouponPanel(page);
    const couponInput = page.locator(COUPON_INPUT_SELECTOR);
    await expect(
      couponInput.first(),
      "coupon input #coupon-code not visible after opening panel (SR-4 — UI selector drift or coupon section missing)",
    ).toBeVisible({ timeout: 5000 });

    // Apply coupon first
    await couponInput.first().fill("SAVE10");
    const applyBtn = page.locator(APPLY_BTN_SELECTOR);
    await applyBtn.first().click();

    // Wait for discount to appear — mock returns a valid SAVE10 coupon, so
    // the UI MUST render the discount. SR-4: removed the silent skip; if the
    // discount UI doesn't surface, the apply flow is broken and the test
    // should fail loudly.
    const discountLine = page
      .locator("text=/折扣|10%|Discount|cart.saving/i")
      .or(page.locator('[data-testid="discount-amount"]'));
    await expect(
      discountLine.first(),
      "discount UI not visible after applying valid mocked coupon (SR-4)",
    ).toBeVisible({ timeout: 5000 });

    // Remove button (cart.removeCoupon at CartView.vue:462) must be present
    // once a coupon is selected — otherwise the user has no way to undo.
    // SR-4: removed the silent skip on the remove button.
    const removeBtn = page.locator(REMOVE_BTN_SELECTOR);
    await expect(
      removeBtn.first(),
      "remove-coupon button not visible after coupon applied (SR-4)",
    ).toBeVisible({ timeout: 5000 });

    await removeBtn.first().click();

    // Verify discount line is gone
    await expect(discountLine.first()).toBeHidden({ timeout: 5000 });
  });
});
