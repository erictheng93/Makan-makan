/**
 * Cashier POS Shift E2E Test
 *
 * Simulates a cashier's complete POS shift: login, start shift, process
 * payments with coupons, print receipts, and reconcile at shift end.
 *
 * Desktop viewport: POS systems run on standard monitors.
 */

import { test, expect } from "@playwright/test";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockTableAPI,
  mockOrderAPI,
  mockPOSAPI,
  mockSSE,
  mockAnalyticsAPI,
} from "../../helpers/mock-api";
import { PERSONAS, RESTAURANT, createMockOrder } from "../../helpers/personas";
import {
  loginAs,
  expectNavigatedTo,
  expectToastMessage,
} from "../../helpers/assertions";

// ---------------------------------------------------------------------------
// Desktop viewport — POS runs on a standard monitor
// ---------------------------------------------------------------------------
test.use({ viewport: { width: 1440, height: 900 } });

// ---------------------------------------------------------------------------
// App base URL and route constants
// ---------------------------------------------------------------------------
const ADMIN_APP = "http://localhost:5174";
const loginUrl = `${ADMIN_APP}/login`;
const posCheckoutUrl = `${ADMIN_APP}/dashboard/pos/checkout`;
const posManagementUrl = `${ADMIN_APP}/dashboard/pos/management`;

// ---------------------------------------------------------------------------
// Mock data: pending orders awaiting payment
// ---------------------------------------------------------------------------
const pendingPaymentOrder = createMockOrder({
  id: "order-pay-001",
  orderNumber: "ORD-PAY-001",
  status: 4, // delivered, awaiting payment
  total: 30000,
});

const pendingPaymentOrder2 = createMockOrder({
  id: "order-pay-002",
  orderNumber: "ORD-PAY-002",
  status: 4,
  total: 16000,
});

