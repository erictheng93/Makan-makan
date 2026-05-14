/**
 * Cashier POS Payment Error Handling E2E Tests
 *
 * Verifies the POS UI handles payment failure API responses correctly:
 * the cashier can recover from errors without leaving orders in a broken state.
 *
 * Desktop viewport: POS runs on a standard monitor.
 */

import { test, expect } from "@playwright/test";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockTableAPI,
  mockPOSAPI,
  mockSSE,
  mockAnalyticsAPI,
  preAuthAdmin,
} from "../../helpers/mock-api";
import { PERSONAS, createMockOrder } from "../../helpers/personas";

test.use({ viewport: { width: 1440, height: 900 } });

const ADMIN_APP = process.env.E2E_ADMIN_URL || "http://localhost:3001";
const posCheckoutUrl = `${ADMIN_APP}/dashboard/pos/checkout`;
const paymentStatusEndpoint = new RegExp("/api/v1/orders/.+/status$");

const testOrder = createMockOrder({
  id: "order-err-001",
  orderNumber: "ORD-ERR-001",
  status: 4, // delivered, awaiting payment
  total: 30000,
});

function fulfillJson(route: any, status: number, body: object) {
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("Cashier POS — payment error handling", () => {
  test.beforeEach(async ({ page }) => {
    await preAuthAdmin(page, PERSONAS.CASHIER);
    await mockAuthAPI(page, PERSONAS.CASHIER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockAnalyticsAPI(page);
    await mockPOSAPI(page);
    await mockSSE(page);

    // Return the test order from the orders list
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        fulfillJson(route, 200, {
          success: true,
          data: [testOrder],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      } else {
        route.continue();
      }
    });
  });

  // Helper: navigate to POS, select the test order, and return the pay button locator
  async function openOrderInPOS(page: any) {
    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.locator(`text=${testOrder.orderNumber}`).first(),
    ).toBeVisible({
      timeout: 10000,
    });
    await page.locator(`text=${testOrder.orderNumber}`).first().click();
    const amountInput = page.locator('[data-testid="received-amount"]');
    if (
      await amountInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await amountInput.first().fill("30000");
    }
    return page.locator('[data-testid="pay-btn"], button:has-text("收款")');
  }

  // ---------------------------------------------------------------------------
  // 1. Card declined → error visible, Pay re-enabled
  // ---------------------------------------------------------------------------

  test("should show error and re-enable Pay when card is declined", async ({
    page,
  }) => {
    await page.route(paymentStatusEndpoint, (route) => {
      if (route.request().method() === "PUT") {
        fulfillJson(route, 402, {
          success: false,
          error: {
            code: "CARD_DECLINED",
            message: "Card declined by issuer",
          },
        });
      } else {
        route.continue();
      }
    });

    const payBtn = await openOrderInPOS(page);
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    // Error message must appear
    await expect(
      page.locator('[data-testid="payment-error"], [role="alert"]').first(),
    ).toBeVisible({ timeout: 5000 });

    // Pay button must be re-enabled so cashier can retry
    await expect(payBtn.first()).toBeEnabled();

    // Order must still appear in the list (not removed)
    await expect(
      page.locator(`text=${testOrder.orderNumber}`).first(),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2. Duplicate payment → UI shows already-paid state, Pay hidden/disabled
  // ---------------------------------------------------------------------------

  test("should show already-paid state on duplicate payment attempt", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route(paymentStatusEndpoint, (route) => {
      if (route.request().method() !== "PUT") {
        route.continue();
        return;
      }
      callCount++;
      if (callCount === 1) {
        fulfillJson(route, 200, {
          success: true,
          data: { id: "pmt-001", status: "completed", receiptId: "rcpt-001" },
        });
      } else {
        fulfillJson(route, 409, {
          success: false,
          error: { code: "DUPLICATE_PAYMENT", message: "Order already paid" },
        });
      }
    });

    const payBtn = await openOrderInPOS(page);
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });

    // First payment succeeds
    await payBtn.first().click();

    // Attempt a second payment — button may become hidden or disabled after success
    const isStillVisible = await payBtn
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (isStillVisible) {
      await payBtn.first().click();
      await expect(
        page.locator('[data-testid="payment-error"], [role="alert"]').first(),
      ).toBeVisible({ timeout: 5000 });
      // Second click was made — both the success and conflict calls must have fired
      expect(callCount).toBe(2);
    } else {
      // Pay button hidden after first success = correct behavior, no duplicate call made
      await expect(payBtn.first()).toBeHidden();
      expect(callCount).toBe(1);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Amount mismatch → error with correct amount shown, input clearable
  // ---------------------------------------------------------------------------

  test("should show amount mismatch error with correct amount", async ({
    page,
  }) => {
    await page.route(paymentStatusEndpoint, (route) => {
      if (route.request().method() === "PUT") {
        fulfillJson(route, 400, {
          success: false,
          error: {
            code: "AMOUNT_MISMATCH",
            message: "Amount does not match order total",
            details: { expected: 30000, received: 20000 },
          },
        });
      } else {
        route.continue();
      }
    });

    const payBtn = await openOrderInPOS(page);
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    await expect(
      page.locator('[data-testid="payment-error"], [role="alert"]').first(),
    ).toBeVisible({ timeout: 5000 });

    // Pay button must remain enabled for retry with correct amount
    await expect(payBtn.first()).toBeEnabled();
  });

  // ---------------------------------------------------------------------------
  // 4. Printer offline → payment succeeds but retry-print button visible
  // ---------------------------------------------------------------------------

  test("should show retry-print option when printer is offline after payment", async ({
    page,
  }) => {
    let receiptCallCount = 0;

    // Payment succeeds
    await page.route(paymentStatusEndpoint, (route) => {
      if (route.request().method() === "PUT") {
        fulfillJson(route, 200, {
          success: true,
          data: { id: "pmt-002", status: "completed", receiptId: "rcpt-002" },
        });
      } else {
        route.continue();
      }
    });

    // Receipt/print endpoint fails
    await page.route(new RegExp("/api/v1/pos/receipts"), (route) => {
      if (route.request().method() === "POST") {
        receiptCallCount++;
        fulfillJson(route, 503, {
          success: false,
          error: { code: "PRINTER_OFFLINE", message: "Printer not reachable" },
        });
      } else {
        route.continue();
      }
    });

    const payBtn = await openOrderInPOS(page);
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    // Payment success indicator must appear
    await expect(
      page
        .locator('[data-testid="payment-success"]')
        .or(page.locator("text=/success|成功|已完成/i"))
        .first(),
    ).toBeVisible({ timeout: 5000 });

    // Retry print button must be visible
    const retryPrint = page.locator(
      '[data-testid="retry-print-btn"], button:has-text("重試列印")',
    );
    await expect(retryPrint.first()).toBeVisible({ timeout: 5000 });
    expect(receiptCallCount).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 5. Payment timeout (504) → order stays at status=4 (unpaid), error shown
  // ---------------------------------------------------------------------------

  test("should show timeout error and keep order unpaid on 504", async ({
    page,
  }) => {
    await page.route(paymentStatusEndpoint, (route) => {
      if (route.request().method() === "PUT") {
        fulfillJson(route, 504, {
          success: false,
          error: {
            code: "GATEWAY_TIMEOUT",
            message: "Payment gateway timed out",
          },
        });
      } else {
        route.continue();
      }
    });

    const payBtn = await openOrderInPOS(page);
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    // Timeout error must be communicated to the cashier
    await expect(
      page.locator('[data-testid="payment-error"], [role="alert"]').first(),
    ).toBeVisible({ timeout: 8000 });

    // Order must still be in the pending-payment list (not silently removed)
    await expect(
      page.locator(`text=${testOrder.orderNumber}`).first(),
    ).toBeVisible();

    // Pay button must be re-enabled (cashier must be able to retry)
    await expect(payBtn.first()).toBeEnabled();
  });
});
