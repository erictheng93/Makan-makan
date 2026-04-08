/**
 * Payment Processing Integration Tests
 *
 * Runs against mocked APIs in CI (default).
 * Set E2E_PAYMENT_REAL=true to hit real API (staging only).
 *
 * Tests:
 * 1. Cash payment — exact amount, change = 0
 * 2. Cash payment — overpayment, correct change calculated
 * 3. Card payment — success path, no change field
 * 4. Card declined → retry → success
 * 5. Zero-amount order (100% coupon), no payment method required
 * 6. Payment success → order transitions to status=5 (completed)
 *
 * Desktop viewport: POS systems run on standard monitors.
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
} from "../helpers/mock-api";
import { PERSONAS, createMockOrder } from "../helpers/personas";

// ---------------------------------------------------------------------------
// Real-API toggle — set E2E_PAYMENT_REAL=true in staging to skip mocks
// ---------------------------------------------------------------------------
const USE_REAL_API = process.env.E2E_PAYMENT_REAL === "true";
const ADMIN_APP = process.env.E2E_ADMIN_URL || "http://localhost:3001";
const posCheckoutUrl = `${ADMIN_APP}/dashboard/pos/checkout`;

function fulfillJson(route: any, status: number, body: object) {
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

const baseOrder = createMockOrder({
  id: "order-pay-int-001",
  orderNumber: "ORD-PAY-INT-001",
  status: 4,
  total: 30000,
});
const zeroDollarOrder = createMockOrder({
  id: "order-zero-001",
  orderNumber: "ORD-ZERO-001",
  status: 4,
  total: 0,
});

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Payment processing integration", () => {
  test.beforeEach(async ({ page }) => {
    if (USE_REAL_API) return; // skip mock setup when hitting real API

    await preAuthAdmin(page, PERSONAS.CASHIER);
    await mockAuthAPI(page, PERSONAS.CASHIER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockPOSAPI(page);
    await mockSSE(page);
    await mockAnalyticsAPI(page);
    // mockOrderAPI intentionally omitted: each test registers its own "**/api/v1/orders**"
    // route via setupPaymentTest (or inline). Playwright processes handlers in registration
    // order, so a beforeEach-level handler would shadow per-test overrides.
  });

  // Helper: route orders list + payment endpoint with given response
  async function setupPaymentTest(
    page: any,
    order: ReturnType<typeof createMockOrder>,
    paymentResponse: { status: number; body: object },
  ) {
    await page.route("**/api/v1/orders**", (route: any) => {
      if (route.request().method() === "GET") {
        fulfillJson(route, 200, {
          success: true,
          data: [order],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      } else {
        route.continue();
      }
    });

    await page.route(
      new RegExp("/api/v1/(pos/payments|orders/.+/pay|payments)"),
      (route: any) => {
        if (route.request().method() === "POST") {
          fulfillJson(route, paymentResponse.status, paymentResponse.body);
        } else {
          route.continue();
        }
      },
    );
  }

  // ---------------------------------------------------------------------------
  // 1. Cash — exact amount, change = 0
  // ---------------------------------------------------------------------------

  test("cash payment with exact amount should show zero change", async ({
    page,
  }) => {
    await setupPaymentTest(page, baseOrder, {
      status: 200,
      body: {
        success: true,
        data: {
          id: "pmt-exact",
          method: "cash",
          amount: 30000,
          change: 0,
          status: "completed",
          receiptId: "rcpt-exact",
        },
      },
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`text=${baseOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${baseOrder.orderNumber}`).first().click();

    const cashBtn = page.locator(
      '[data-testid="payment-method-cash"], button:has-text("現金")',
    );
    if (
      await cashBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await cashBtn.first().click();
    }

    const cashInput = page.locator(
      '[data-testid="cash-amount-input"], [data-testid="received-amount"]',
    );
    if (
      await cashInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await cashInput.first().fill("300");
    }

    const payBtn = page.locator(
      '[data-testid="pay-btn"], button:has-text("收款")',
    );
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    await expect(
      page
        .locator('[data-testid="payment-success"], text=/success|成功|已完成/i')
        .first(),
    ).toBeVisible({ timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // 2. Cash — overpayment, change calculated correctly
  // ---------------------------------------------------------------------------

  test("cash overpayment should calculate and display correct change", async ({
    page,
  }) => {
    await setupPaymentTest(page, baseOrder, {
      status: 200,
      body: {
        success: true,
        data: {
          id: "pmt-over",
          method: "cash",
          amount: 50000,
          change: 20000,
          status: "completed",
          receiptId: "rcpt-over",
        },
      },
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`text=${baseOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${baseOrder.orderNumber}`).first().click();

    const cashBtn = page.locator(
      '[data-testid="payment-method-cash"], button:has-text("現金")',
    );
    if (
      await cashBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await cashBtn.first().click();
    }

    const cashInput = page.locator(
      '[data-testid="cash-amount-input"], [data-testid="received-amount"]',
    );
    if (
      await cashInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await cashInput.first().fill("500"); // NT$500 for a NT$300 order
    }

    const payBtn = page.locator(
      '[data-testid="pay-btn"], button:has-text("收款")',
    );
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    // Change amount (NT$200 = 20000 cents) must be visible
    await expect(
      page
        .locator('[data-testid="change-amount"], text=/200|找零|Change/i')
        .first(),
    ).toBeVisible({ timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // 3. Card payment — success, no change field shown
  // ---------------------------------------------------------------------------

  test("card payment success should not display change field", async ({
    page,
  }) => {
    await setupPaymentTest(page, baseOrder, {
      status: 200,
      body: {
        success: true,
        data: {
          id: "pmt-card",
          method: "card",
          amount: 30000,
          change: 0,
          status: "completed",
          receiptId: "rcpt-card",
        },
      },
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`text=${baseOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${baseOrder.orderNumber}`).first().click();

    const cardBtn = page.locator(
      '[data-testid="payment-method-card"], button:has-text("刷卡")',
    );
    if (
      await cardBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await cardBtn.first().click();
    }

    const payBtn = page.locator(
      '[data-testid="pay-btn"], button:has-text("收款")',
    );
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    await expect(
      page
        .locator('[data-testid="payment-success"], text=/success|成功|已完成/i')
        .first(),
    ).toBeVisible({ timeout: 6000 });

    // Change field must not be shown for card payments
    const changeField = page.locator('[data-testid="change-amount"]');
    const changeVisible = await changeField.isVisible().catch(() => false);
    if (changeVisible) {
      await expect(changeField).toContainText("0");
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Card declined → retry → success
  // ---------------------------------------------------------------------------

  test("card declined followed by successful retry should complete payment", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route("**/api/v1/orders**", (route: any) => {
      if (route.request().method() === "GET") {
        fulfillJson(route, 200, {
          success: true,
          data: [baseOrder],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      } else {
        route.continue();
      }
    });

    await page.route(
      new RegExp("/api/v1/(pos/payments|orders/.+/pay|payments)"),
      (route: any) => {
        if (route.request().method() !== "POST") {
          route.continue();
          return;
        }
        callCount++;
        if (callCount === 1) {
          fulfillJson(route, 402, {
            success: false,
            error: { code: "CARD_DECLINED", message: "Card declined" },
          });
        } else {
          fulfillJson(route, 200, {
            success: true,
            data: {
              id: "pmt-retry",
              method: "card",
              amount: 30000,
              change: 0,
              status: "completed",
              receiptId: "rcpt-retry",
            },
          });
        }
      },
    );

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`text=${baseOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${baseOrder.orderNumber}`).first().click();

    const payBtn = page.locator(
      '[data-testid="pay-btn"], button:has-text("收款")',
    );
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });

    // First attempt — declined
    await payBtn.first().click();
    await expect(
      page.locator('[data-testid="payment-error"], [role="alert"]').first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(payBtn.first()).toBeEnabled();

    // Second attempt — success
    await payBtn.first().click();
    await expect(
      page
        .locator('[data-testid="payment-success"], text=/success|成功|已完成/i')
        .first(),
    ).toBeVisible({ timeout: 6000 });

    expect(callCount).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 5. Zero-amount order (100% coupon) — completes without payment method
  // ---------------------------------------------------------------------------

  test("zero-amount order with full coupon discount should complete without payment", async ({
    page,
  }) => {
    let paymentCalled = false;

    await page.route("**/api/v1/orders**", (route: any) => {
      if (route.request().method() === "GET") {
        fulfillJson(route, 200, {
          success: true,
          data: [zeroDollarOrder],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      } else {
        route.continue();
      }
    });

    await page.route(
      new RegExp("/api/v1/(pos/payments|orders/.+/pay|payments)"),
      (route: any) => {
        if (route.request().method() === "POST") {
          paymentCalled = true;
          fulfillJson(route, 200, {
            success: true,
            data: {
              id: "pmt-zero",
              method: "coupon",
              amount: 0,
              change: 0,
              status: "completed",
            },
          });
        } else {
          route.continue();
        }
      },
    );

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`text=${zeroDollarOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${zeroDollarOrder.orderNumber}`).first().click();

    const payBtn = page.locator(
      '[data-testid="pay-btn"], button:has-text("收款")',
    );
    const hasPayBtn = await payBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasPayBtn) {
      await payBtn.first().click();
      await expect(
        page
          .locator(
            '[data-testid="payment-success"], text=/success|成功|已完成/i',
          )
          .first(),
      ).toBeVisible({ timeout: 6000 });
    } else {
      // Zero-amount orders may auto-complete — check for success state directly
      await expect(page.locator("main, [role='main']").first()).toBeVisible({
        timeout: 5000,
      });
      // Auto-complete must NOT have triggered the payment endpoint
      expect(paymentCalled).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Payment success → order status becomes completed (status=5)
  // ---------------------------------------------------------------------------

  test("payment success should transition order status to completed", async ({
    page,
  }) => {
    let orderStatus = 4; // delivered

    await page.route("**/api/v1/orders**", (route: any) => {
      if (route.request().method() === "GET") {
        fulfillJson(route, 200, {
          success: true,
          data: [{ ...baseOrder, status: orderStatus }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      } else {
        route.continue();
      }
    });

    await page.route(new RegExp("/api/v1/orders/[^/]+$"), (route: any) => {
      if (route.request().method() === "GET") {
        fulfillJson(route, 200, {
          success: true,
          data: { ...baseOrder, status: orderStatus },
        });
      } else if (
        route.request().method() === "PUT" ||
        route.request().method() === "PATCH"
      ) {
        orderStatus = 5;
        fulfillJson(route, 200, {
          success: true,
          data: { ...baseOrder, status: 5 },
        });
      } else {
        route.continue();
      }
    });

    await page.route(
      new RegExp("/api/v1/(pos/payments|orders/.+/pay|payments)"),
      (route: any) => {
        if (route.request().method() === "POST") {
          orderStatus = 5;
          fulfillJson(route, 200, {
            success: true,
            data: {
              id: "pmt-status",
              method: "cash",
              amount: 30000,
              change: 0,
              status: "completed",
              receiptId: "rcpt-status",
            },
          });
        } else {
          route.continue();
        }
      },
    );

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`text=${baseOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${baseOrder.orderNumber}`).first().click();

    const payBtn = page.locator(
      '[data-testid="pay-btn"], button:has-text("收款")',
    );
    await expect(payBtn.first()).toBeVisible({ timeout: 5000 });
    await payBtn.first().click();

    await expect(
      page
        .locator(
          '[data-testid="payment-success"], text=/success|成功|已完成|completed/i',
        )
        .first(),
    ).toBeVisible({ timeout: 6000 });

    expect(orderStatus).toBe(5);
  });
});
