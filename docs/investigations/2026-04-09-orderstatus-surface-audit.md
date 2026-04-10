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
