# OrderStatus Surface Audit

**Date:** 2026-04-09
**Related issue:** #9
**Status:** In progress

## Summary

(Filled in at end of Phase 0)

## 1. Type Definitions Inventory

Three divergent `OrderStatus`-shaped types exist in the monorepo. The DB schema is the intended source of truth.

### 1.1 packages/shared-types/src/order.ts

**Location:** `packages/shared-types/src/order.ts:95-103`

**Verbatim source:**

```typescript
export enum OrderStatus {
  PENDING = 0,
  CONFIRMED = 1,
  PREPARING = 2,
  READY = 3,
  DELIVERED = 4,
  PAID = 5,
  CANCELLED = 6,
}
```

**Shape:** TypeScript numeric enum (emits bidirectional object — `OrderStatus[0] === "PENDING"` and `OrderStatus.PENDING === 0`).

**Value count:** 7 members.

**Divergence from DB source of truth:**
- ❌ Numeric wire format (0–6) — DB stores string values (`"pending"`, `"confirmed"`, ...).
- ❌ Missing `REFUNDED` — DB has 8 members; this enum has 7.
- ❌ Any comparison `order.status === OrderStatus.PENDING` compares a DB string against numeric `0`, silently evaluating false. This is the root cause of the PR #7 filter bug.

---

### 1.2 packages/database/src/schema/orders.ts

**Location:** `packages/database/src/schema/orders.ts:14-26`

**Verbatim source:**

```typescript
// 訂單狀態定義
export const ORDER_STATUS = {
  PENDING: "pending", // 待確認
  CONFIRMED: "confirmed", // 已確認
  PREPARING: "preparing", // 準備中
  READY: "ready", // 已完成
  DELIVERED: "delivered", // 已送達
  PAID: "paid", // 已付款
  CANCELLED: "cancelled", // 已取消
  REFUNDED: "refunded", // 已退款
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
```

**Shape:** String const object + derived string-union type.

**Value count:** 8 members.

**Divergence:** None — this is the canonical source. All other definitions must match this set exactly. Drizzle column definition on `orders.status` stores these as `TEXT` (SQLite) with `pending` default.

---

### 1.3 apps/realtime/src/advanced-realtime-session.ts

**Location:** `apps/realtime/src/advanced-realtime-session.ts:156-164`

**Verbatim source:**

```typescript
enum OrderLifecycleState {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PREPARING = "preparing",
  READY = "ready",
  SERVING = "serving",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}
```

**Shape:** TypeScript string enum (values align with DB naming convention — lowercase strings — but membership differs).

**Value count:** 7 members.

**Divergence from DB source of truth:**
- ❌ Has `SERVING` ("serving") — not in DB. UI-derivable state per Phase 0.5 proposal (drop; derive from `status === 'ready'` + crew assignment).
- ❌ Has `COMPLETED` ("completed") — DB uses `DELIVERED` ("delivered") for the same concept. Realtime-local naming drift.
- ❌ Missing `DELIVERED` — replaced locally by `COMPLETED`.
- ❌ Missing `PAID` — realtime lifecycle graph terminates at `COMPLETED`, so paid/refunded are not modeled.
- ❌ Missing `REFUNDED` — same reason.
- ⚠️ Transition map (lines 207-224) encodes a different lifecycle graph than the DB expects. Any broadcast that emits `SERVING` or `COMPLETED` will carry values unknown to frontends once they migrate to the canonical string union.

## 2. File-Level Reference Inventory

### 2.1 apps/api
### 2.2 apps/realtime
### 2.3 apps/customer-app
### 2.4 apps/kitchen-display
### 2.5 apps/admin-dashboard

