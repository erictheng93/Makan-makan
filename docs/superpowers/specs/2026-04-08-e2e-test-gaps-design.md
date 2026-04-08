# E2E Test Gap Coverage — Design Spec

**Date:** 2026-04-08  
**Author:** Senior Test Engineer (AI)  
**Status:** Approved

---

## Background

An audit of the existing 43 E2E spec files revealed strong happy-path coverage (B+, 78/100) but critical gaps in error handling, concurrent operations, and cross-role cancellation flows. This spec defines the 6 new test files required before the next production release.

### Risk Baseline (pre-fix)

| Gap                              | Business Risk                          |
| -------------------------------- | -------------------------------------- |
| Payment failures untested        | Revenue loss, account ledger mismatch  |
| Concurrent operations untested   | Race conditions at peak hour           |
| Order cancellation missing       | Customer satisfaction, refund tracking |
| Stock depletion at checkout      | Overselling                            |
| Delivery zone validation missing | Wrong-address shipping                 |

---

## Architecture Decisions

### A1 — Mock-first, real-API optional

All 6 specs maintain the codebase's existing mock-based architecture (`page.route()`). The integration payment spec adds a `USE_REAL_API` toggle for staging environments.

**Rationale:** E2E UI tests validate frontend behaviour given a specific API response. Backend correctness (DB locks, transactions, inventory deduction) belongs in `integration/` or load tests. Consistency with the existing 43 specs reduces maintenance burden.

### A2 — Concurrent operations via mock call-counting

Race conditions are simulated using a `callCount` counter inside route handlers — first call succeeds, subsequent calls return 409. Multi-context (`browser.newContext()`) was rejected because in a mock environment, two page contexts have independent route interception and cannot share backend state, making the "concurrency" illusory.

### A3 — Selector quality standard (upgraded)

New specs enforce: `data-testid` primary, maximum 1 text-selector fallback.

```typescript
// ✅ Allowed
page.locator('[data-testid="pay-btn"], button:has-text("收款")');

// ❌ Rejected — more than 2 OR clauses
page.locator(
  'button:has-text("Pay"), button:has-text("收款"), button:has-text("結帳"), [data-testid="pay-btn"]',
);
```

### A4 — State-based async waiting

Replace `waitForTimeout(N)` with `expect(locator).toBeVisible({ timeout: N })` throughout.

---

## Spec Files

### 1. `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts`

**Purpose:** Verify the cashier POS UI handles payment failure responses correctly and allows recovery without leaving orders in a broken state.

**Viewport:** 1440×900 (desktop POS)

**Setup:** `preAuthAdmin(PERSONAS.CASHIER)` + standard mocks + override payment endpoint per test

**Test cases:**

| #   | Name                     | Mock response                                                    | Expected UI behaviour                                                        |
| --- | ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | card_declined            | `402 { code: "CARD_DECLINED" }`                                  | Error message visible, Pay button re-enabled, order stays at status=4        |
| 2   | duplicate_payment        | Second POST → `409 { code: "DUPLICATE_PAYMENT" }`                | UI shows "already paid" state, Pay button disabled                           |
| 3   | amount_mismatch          | `400 { code: "AMOUNT_MISMATCH" }`                                | Error with correct amount shown, input cleared for re-entry                  |
| 4   | printer_offline          | Payment 200 OK, receipt POST → `503 { code: "PRINTER_OFFLINE" }` | Success toast + "Retry Print" button visible                                 |
| 5   | payment_timeout_rollback | Payment → 504 timeout                                            | Order remains at status=4 (delivered, unpaid); error message instructs retry |

**Key verification pattern:**

```typescript
let callCount = 0;
await page.route(/payments/, (route) => {
  callCount++;
  if (callCount === 1)
    route.fulfill({
      status: 402,
      body: JSON.stringify({
        success: false,
        error: { code: "CARD_DECLINED" },
      }),
    });
  else route.continue();
});
// ... click Pay ...
await expect(
  page.locator('[data-testid="payment-error"], [role="alert"]'),
).toBeVisible({ timeout: 5000 });
await expect(
  page.locator('[data-testid="pay-btn"], button:has-text("收款")'),
).toBeEnabled();
```