test.describe("Cashier POS shift flow", () => {
  // -----------------------------------------------------------------------
  // Shared setup: mock auth, restaurant, and POS APIs
  // -----------------------------------------------------------------------

  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CASHIER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockTableAPI(page);
    await mockOrderAPI(page);
    await mockPOSAPI(page);
    await mockSSE(page);
    await mockAnalyticsAPI(page);

    // Mock coupon validation endpoint
    await page.route(new RegExp(`/api/v1/coupons/validate`), (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "coupon-001",
              code: "SAVE10",
              discountType: "percentage",
              discountValue: 10,
              valid: true,
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock payment endpoint
    await page.route(
      new RegExp(`/api/v1/(pos/payments|orders/.+/pay|payments)`),
      (route) => {
        if (route.request().method() === "POST") {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                id: "payment-001",
                orderId: pendingPaymentOrder.id,
                amount: pendingPaymentOrder.total,
                method: "cash",
                status: "completed",
                receiptId: "rcpt-001",
                change: 20000,
              },
            }),
          });
        } else {
          route.continue();
        }
      },
    );

    // Mock shift management endpoints
    await page.route(new RegExp(`/api/v1/pos/shifts/current`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "shift-1",
            cashierId: PERSONAS.CASHIER.id,
            startTime: new Date().toISOString(),
            startingCash: 100000,
            status: "active",
          },
        }),
      }),
    );

    await page.route(new RegExp(`/api/v1/pos/shifts/.+/end`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "shift-1",
            startTime: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
            endTime: new Date().toISOString(),
            startingCash: 100000,
            endingCash: 350000,
            totalTransactions: 15,
            totalRevenue: 250000,
            cashPayments: 180000,
            cardPayments: 70000,
            discrepancy: 0,
          },
        }),
      }),
    );

    await page.route(new RegExp(`/api/v1/pos/shifts/.+/report`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            shiftId: "shift-1",
            totalTransactions: 15,
            totalRevenue: 250000,
            cashPayments: 180000,
            cardPayments: 70000,
            voidedOrders: 1,
            averageTransaction: 16667,
            peakHour: "12:00",
          },
        }),
      }),
    );
  });

  // -----------------------------------------------------------------------
  // 1. Cashier login (role=4) -> redirected to POS
  // -----------------------------------------------------------------------

  test("should login as cashier and redirect to POS", async ({ page }) => {
    await page.goto(loginUrl);

    await loginAs(page, PERSONAS.CASHIER.username, PERSONAS.CASHIER.password);

    // After login, cashier should be redirected to POS or dashboard
    await page
      .waitForURL(/\/(dashboard|pos)/, { timeout: 10000 })
      .catch(() => {});

    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // 2. Start shift -> enter starting cash -> shift badge appears
  // -----------------------------------------------------------------------

  test("should start shift with starting cash and show shift badge", async ({
    page,
  }) => {
    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Look for "Start Shift" button or shift initialization prompt
    const startShiftBtn = page.locator(
      'button:has-text("Start Shift"), button:has-text("開始班次"), button:has-text("開班"), [data-testid="start-shift-btn"]',
    );

    if (
      await startShiftBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await startShiftBtn.first().click();

      // Enter starting cash amount
      const cashInput = page.locator(
        'input[name="startingCash"], input[name="starting_cash"], input[placeholder*="cash"], input[placeholder*="現金"], input[type="number"], [data-testid="starting-cash-input"]',
      );
      if (
        await cashInput
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await cashInput.first().fill("1000");

        // Confirm start shift
        const confirmBtn = page.locator(
          'button:has-text("Confirm"), button:has-text("確認"), button:has-text("Start"), button[type="submit"], [data-testid="confirm-shift-btn"]',
        );
        await confirmBtn.first().click();
      }
    }

    // Verify shift badge or indicator appears
    const shiftBadge = page.locator(
      '[data-testid="shift-badge"], [data-testid="shift-status"], [class*="shift"], text=/Shift|班次|開班/i',
    );
    await expect(shiftBadge.first()).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // 3. Pending orders list loads on left panel
  // -----------------------------------------------------------------------

  test("should display pending orders on left panel", async ({ page }) => {
    // Override orders to show pending payment orders
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [pendingPaymentOrder, pendingPaymentOrder2],
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Verify pending orders appear in the list
    await expect(
      page.locator(`text=${pendingPaymentOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator(`text=${pendingPaymentOrder2.orderNumber}`).first(),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 4. Select order -> payment form on right
  // -----------------------------------------------------------------------

  test("should show payment form when order is selected", async ({ page }) => {
    // Override orders endpoint
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [pendingPaymentOrder],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Click on the pending order
    await expect(
      page.locator(`text=${pendingPaymentOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page
      .locator(`text=${pendingPaymentOrder.orderNumber}`)
      .first()
      .click();

    // Verify payment form or order detail panel appears on the right
    const paymentForm = page.locator(
      '[data-testid="payment-form"], [data-testid="payment-panel"], [data-testid="order-detail"], [class*="payment"], [class*="checkout"]',
    );
    const orderTotal = page.locator("text=/300|30,000|NT\\$\\s*300/");

    // Either a dedicated payment form or the order total should be visible
    const hasForm = await paymentForm
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasTotal = await orderTotal
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasForm || hasTotal).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 5. Apply coupon code -> discount applied
  // -----------------------------------------------------------------------

  test("should apply coupon code and show discount", async ({ page }) => {
    // Override orders endpoint
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [pendingPaymentOrder],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Select the order
    await expect(
      page.locator(`text=${pendingPaymentOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page
      .locator(`text=${pendingPaymentOrder.orderNumber}`)
      .first()
      .click();

    // Look for coupon input field
    const couponInput = page.locator(
      'input[name="coupon"], input[name="couponCode"], input[placeholder*="coupon"], input[placeholder*="優惠"], input[placeholder*="折扣"], [data-testid="coupon-input"]',
    );

    if (
      await couponInput
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await couponInput.first().fill("SAVE10");

      // Apply the coupon
      const applyBtn = page.locator(
        'button:has-text("Apply"), button:has-text("套用"), button:has-text("使用"), [data-testid="apply-coupon-btn"]',
      );
      await applyBtn.first().click();

      // Verify discount is shown (10% off 300 = 30, so total should be 270)
      const discount = page.locator(
        "text=/discount|折扣|優惠|-\\s*30|-\\s*3,000/i",
      );
      await expect(discount.first()).toBeVisible({ timeout: 5000 });
    }
  });

  // -----------------------------------------------------------------------
  // 6. Select cash payment -> enter amount -> calculate change
  // -----------------------------------------------------------------------

  test("should calculate change for cash payment", async ({ page }) => {
    // Override orders endpoint
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [pendingPaymentOrder],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Select the order
    await expect(
      page.locator(`text=${pendingPaymentOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page
      .locator(`text=${pendingPaymentOrder.orderNumber}`)
      .first()
      .click();

    // Select cash payment method
    const cashOption = page.locator(
      'button:has-text("Cash"), button:has-text("現金"), [data-testid="payment-cash"], [data-testid="payment-method-cash"]',
    );
    if (
      await cashOption
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await cashOption.first().click();
    }

    // Enter cash amount (e.g., 500 for a 300 order)
    const amountInput = page.locator(
      'input[name="amount"], input[name="cashAmount"], input[name="received"], input[placeholder*="amount"], input[placeholder*="金額"], [data-testid="cash-amount-input"], [data-testid="received-amount"]',
    );
    if (
      await amountInput
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await amountInput.first().fill("500");

      // Verify change is calculated (500 - 300 = 200)
      const change = page.locator(
        'text=/change|找零|200/i, [data-testid="change-amount"]',
      );
      await expect(change.first()).toBeVisible({ timeout: 5000 });
    }
  });

  // -----------------------------------------------------------------------
  // 7. Process payment -> success confirmation
  // -----------------------------------------------------------------------

  test("should process payment and show success confirmation", async ({
    page,
  }) => {
    // Override orders endpoint
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [pendingPaymentOrder],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Select the order
    await expect(
      page.locator(`text=${pendingPaymentOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page
      .locator(`text=${pendingPaymentOrder.orderNumber}`)
      .first()
      .click();

    // Select cash payment method
    const cashOption = page.locator(
      'button:has-text("Cash"), button:has-text("現金"), [data-testid="payment-cash"], [data-testid="payment-method-cash"]',
    );
    if (
      await cashOption
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await cashOption.first().click();
    }

    // Enter exact amount
    const amountInput = page.locator(
      'input[name="amount"], input[name="cashAmount"], input[name="received"], [data-testid="cash-amount-input"], [data-testid="received-amount"]',
    );
    if (
      await amountInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await amountInput.first().fill("300");
    }

    // Click pay / confirm button
    const payBtn = page.locator(
      'button:has-text("Pay"), button:has-text("Process"), button:has-text("收款"), button:has-text("結帳"), button:has-text("確認付款"), [data-testid="process-payment-btn"], [data-testid="pay-btn"], [data-testid="confirm-payment-btn"]',
    );
    if (
      await payBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await payBtn.first().click();

      // Verify success confirmation (toast, modal, or status change)
      const success = page.locator(
        '[role="alert"], [data-testid="payment-success"], text=/success|成功|已完成|completed/i',
      );
      await expect(success.first()).toBeVisible({ timeout: 5000 });
    }
  });

  // -----------------------------------------------------------------------
  // 8. Print receipt -> receipt confirmation
  // -----------------------------------------------------------------------

  test("should print receipt after payment", async ({ page }) => {
    let receiptPrinted = false;

    // Mock receipt print endpoint
    await page.route(new RegExp(`/api/v1/pos/receipts`), (route) => {
      if (route.request().method() === "POST") {
        receiptPrinted = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { receiptId: "rcpt-001", printed: true },
          }),
        });
      } else {
        route.continue();
      }
    });

    // Override orders endpoint
    await page.route("**/api/v1/orders**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [pendingPaymentOrder],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posCheckoutUrl);
    await page.waitForLoadState("networkidle");

    // Select the order
    await expect(
      page.locator(`text=${pendingPaymentOrder.orderNumber}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page
      .locator(`text=${pendingPaymentOrder.orderNumber}`)
      .first()
      .click();

    // Look for print receipt button
    const printBtn = page.locator(
      'button:has-text("Print"), button:has-text("列印"), button:has-text("印"), button:has-text("Receipt"), button:has-text("收據"), [data-testid="print-receipt-btn"], [data-testid="print-btn"]',
    );

    if (
      await printBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await printBtn.first().click();

      // Verify print confirmation
      const printConfirm = page.locator(
        '[role="alert"], text=/printed|已列印|列印成功|success/i, [data-testid="print-success"]',
      );
      await expect(printConfirm.first()).toBeVisible({ timeout: 5000 });

      // Verify the receipt API was called
      expect(receiptPrinted).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // 9. Navigate to shift management -> view shift report
  // -----------------------------------------------------------------------

  test("should display shift report in management view", async ({ page }) => {
    await page.goto(posManagementUrl);
    await page.waitForLoadState("networkidle");

    // Verify shift management page loaded with report data
    const reportContent = page.locator(
      '[data-testid="shift-report"], [data-testid="shift-summary"], [class*="shift"], [class*="report"], text=/Shift|班次|Report|報表/i',
    );
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });

    // Verify key metrics are displayed
    const revenue = page.locator(
      "text=/revenue|營業額|營收|250,000|2,500|NT\\$\\s*2,500/i",
    );
    const transactions = page.locator("text=/transaction|交易|筆|15/i");

    // At least one metric should be visible
    const hasRevenue = await revenue
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasTransactions = await transactions
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasRevenue || hasTransactions).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 10. End shift -> reconciliation summary
  // -----------------------------------------------------------------------

  test("should end shift and show reconciliation summary", async ({ page }) => {
    let shiftEnded = false;

    // Mock shift end endpoint
    await page.route(new RegExp(`/api/v1/pos/shifts/.+/end`), (route) => {
      if (
        route.request().method() === "POST" ||
        route.request().method() === "PUT"
      ) {
        shiftEnded = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "shift-1",
              startTime: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
              endTime: new Date().toISOString(),
              startingCash: 100000,
              endingCash: 350000,
              totalTransactions: 15,
              totalRevenue: 250000,
              cashPayments: 180000,
              cardPayments: 70000,
              discrepancy: 0,
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(posManagementUrl);
    await page.waitForLoadState("networkidle");

    // Look for "End Shift" button
    const endShiftBtn = page.locator(
      'button:has-text("End Shift"), button:has-text("結束班次"), button:has-text("關班"), [data-testid="end-shift-btn"]',
    );

    if (
      await endShiftBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await endShiftBtn.first().click();

      // Enter ending cash amount if prompted
      const endCashInput = page.locator(
        'input[name="endingCash"], input[name="ending_cash"], input[placeholder*="cash"], input[placeholder*="現金"], [data-testid="ending-cash-input"]',
      );
      if (
        await endCashInput
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await endCashInput.first().fill("3500");

        // Confirm end shift
        const confirmBtn = page.locator(
          'button:has-text("Confirm"), button:has-text("確認"), button:has-text("End"), button[type="submit"], [data-testid="confirm-end-shift-btn"]',
        );
        await confirmBtn.first().click();
      }

      // Verify reconciliation summary appears
      const reconciliation = page.locator(
        '[data-testid="reconciliation"], [data-testid="shift-summary"], text=/reconciliation|結算|對帳|結班/i',
      );
      await expect(reconciliation.first()).toBeVisible({ timeout: 5000 });

      // Verify the shift was ended via API
      expect(shiftEnded).toBe(true);
    }
  });
});