**File count:** 25 files, 218 total occurrences of `OrderStatus|order_status|orderStatus`.
(Issue #9 reported "167 references" — the count is in the same order of magnitude; the delta is line-match granularity.)

**⚠️ Additional finding: admin-dashboard ships TWO MORE local OrderStatus definitions**, bringing the monorepo total to **five**:

| # | File:line | Members | Notes |
|---|-----------|---------|-------|
| (1) | `packages/shared-types/src/order.ts:95-103` | 7 numeric | canonical-ish, see §1.1 |
| (2) | `packages/database/src/schema/orders.ts:14-26` | 8 string | DB source of truth, see §1.2 |
| (3) | `apps/realtime/src/advanced-realtime-session.ts:156-164` | 7 string | local drift, see §1.3 |
| (4) | `apps/admin-dashboard/src/types/index.ts:117-126` | 8 string | has `COMPLETED`, missing `REFUNDED` |
| (5) | `apps/admin-dashboard/src/components/dashboard/RecentOrders.vue:124-130` | 6 string | has `completed`, missing `delivered/paid/refunded` |

Both (4) and (5) must be deleted and replaced by the canonical shared-types string union in Phase 3.

**Per-file classification:**

| File | Import source | Usage pattern | Migration risk | Notes |
|------|---------------|---------------|----------------|-------|
| `src/types/index.ts` | **local `export enum`** | 4th OrderStatus definition | 🔴 high | 8 string members, has `COMPLETED` (not in DB), missing `REFUNDED`. Every re-exporter inherits the drift. Delete in Phase 3. |
| `src/stores/order.ts` | `@/types` (→ #4) | enum access (`OrderStatus.PENDING`, `.COMPLETED`, `.PAID`) | 🔴 high | 20 refs, drives filter groupings on lines 15-43; any state rename ripples here. Includes `updateOrderStatus(orderId, OrderStatus.COMPLETED)` on line 183 — will break when `completed` is removed. |
| `src/stores/order.d.ts` | `@/types` (→ #4) | type annotations (44 occurrences) | 🟡 medium | Ambient declaration file. Mechanically regenerated from `order.ts`? Verify whether hand-maintained or codegen in Task 13. |
| `src/stores/__tests__/order.test.ts` | `@/types` (→ #4) | enum access + test fixtures (45 refs) | 🟡 medium | Test mocks — largest single test file surface in admin-dashboard. |
| `src/views/OrdersView.vue` | `@/types` (→ #4) | enum access in filter predicates (lines 659-669), `nextStatus as OrderStatus` cast (741) | 🔴 high | 11 refs. Groupings: `[PENDING, CONFIRMED]`, `[PREPARING, READY, DELIVERED]`, `[COMPLETED, PAID]`. `[COMPLETED, PAID]` bucket will collapse to `[PAID]` after canonicalization. |
| `src/views/DashboardView.vue` | `@/types` (→ #4) | enum array literal for active-orders count | 🟢 low | 5 refs, all in one `[PENDING, CONFIRMED, PREPARING, READY]` list. Pure lookup — trivial rename. |
| `src/views/CashierView.vue` | *none* (string literal switch) | `getOrderStatusClass(status: string)` / `getOrderStatusText` with string keys including `completed` | 🟡 medium | 9 refs. Uses raw strings in a lookup table, including `completed` — must become `delivered` or a derived UI label. |
| `src/views/AnalyticsView.vue` | *none* (i18n keys) | `analytics.orderStatus.{completed,preparing,pending,cancelled}` | 🟢 low | 7 refs, all translation keys. Will need i18n key rename (`completed` → `delivered`). |
| `src/views/__tests__/OrdersView.test.ts` | `@/types` (→ #4) | test fixtures | 🟡 medium | 14 refs, largest view test surface. |
| `src/views/__tests__/AnalyticsView.test.ts` | *likely i18n strings* | test fixtures | 🟢 low | 5 refs. |
| `src/components/dashboard/RecentOrders.vue` | **local `type OrderStatus = ...`** | 5th OrderStatus definition | 🔴 high | 6-member string union inlined in the component (lines 124-130). `getStatusColor/Icon/Text(status: OrderStatus)` helpers branch on it. Has `completed`, missing `delivered/paid/refunded`. Delete in Phase 3. |
| `src/composables/useRealtimeOrderStatus.ts` | *local inline union* | `OrderStatusUpdate.status: 'pending' \| ... \| 'cancelled'` | 🔴 high | 9 refs. Another inline 6-member drift union (missing `delivered`, `paid`, `refunded`). Also serves as the realtime message schema for WebSocket order updates — mismatched with `shared-types` `OrderStatusUpdateEvent`. |
| `src/composables/useAdminRealtime.ts` | `shared-types` (`OrderStatusUpdateEvent`) | handler dispatch | 🟡 medium | 3 refs. Transitively depends on the numeric enum via `shared-types/src/realtime-events.ts:8`. |
| `src/composables/__tests__/useRealtimeOrders.test.ts` | *test fixtures* | mock events | 🟢 low | 2 refs. |
| `src/services/realtimeService.ts` | *string constants* | event type name `"order_status_changed"` | 🟢 low | 2 refs — just event name string, unrelated to status values. |
| `src/services/__tests__/realtimeService.test.ts` | | | 🟢 low | 1 ref, event name only. |
| `src/__tests__/setup.ts` | | | 🟢 low | 1 ref, likely mock helper. |
| `src/__tests__/integration/dashboard-integration.test.ts` | `@/types` (→ #4) | fixtures | 🟡 medium | 7 refs. |
| `src/tests/integration/realtime-group-orders.integration.test.ts` | | | 🟢 low | 1 ref. |
| `src/i18n/locales/en-US.ts` | n/a | translation keys `orderStatus.{pending,...}` | 🟢 low | 4 refs; maintenance: key rename across 6 locales. |
| `src/i18n/locales/zh-TW.ts` | n/a | translation keys | 🟢 low | 4 refs. |
| `src/i18n/locales/zh-CN.ts` | n/a | translation keys | 🟢 low | 4 refs. |
| `src/i18n/locales/ja-JP.ts` | n/a | translation keys | 🟢 low | 4 refs. |
| `src/i18n/locales/vi-VN.ts` | n/a | translation keys | 🟢 low | 4 refs. |
| `src/i18n/locales/id-ID.ts` | n/a | translation keys | 🟢 low | 4 refs. |

**Risk buckets (flagged for Section 3):** 0 hardcoded numeric literal sites against `.status`. All `.status === <number>` matches in admin-dashboard are HTTP error codes (websocketService, api.ts), not order status. The numeric-drift bug is pure-type, not runtime-literal, in this app.

**Risk buckets (flagged for Section 4):** 0 runtime `typeof status === 'number'` guards in admin-dashboard.

**Net admin-dashboard work for Phase 3:**
1. Delete the local `OrderStatus` enum in `src/types/index.ts`; re-export from `@makanmakan/shared-types`.
2. Delete the local `type OrderStatus` in `src/components/dashboard/RecentOrders.vue`; import from shared-types.
3. Delete the inline 6-member union in `src/composables/useRealtimeOrderStatus.ts`; reuse `OrderStatusUpdateEvent['data']['status']` from shared-types.
4. Rewrite filter buckets in `OrdersView.vue:659-669` and `stores/order.ts:15-43` to match the canonical 8-state set (collapse `[COMPLETED, PAID]` → `[PAID]`, convert `COMPLETED` → `DELIVERED`).
5. Rename i18n keys `orderStatus.completed` → `orderStatus.delivered` across 6 locales; add `paid`, `refunded` keys.
6. Update 3 test files (`__tests__/order.test.ts`, `OrdersView.test.ts`, `dashboard-integration.test.ts`) to use factories + canonical string values.

### 2.6 apps/management-portal
### 2.7 apps/onboarding-app
### 2.8 packages/testing-utils
### 2.9 packages/shared-types
### 2.10 packages/database
### 2.11 tests/e2e

## 3. Hardcoded Numeric Literal Sites

## 4. Runtime `typeof status === "number"` Guards

## 5. Dead Code

## 6. Bidirectional Mapping Surface

### 6.1 OrdersService.normalizeStatus
### 6.2 OrdersService.getAllowedStatusTransitions — caller audit

## 7. External Wire Consumers

## 8. Durable Object Hibernated State

## 9. Client-Side Caches

### 9.1 kitchen-display localStorage
### 9.2 Browser bundle caching

## 10. Canonical State Decision (for Phase 0.5)

## 11. Migration Risk Register