---

### 2. `tests/e2e/cross-role/concurrent-operations.spec.ts`

**Purpose:** Verify the frontend handles API conflict responses (409) that arise from concurrent operations — the most common race condition surface in a busy restaurant.

**Structure:** `test.describe` (independent, not serial — each scenario is self-contained)

**Test cases:**

| #   | Scenario                  | Conflict endpoint                  | Conflict code           | Expected UI                                                         |
| --- | ------------------------- | ---------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| 1   | Last-item stock depletion | `POST /orders` (2nd call)          | `OUT_OF_STOCK`          | Cart highlights out-of-stock item, blocks checkout, prompts removal |
| 2   | Two crew claim same order | `PUT /orders/:id/claim` (2nd call) | `ORDER_ALREADY_CLAIMED` | Error toast "訂單已被接取", order removed from available list       |
| 3   | Cashier double-payment    | `POST /payments` (2nd call)        | `ALREADY_PAID`          | UI transitions to "已結帳" state, Pay button hidden                 |

**Mock pattern (call-counting):**

```typescript
let orderPostCount = 0;
await page.route("**/api/v1/orders", (route) => {
  if (route.request().method() !== "POST") {
    route.continue();
    return;
  }
  orderPostCount++;
  if (orderPostCount === 1) {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true, data: createMockOrder() }),
    });
  } else {
    route.fulfill({
      status: 409,
      body: JSON.stringify({
        success: false,
        error: { code: "OUT_OF_STOCK", itemId: "item-1" },
      }),
    });
  }
});
```

---

### 3. `tests/e2e/customer/order-cancellation.spec.ts`

**Purpose:** Verify cancellation works correctly from all relevant role perspectives, including cross-role state propagation via SSE.

**Structure:** `test.describe` (4 independent tests — different roles/scenarios)

**Test cases:**

| #   | Actor    | Scenario                                  | Key assertion                                                                                        |
| --- | -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Customer | Cancel pending order (status=0)           | DELETE `/orders/:id` called; UI shows "已取消"                                                       |
| 2   | Customer | Attempt cancel preparing order (status=2) | Cancel button disabled OR API returns 403; UI shows explanation text                                 |
| 3   | Admin    | Force cancel + SSE propagation            | Admin cancels → mock SSE pushes `order_cancelled` event → customer tracking page updates to "已取消" |
| 4   | Customer | Cancel then re-order same items           | After cancel, cart is clearable and same items re-orderable                                          |

**SSE propagation test pattern:**

```typescript
// Admin cancels order
await page.route(/orders\/.*$/, (route) => {
  if (route.request().method() === "DELETE")
    route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  else route.continue();
});

// Mock SSE to push cancellation event
await page.route(/sse\/events/, (route) => {
  route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: `data: ${JSON.stringify({ type: "order_cancelled", orderId: "order-e2e-001" })}\n\n`,
  });
});

// Customer tracking page should reflect cancellation
await expect(page.locator("text=/已取消|Cancelled/i").first()).toBeVisible({
  timeout: 8000,
});
```

---

### 4. `tests/e2e/integration/payment-processing.spec.ts`

**Purpose:** Comprehensive payment scenario coverage. Runs against mocks in CI; switches to real API on staging via env var.

**Toggle:**

```typescript
const USE_REAL_API = process.env.E2E_PAYMENT_REAL === "true";
const API_BASE = process.env.E2E_API_URL || "http://localhost:8787";
```

**Test cases:**

| #   | Scenario                                   | Validation focus                                                     |
| --- | ------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Cash payment — exact amount                | Change = 0, receipt issued                                           |
| 2   | Cash payment — overpayment                 | Change calculated correctly (e.g. NT$500 for NT$300 → change NT$200) |
| 3   | Card payment — success path                | No change field shown; receipt issued                                |
| 4   | Card declined → retry → success            | Error shown, second attempt succeeds, order marked completed         |
| 5   | 100% coupon (zero-charge order)            | Amount = 0 accepted, no payment method required, order completed     |
| 6   | Payment success → order status = completed | `GET /orders/:id` after payment returns `status: 5`                  |

