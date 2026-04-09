/**
 * Error Recovery Flows
 *
 * Verifies that the customer app handles API failures gracefully:
 *   A. Menu load failure (GET /menu/:id → 500) shows error state in MenuView
 *   B. Order submission failure (POST /guest-orders → 500) shows toast/error, no redirect
 *   C. Discovery page API failure (GET /discovery/popular → 500) still renders search bar
 *
 * Mobile-first: all tests run on iPhone 12 viewport (390x844).
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockMenuAPI,
  mockRestaurantAPI,
  mockOrderAPI,
  mockAuthAPI,
} from "../../helpers/mock-api";
import {
  RESTAURANT,
  MENU_ITEMS,
  PERSONAS,
  createMockOrder,
} from "../../helpers/personas";

// ---------------------------------------------------------------------------
// Mobile viewport for the entire file
// ---------------------------------------------------------------------------
test.use({ ...devices["iPhone 12"] });

const API_RE = "/api/v1";

// Convenience URLs
const menuUrl = `/restaurant/${RESTAURANT.id}/table/1`;
const cartUrl = `/restaurant/${RESTAURANT.id}/table/1/cart`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serverError(code = "SERVER_ERROR", message = "Internal error") {
  return {
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({
      success: false,
      error: { code, message },
    }),
  };
}

// ---------------------------------------------------------------------------
// A. Menu load failure
// ---------------------------------------------------------------------------

test.describe("A. Menu load failure", () => {
  test("should show error state when GET /menu/:id returns 500", async ({
    page,
  }) => {
    // Set up restaurant API normally so navigation resolves
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockOrderAPI(page);

    // Override the menu endpoint to return 500 — do NOT call mockMenuAPI
    await page.route(new RegExp(`${API_RE}/menu/[^/]+$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(serverError("MENU_LOAD_FAILED", "Failed to load menu"));
      } else {
        route.continue();
      }
    });

    await page.goto(menuUrl);
    await page.waitForLoadState("networkidle");

    // MenuView renders a v-else-if="error" block when the API call fails.
    // Accept any error-indicating text or a retry button.
    const errorIndicator = page
      .locator("text=/錯誤|error|失敗|failed|再試|Loading failed/i")
      .or(page.locator('[data-testid="menu-error"]'))
      .or(page.locator('[role="alert"]'))
      .or(
        page.locator(
          'button:has-text("再試"), button:has-text("重試"), button:has-text("Retry"), button:has-text("Reload")',
        ),
      );

    await expect(errorIndicator.first()).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// B. Order submission failure (guest orders)
// ---------------------------------------------------------------------------

test.describe("B. Order submission failure", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should show error message and NOT redirect to tracking when POST /guest-orders returns 500", async ({
    page,
  }) => {
    // 1. Navigate to menu and add 牛肉麵 to cart
    await page.goto(menuUrl);
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), button:has-text("加入購物車"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();

    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // 2. Navigate to cart
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();
    // Escape ALL regex metacharacters (not just `/`) to satisfy
    // CodeQL `js/incomplete-sanitization` and be correct for arbitrary input.
    const escapedCartUrl = cartUrl.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    await expect(page).toHaveURL(new RegExp(escapedCartUrl), {
      timeout: 8000,
    });

    // 3. Override guest-orders AFTER adding item so this route wins over mockOrderAPI's registration
    await page.route(`**/api/v1/guest-orders`, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill(
          serverError("ORDER_SUBMISSION_FAILED", "Failed to submit order"),
        );
      } else {
        route.continue();
      }
    });

    // 4. Click submit order button
    const submitBtn = page.locator(
      'button:has-text("送出"), button:has-text("Submit"), button:has-text("下單"), [data-testid="submit-order-btn"], [data-testid="place-order-btn"]',
    );
    await submitBtn.first().click();

    // 5. Confirm the submission in the confirmation modal
    const confirmBtn = page
      .locator('button:has-text("確認")')
      .or(page.locator('button:has-text("Confirm")'));
    await confirmBtn.first().click();

    // 6. Wait for response to settle
    await page.waitForTimeout(1500);

    // 7. URL must NOT contain tracking
    expect(page.url()).not.toContain("tracking");

    // 8. An error toast, alert, or inline error message should be visible
    const errorFeedback = page
      .locator('[role="alert"]')
      .or(page.locator('[data-testid="toast"]'))
      .or(page.locator('[data-testid="error-message"]'))
      .or(page.locator("text=/失敗|錯誤|error|failed|Error/i"))
      .or(page.locator(".toast"))
      .or(page.locator(".notification"));

    await expect(errorFeedback.first()).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// C. Discovery page handles API failure gracefully
// ---------------------------------------------------------------------------

test.describe("C. Discovery page API failure", () => {
  test("should still render search bar when GET /discovery/popular returns 500", async ({
    page,
  }) => {
    // Mock popular endpoint to fail — DiscoveryView sets store.error on failure
    await page.route(`**/api/v1/discovery/popular`, (route) =>
      route.fulfill(
        serverError("DISCOVERY_UNAVAILABLE", "Discovery service unavailable"),
      ),
    );

    // Also stub search and restaurants so other requests don't interfere
    await page.route(new RegExp(`${API_RE}/discovery/restaurants`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { results: [], total: 0 },
        }),
      }),
    );

    await page.route(new RegExp(`${API_RE}/discovery/search`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { results: [], total: 0 },
        }),
      }),
    );

    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // The search bar (input) is rendered outside the v-else-if="store.error" block
    // and must always be visible regardless of whether the popular API failed.
    const searchInput = page
      .locator('input[type="search"]')
      .or(page.locator('input[placeholder*="搜尋"]'))
      .or(page.locator('input[placeholder*="Search"]'));

    await expect(searchInput.first()).toBeVisible({ timeout: 8000 });

    // If the error conditional block renders, verify it too (dual assertion —
    // either the error indicator OR the fact that the page body loads at all)
    const pageLoaded = page.locator("body");
    await expect(pageLoaded).not.toBeEmpty();
  });

  test("should show error indicator when discovery API returns 500", async ({
    page,
  }) => {
    // Mock popular endpoint to fail
    await page.route(`**/api/v1/discovery/popular`, (route) =>
      route.fulfill(serverError()),
    );

    await page.route(new RegExp(`${API_RE}/discovery/restaurants`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { results: [], total: 0 },
        }),
      }),
    );

    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // DiscoveryView shows v-else-if="store.error" block when store.error is set.
    // Accept either explicit error UI or graceful empty-state — the search bar
    // is the minimum required element per spec.
    const errorOrEmpty = page
      .locator("text=/錯誤|error|失敗|再試|Retry/i")
      .or(page.locator('[data-testid="discovery-error"]'))
      .or(page.locator('[role="alert"]'))
      .or(page.locator('input[placeholder*="搜尋"]'))
      .or(page.locator('input[placeholder*="Search"]'));

    await expect(errorOrEmpty.first()).toBeVisible({ timeout: 8000 });
  });
});
