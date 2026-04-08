# E2E Integration Testing & Bug Fix Design

**Date:** 2026-04-03
**Status:** Approved

## Problem

The project has strong unit tests (8,496 passing) and mocked E2E specs (25 files), but no real integration E2E that hits the full stack (browser → API → D1). The takeaway tracking page has a redirect bug that prevents shop orders from reaching the tracking view.

## P0: Takeaway Redirect Bug Fix

### Root Cause

Two-part failure in the shop order → tracking navigation:

1. **Missing route**: No `/restaurant/:restaurantId/shop/order/:orderId` route exists. `ShopCartModal.vue` (line 556-567) navigates to the `OrderTracking` named route with `tableId: 0`, which maps to `/restaurant/:id/table/0/order/:orderId`.

2. **Guard rejection**: Router `beforeEach` guard (line 296-315) validates `tableId > 0` and redirects to error page when `tableId === 0`.

### Fix

- Add `ShopOrderTracking` route: `/restaurant/:restaurantId/shop/order/:orderId`
- Reuse `OrderTrackingView.vue` component (already handles both modes via props)
- Update `ShopCartModal.vue` to navigate to new `ShopOrderTracking` route
- Add `query.guestToken` passthrough for guest order authentication

### Files Changed

- `apps/customer-app/src/router/index.ts` — add route
- `apps/customer-app/src/components/ShopCartModal.vue` — update navigation target

## P1: Real Integration E2E Specs

### Architecture

```
Playwright (browser) → Customer App (:3000) → API (:8787) → D1 (local SQLite)
                                                    ↓
                                              Real auth, real DB writes
```

### Test Configuration

New Playwright project in `playwright.config.ts`:

- Project name: `integration`
- Base URL: `http://localhost:3000`
- API URL: `http://localhost:8787`
- Requires both servers running
- Test data: uses seeded mock data (demo restaurant `019469a0-0099...`)

### Specs

#### 1. `tests/e2e/integration/takeaway-order.spec.ts`

- Navigate to shop QR landing page
- Select "takeaway" order type
- Complete phone verification (mock OTP via test bypass or direct API)
- Browse menu, add items to cart
- Submit order via real guest-orders API
- Verify redirect to tracking page
- Verify order appears in DB

#### 2. `tests/e2e/integration/dine-in-order.spec.ts`

- Navigate to table QR page (table with seeded data)
- Browse menu, add items
- Submit order
- Verify order tracking page loads
- Verify order in DB

#### 3. `tests/e2e/integration/order-lifecycle.spec.ts`

- Create order via API (or reuse from previous test)
- Login as shop owner → confirm order
- Login as chef → mark preparing → mark ready
- Login as service crew → mark delivered
- Login as cashier → mark paid
- Verify terminal state

### Test Data Strategy

- Use demo restaurant (`019469a0-0099-7000-8000-000000000099`) with `enableShopMode: true`
- Clean up test-created orders in `afterEach` via direct API calls with admin token
- No modifications to seed data — tests create their own orders

### Helper Utilities

`tests/e2e/integration/helpers.ts`:

- `getAdminToken()` — login as admin, cache token
- `getRoleToken(role)` — login as specific role user
- `cleanupOrder(orderId)` — delete test order
- `createGuestOrder(restaurantId, items)` — API shortcut for test setup

## P2: Performance Baseline

### Lighthouse CI

Add `.lighthouserc.json`:

- URLs: customer app home, menu page, order tracking
- Assertions: LCP < 2.5s, CLS < 0.1, INP < 200ms (warning thresholds)
- Output: HTML report to `tests/performance/lighthouse/`

## P3: Accessibility

- Add `@axe-core/playwright` to integration specs
- Run accessibility checks on key pages (landing, menu, cart, tracking)
- Severity: violations are warnings, not blockers (for now)

## Implementation Plan

Parallel execution:

- **Worktree A**: P0 bug fix (ShopCartModal + router)
- **Main**: P1 E2E specs + P2 Lighthouse + P3 a11y