**Note on real-API mode:** When `E2E_PAYMENT_REAL=true`, tests skip mock setup and hit `API_BASE` directly with Stripe test card `4242 4242 4242 4242`. Requires test environment with Stripe test mode enabled.

---

### 5. `tests/e2e/customer/stock-validation.spec.ts`

**Purpose:** Verify the customer-facing checkout correctly handles stock depletion that occurs between "add to cart" and "submit order".

**App:** Customer app (localhost:3000)

**Test cases:**

| #   | Scenario                                        | API response                                                          | Expected UI                                                                    |
| --- | ----------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Full out-of-stock at submit                     | `POST /orders` → `409 { code: "ITEM_OUT_OF_STOCK", itemId: "1" }`     | Item highlighted in cart as unavailable; checkout blocked; remove prompt shown |
| 2   | Partial out-of-stock (2 of 5 items)             | `409 { code: "PARTIAL_OUT_OF_STOCK", unavailableItems: ["1","3"] }`   | Only unavailable items flagged; "Remove & Continue" CTA visible                |
| 3   | Item available at add-to-cart, gone at checkout | Menu returns `isAvailable: true`; order submit returns `OUT_OF_STOCK` | Cart state is re-validated; clear error with item name                         |

---

### 6. `tests/e2e/customer/delivery-zone.spec.ts`

**Purpose:** Verify the delivery address flow correctly validates zone coverage and calculates delivery fees.

**App:** Customer app, shop mode (delivery enabled)

**Test cases:**

| #   | Scenario                              | API / validation                          | Expected UI                                     |
| --- | ------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| 1   | Address within delivery zone          | `POST /orders/validate-address` → 200 OK  | Proceeds to checkout with delivery fee shown    |
| 2   | Address outside delivery zone         | `422 { code: "DELIVERY_ZONE_EXCEEDED" }`  | Error: "超出外送範圍", suggests takeaway option |
| 3   | Incomplete address (missing district) | Frontend form validation (no API call)    | Inline field error before submit                |
| 4   | Delivery fee calculation              | Address valid → fee = 60 in mock response | Fee line item `NT$60` visible in order summary  |

---

## File Structure

```
tests/e2e/
├── journeys/
│   ├── cashier/
│   │   ├── pos-shift.spec.ts          (existing)
│   │   ├── card-mobile-payment.spec.ts (existing)
│   │   └── pos-shift-errors.spec.ts   ← NEW
│   └── customer/
│       ├── order-cancellation.spec.ts  ← NEW
│       ├── stock-validation.spec.ts    ← NEW
│       └── delivery-zone.spec.ts       ← NEW
├── cross-role/
│   ├── order-lifecycle.spec.ts        (existing)
│   └── concurrent-operations.spec.ts  ← NEW
└── integration/
    ├── menu-management.spec.ts        (existing)
    ├── qr-generation.spec.ts          (existing)
    └── payment-processing.spec.ts     ← NEW
```

---

## Test Count Summary

| File                            | Tests  | Priority         |
| ------------------------------- | ------ | ---------------- |
| `pos-shift-errors.spec.ts`      | 5      | P0 — pre-release |
| `concurrent-operations.spec.ts` | 3      | P0 — pre-release |
| `order-cancellation.spec.ts`    | 4      | P0 — pre-release |
| `payment-processing.spec.ts`    | 6      | P1 — next sprint |
| `stock-validation.spec.ts`      | 3      | P1 — next sprint |
| `delivery-zone.spec.ts`         | 4      | P1 — next sprint |
| **Total**                       | **25** |                  |

---

## Quality Gates

All new specs must pass before merge:

1. `pnpm test:e2e` exits 0
2. No `waitForTimeout` calls without a comment explaining why state-based waiting is insufficient
3. No OR selector chains with more than 2 clauses
4. Every mock that tracks a flag (`let called = false`) must have a corresponding `expect(called).toBe(true)`
5. Each test is independently runnable (no shared mutable state between `test()` blocks within the same `describe`)
