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

**File count:** 32 files (30 source, 2 `.disabled` examples), 474 occurrences.

**Per-file classification (high-risk only — full table noisy):**

| File | Import source | Usage pattern | Migration risk |
|------|---------------|---------------|----------------|
| `src/features/orders/types/index.ts` | **dual import** — `DbOrderStatus` from `@makanmakan/database` AND `OrderStatus` from `@makanmakan/shared-types` (lines 14, 20) | PR #7 partial-fix workaround: query filters use `DbOrderStatus[]` (line 142), everything else still on numeric `OrderStatus` | 🔴 high — must collapse to single canonical type when shared-types is rewritten in Phase 2 (Task 13) |
| `src/features/orders/services/OrdersService.ts` | shared-types numeric `OrderStatus` | 31 refs; `normalizeStatus()` (line 1227-1243), `validateStatusTransition()` (1245-1269), `getAllowedStatusTransitions()` (1271-1285), `broadcastOrderStatusUpdate(prev, new: OrderStatus)` (1033-1042) | 🔴 high — Phase 2 Tasks 14-16 directly target this file |
| `src/features/orders/routes/index.ts` | mixed | 24 refs; 2 `typeof status === "string"` guards (lines 75, 95) for query parsing | 🔴 high — Phase 3 cleanup |
| `src/features/orders/schemas/validation.ts` | inline Zod | **6th OrderStatus definition** — `orderStatusSchema = z.enum([7 strings])` (lines 23-31), missing `refunded` | 🔴 high — Phase 2 must add `refunded` |
| `src/contracts/schemas/orders.ts` | inline Zod | **7th OrderStatus definition** — `OrderStatusEnum = z.enum([7 strings])` (lines 22-30), missing `refunded` | 🔴 high — contract test fixture; pinned by `pnpm contract:check`. Update before shared-types changes land or contract tests fail in CI. |
| `src/features/kitchen/services/KitchenService.ts` | shared-types | 5 refs; 2 `typeof === "number"` defensive guards (lines 157, 178) | 🟡 medium — Phase 2 Task 17 |
| `src/services/RealtimeBroadcastService.ts` | shared-types `OrderStatusUpdateEvent` | 3 refs; constructs the broadcast payload | 🟡 medium — wire format change |
| `src/features/orders/__tests__/state-machine.test.ts` | shared-types numeric enum | **79 refs** — largest test file. Uses `OrderStatus[toStatus.toUpperCase() as keyof typeof OrderStatus]` reverse-lookup (line 229-231), which only works on numeric enums | 🔴 high — must rewrite the lookup pattern |
| `src/features/orders/__tests__/cache-coherence.test.ts` | shared-types numeric enum | **76 refs** — `OrderStatus.PENDING`, `OrderStatus.CONFIRMED` everywhere | 🔴 high — mass replacement |
| `src/features/orders/__tests__/service.test.ts` | shared-types | 32 refs | 🟡 medium |
| `src/features/orders/__tests__/routes.test.ts` | shared-types | 31 refs | 🟡 medium |
| `src/features/orders/__tests__/schemas.test.ts` | shared-types | 26 refs | 🟡 medium |
| `src/features/orders/__tests__/feature.test.ts` | shared-types | 19 refs | 🟡 medium |
| `src/features/orders/__tests__/realtime-integration.test.ts` | shared-types | 18 refs | 🟡 medium |
| `src/features/orders/__tests__/permissions.test.ts` | shared-types | 12 refs | 🟡 medium |
| `src/features/orders/__tests__/bulk-operations.test.ts` | shared-types | 12 refs | 🟡 medium |
| `src/features/orders/__tests__/tenant-isolation.test.ts` | shared-types | 10 refs | 🟡 medium |
| `src/features/orders/__tests__/contract.test.ts` | shared-types | 8 refs | 🟡 medium |
| `src/features/orders/__tests__/analytics.test.ts` | shared-types | 6 refs | 🟢 low |
| `src/services/__tests__/RealtimeBroadcastService.test.ts` | shared-types | 9 refs | 🟢 low |
| `src/services/__tests__/broadcast-integration.test.ts` | shared-types | 9 refs | 🟢 low |
| `src/__tests__/security/business-logic-security.test.ts` | shared-types | 6 refs | 🟢 low |
| `src/features/group-orders/services/GroupOrdersService.ts` | shared-types | 3 refs | 🟢 low |
| `src/features/group-orders/types/index.ts` | shared-types | 2 refs | 🟢 low |
| `src/features/group-orders/index.ts` | shared-types | 1 ref | 🟢 low |
| `src/features/kitchen/__tests__/orders.test.ts` | shared-types | 3 refs | 🟢 low |
| `src/features/kitchen/types/index.ts` | shared-types | 1 ref | 🟢 low |
| `src/features/customers/__tests__/integration.test.ts` | shared-types | 2 refs | 🟢 low |
| `src/openapi/integration.ts` | shared-types / OpenAPI doc | 5 refs — public OpenAPI schema definition | 🔴 high — wire-format documentation; downstream consumers read this |
| `src/features/orders/index.ts` | re-export | 2 refs | 🟢 low |
| `src/examples/PaymentSystemUsage.ts.disabled` | n/a | dead | ⚪ skip |
| `src/examples/StripeIntegrationExample.ts.disabled` | n/a | dead | ⚪ skip |

### 2.2 apps/realtime

**File count:** 8 files (1 production source `advanced-realtime-session.ts` + 7 test files), 19 (lifecycle) + 38 (other) occurrences.

| File | Import source | Usage pattern | Migration risk |
|------|---------------|---------------|----------------|
| `src/advanced-realtime-session.ts` | **local enum** `OrderLifecycleState` (see §1.3) | 19 refs; transition graph map (lines 207-224); `currentState: OrderLifecycleState.PENDING` (line 445); persisted into DO storage | 🔴 high — drives Phase 4 (DO migration) |
| `src/__tests__/integration/durable-object-persistence.test.ts` | shared-types `OrderStatusUpdateEvent` | 13 refs — directly tests hibernation/wakeup with status fields | 🔴 high — must include §8 migration verification |
| `src/__tests__/integration/connection-stress.test.ts` | shared-types | 9 refs | 🟡 medium |
| `src/__tests__/integration/cross-room-communication.test.ts` | shared-types | 8 refs | 🟡 medium |
| `src/__tests__/offline-reconnection.test.ts` | shared-types | 3 refs | 🟢 low |
| `src/__tests__/message-routing.test.ts` | shared-types | 3 refs | 🟢 low |
| `src/__tests__/unit/routing/broadcast-logic.test.ts` | shared-types | 1 ref | 🟢 low |
| `src/__tests__/unit/routing/event-filtering.test.ts` | shared-types | 1 ref | 🟢 low |

### 2.3 apps/customer-app

**File count:** 8 files, 23 occurrences. **+ 5 hardcoded numeric literal sites that don't reference `OrderStatus` by name** (see §3).

| File | Import source | Usage pattern | Migration risk |
|------|---------------|---------------|----------------|
| `src/views/OrderTrackingView.vue` | shared-types `OrderStatus` (numeric enum) | 7 refs. **Indexes Record<number, …> by `.status`** for icons/colors/titles/descriptions/progress (lines 488-555). Works because shared-types numeric enum coerces to numeric keys, BUT the actual API returns strings — currently silently broken (every lookup falls back to default). Also has `=== 0`, `=== 1`, `=== 6` literals (lines 424, 474). | 🔴 critical — broken in production today, just degrading silently |
| `src/views/OrderHistoryView.vue` | none (template literal) | `v-if="order.status === 0"` (line 217) | 🔴 high — same broken pattern |
| `src/components/OrderItemCard.vue` | none | `v-if="item.status === 1"` (line 71) | 🔴 high |
| `src/utils/format.ts` | none | `formatOrderStatus(status: number)` with Record<number, string> i18n lookup (lines 273-285) | 🔴 high — same broken pattern |
| `src/services/orderApi.ts` | shared-types `OrderStatus` | 3 refs; type annotation only | 🟡 medium |
| `src/services/customerOrderApi.ts` | shared-types `OrderStatus` | 2 refs; type annotation only | 🟡 medium |
| `src/utils/push-notifications.ts` | inline `status: string` param | 2 refs; just passes through | 🟢 low |
| `src/tests/i18n.integration.test.ts` | n/a | 3 refs to translation keys | 🟢 low |
| `e2e/core-user-flows.spec.ts` | n/a | 4 refs | 🟢 low |
| `e2e/utils/test-helpers.ts` | n/a | 1 ref | 🟢 low |

### 2.4 apps/kitchen-display

**File count:** 23 files (20 source, 2 `.txt` analysis docs, 1 `.snap`), 147 occurrences.

**🚨 Kitchen-display ships its own numeric-literal-union OrderStatus type AND has the largest concentration of hardcoded numeric literal sites in the monorepo (~28 sites).** Combined with the localStorage validator that asserts `typeof status === "number"`, this app is the highest-risk migration target.

| # | File:line | Definition |
|---|-----------|------------|
| (6) | `apps/kitchen-display/src/types/index.ts:3` | `export type OrderStatus = 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6` — numeric literal union |
| (extra) | `apps/kitchen-display/src/utils/offline-storage.ts:6-16` | `OfflineOrderStatusUpdate.status: "received" \| "preparing" \| "ready" \| "completed"` — IndexedDB persistence schema with values that don't match anything else |

| File | Import source | Usage pattern | Migration risk |
|------|---------------|---------------|----------------|
| `src/types/index.ts` | **local numeric union** | 4 refs; the type itself + `KitchenOrder.status` + `OrderStatusUpdate.status` | 🔴 critical — definition #6 |
| `src/types/index-signatures.d.ts` | local | 1 ref | 🟢 low |
| `src/stores/orders.ts` | `@/types` | 15 refs incl. `order.status === 1|2|3` filter computeds (lines 31, 35, 39); `updateOrderStatus(orderId, newStatus: number \| OrderStatus)` (line 459); cast `newStatus as OrderStatus` (line 464) | 🔴 critical |
| `src/stores/orderManagement.ts` | local | 2 refs | 🟡 medium |
| `src/stores/__tests__/orders.test.ts` | local | 6 refs | 🟡 medium |
| `src/stores/__tests__/orderManagement.test.ts` | local | 2 refs | 🟢 low |
| `src/services/offlineService.ts` | local | 2 refs. **`typeof order.status === "number"` cache validator at line 485** — invalidates entire localStorage on schema mismatch | 🔴 critical — Section 4 + Section 9.1 entry |
| `src/services/audioAccessibilityService.ts` | local | 4 refs | 🟡 medium |
| `src/services/kitchenStatisticsService.ts` | local | 0 OrderStatus refs but **3 numeric literal sites** (`status === 1|2`, lines 185, 186, 423) | 🔴 high — §3 entry |
| `src/services/__tests__/persistenceService.test.ts` | local | 5 refs | 🟡 medium |
| `src/composables/useRealtimeKitchen.ts` | local | 3 refs | 🟡 medium |
| `src/composables/useKeyboardShortcuts.ts` | local | 2 refs | 🟢 low |
| `src/composables/useAudioNotifications.ts` | local | 0 OrderStatus refs but `order.status === 2` literal (line 196) | 🟡 medium — §3 entry |
| `src/composables/__tests__/useKeyboardShortcuts.test.ts` | local | 2 refs | 🟢 low |
| `src/views/EnhancedKitchenDashboard.vue` | local | 6 refs + **3 numeric literals** (`status === 1|2|3`, lines 210, 214, 218) | 🔴 high |
| `src/views/HistoryView.vue` | local | 3 refs + **3 numeric literals** (`status === 6`, `status === 4 \|\| status === 5`, lines 75, 94, 244) | 🔴 high |
| `src/components/orders/OrderCard.vue` | local | 0 OrderStatus refs but **2 numeric literals** (`status === 6`, lines 299, 302) | 🟡 medium |
| `src/components/orders/PriorityTimingManager.vue` | local | 0 OrderStatus refs but **4 numeric literals** (`status === 1|2`, lines 349, 350, 456, 458) | 🟡 medium |
| `src/components/orders/OrderFilters.vue` | local | 0 OrderStatus refs but **6 numeric literals** (`status === 1|2|3` × 2 sets, lines 455-508) | 🔴 high |
| `src/components/workflow/WorkflowAutomation.vue` | local | 0 OrderStatus refs but **3 numeric literals** (`status === 1|2`, lines 645, 665, 677) | 🟡 medium |
| `src/components/KeyboardShortcutFeedback.vue` | local | 1 ref | 🟢 low |
| `src/utils/offline-storage.ts` | **inline string union** | 11 refs; IndexedDB schema (lines 6-16); 3 different store names (`orderStatusUpdates`); persisted across sessions | 🔴 critical — see §9.1 |
| `src/__tests__/integration/realtime-updates.test.ts` | local | 6 refs | 🟡 medium |
| `src/__tests__/integration/order-workflow.test.ts` | local | 5 refs | 🟡 medium |
| `src/__tests__/integration/multi-order-handling.test.ts` | local | 17 refs | 🔴 high |
| `src/__tests__/unit/components/OrderStatusBadge.test.ts` | local | 10 refs | 🟡 medium |
| `src/__tests__/unit/components/__snapshots__/OrderStatusBadge.test.ts.snap` | n/a | 3 refs (snapshot) | 🟢 low — auto-regenerates |
| `priority3-progress1.txt`, `priority3-analysis.txt` | n/a | scratch analysis docs | ⚪ skip — not source files |


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

**File count:** 0. Management portal does not reference orders or `OrderStatus` directly.

### 2.7 apps/onboarding-app

**File count:** 0. Onboarding app does not reference orders or `OrderStatus`.

### 2.8 packages/testing-utils

**File count:** 3 files (1 README + 2 source), 35 occurrences.

| File | Definition / usage | Migration risk |
|------|--------------------|----------------|
| `src/factories/order.factory.ts` | **7th OrderStatus definition** at lines 84-92: `export const OrderStatus = { PENDING:"pending", CONFIRMED:"confirmed", PREPARING:"preparing", READY:"ready", DELIVERED:"delivered", COMPLETED:"completed", CANCELLED:"cancelled" } as const` — has both `DELIVERED` and `COMPLETED`, missing `PAID` and `REFUNDED`. 32 internal references in factory builders. | 🔴 critical — drives every test fixture in the monorepo via `orderFactory.build({ overrides: { status: ... } })`. CLAUDE.md mandates factory usage. Phase 2 must update this in lockstep with shared-types. |
| `src/factories/realtime.factory.ts` | 2 refs to status field in event factories | 🟡 medium |
| `README.md` | doc reference | ⚪ skip |

### 2.9 packages/shared-types

**File count:** 3 source files, 19 occurrences.

| File | Definition / usage | Migration risk |
|------|--------------------|----------------|
| `src/order.ts` | **definition #1** (numeric enum). 5 refs total — the enum + downstream usage in `Order.status: OrderStatus` | 🔴 critical — Phase 2 Task 13 rewrites this |
| `src/realtime-events.ts` | 8 refs; imports `OrderStatus` (line 8), uses it in `OrderStatusUpdateEvent.data.status` and `previousStatus` (lines 193, 195) and the type discriminator. Drives the wire format for ALL realtime broadcasts. | 🔴 critical — wire format change cascades from here |
| `src/websocket.ts` | 6 refs; defines `OrderStatusUpdateMessage` (line 52-57), `OrderUpdateData` with `status?: OrderStatus` (line 7-8); part of legacy WebSocket message contract | 🔴 high — verify in §7 whether external consumers depend on this |

### 2.10 packages/database

**File count:** 24 entries, but only **7 are source files** — the rest are migration SQL/JSON snapshots, `.backup`, `.disabled`, `.temp_skip`. Counting source only: 7 files, ~22 source occurrences.

| File | Definition / usage | Migration risk |
|------|--------------------|----------------|
| `src/schema/orders.ts` | **definition #2 — DB source of truth** (string const + union). 1 ref (the definition itself) | ✅ canonical — no change needed |
| `src/schema/order-items.ts` | 1 ref; uses related order status enum | 🟢 low |
| `src/schema/index.ts` | 1 ref (re-export) | 🟢 low |
| `src/services/order.ts` | 5 refs; `UpdateOrderStatusData` interface, `updateOrderStatus()` method (line 510), `incrementOrderStatusBy()` helper (line 603) — all already string-based | 🟢 low — already canonical |
| `src/services/realtime.ts` | 7 refs; `cacheOrderStatus()` / `getCachedOrderStatus()` / `updateOrderStatus()` — KV cache layer | 🟡 medium — verify cache key/value format matches new wire format |
| `src/services/index.ts` | 1 ref (re-export) | 🟢 low |
| `src/services/__tests__/order.test.ts` | 7 refs; tests for the canonical service | 🟢 low — already string-based |

**Migration files** (`migrations/`, `migrations_fresh/`): 17 files matched. These are historical SQL or Drizzle JSON snapshots — must NOT be modified (they encode shipped schema). New migration may be added in Phase 2 if column-level constraints change.

### 2.11 tests/e2e

**File count:** 7 files, 40 occurrences.

| File | Usage pattern | Migration risk |
|------|---------------|----------------|
| `journeys/cross-role/order-lifecycle.spec.ts` | 16 refs. Uses local `let currentOrderStatus = 0` numeric counter (line 53), with comments mapping `0=pending..5=completed`. Multiple `currentOrderStatus = N` writes across the file. Sends numeric to mock-create helper. | 🔴 high — full rewrite to string values; comment lies (`5=completed` doesn't exist in DB) |
| `integration/order-lifecycle.spec.ts` | 8 refs. Already uses string statuses: `updateOrderStatus(id, "confirmed", auth)`, `"preparing"`, `"ready"`, `"delivered"`, `"paid"`, `"cancelled"` — **already canonical, except missing a `"refunded"` test case** | 🟢 low — add refunded coverage |
| `integration/helpers.ts` | 5 refs. Helper definitions including `updateOrderStatus()` function used above | 🟡 medium |
| `journeys/customer/order-cancellation.spec.ts` | 4 refs | 🟡 medium |
| `integration/kitchen-api.spec.ts` | 4 refs | 🟡 medium |
| `support/test-helpers.ts` | 2 refs | 🟢 low |
| `helpers/assertions.ts` | 1 ref | 🟢 low |

---

### Section 2 Totals

```
Files referencing OrderStatus across the monorepo (source only):
  apps/api                      30 (excl. 2 .disabled)
  apps/realtime                  8 (1 source + 7 tests)
  apps/customer-app              8
  apps/kitchen-display          24 (excl. .txt analysis × 2)
  apps/admin-dashboard          25
  apps/management-portal         0
  apps/onboarding-app            0
  packages/testing-utils         2 (excl. README)
  packages/shared-types          3
  packages/database              7 source (excl. 17 migration files)
  tests/e2e                      7
  ────────────────────────────────
  TOTAL                        114 source files
```

**Of which contain hardcoded numeric literal comparisons against `.status`:** ~33 sites in 13 files (all in `apps/customer-app` × 5 sites and `apps/kitchen-display` × 28 sites; admin-dashboard and api have **none**).

**Of which use runtime `typeof === "number"|"string"` guards on status:** **5 sites** in 3 files —
- `apps/api/src/features/orders/services/OrdersService.ts:1238` (`typeof status === "number"` in normalizeStatus)
- `apps/api/src/features/orders/routes/index.ts:75, 95` (`typeof status === "string"` for query parsing)
- `apps/api/src/features/kitchen/services/KitchenService.ts:157, 178` (`typeof === "number"` defensive)
- `apps/kitchen-display/src/services/offlineService.ts:485` (`typeof === "number"` localStorage cache validator — Section 9.1 entry)

**Total OrderStatus definitions in the monorepo:** **7** (Issue #9 said "three") —
1. `packages/shared-types/src/order.ts` — numeric enum (canonical legacy)
2. `packages/database/src/schema/orders.ts` — string const + union (DB source of truth)
3. `apps/realtime/src/advanced-realtime-session.ts` — string enum (`OrderLifecycleState`)
4. `apps/admin-dashboard/src/types/index.ts` — string enum
5. `apps/admin-dashboard/src/components/dashboard/RecentOrders.vue` — inline string union
6. `apps/kitchen-display/src/types/index.ts` — numeric literal union
7. `packages/testing-utils/src/factories/order.factory.ts` — string const

Plus **2 more inline status unions** that aren't called `OrderStatus` but serve the same role:
- `apps/admin-dashboard/src/composables/useRealtimeOrderStatus.ts:6-12` — 6-member string union for WebSocket message schema
- `apps/kitchen-display/src/utils/offline-storage.ts:6-16` — 4-member IndexedDB persistence schema (`"received"|"preparing"|"ready"|"completed"`)

Plus **2 Zod enum schemas** in `apps/api`:
- `src/features/orders/schemas/validation.ts:23-31` — 7-member, missing `refunded`
- `src/contracts/schemas/orders.ts:22-30` — 7-member, missing `refunded`

**Adjustment to plan scope:** Issue #9 estimated 80–120 files; actual is **114 source files**, in range. But the count of distinct `OrderStatus`-shaped definitions is **11** (7 named + 4 implicit), not 3. Phase 3 sweep must visit all 11 definitions.

## 3. Hardcoded Numeric Literal Sites

Sites where code compares `.status` against a numeric literal `0`-`6`. **All of these are bugs waiting to fire**: the DB returns strings, so most of these comparisons silently evaluate `false` and the UI degrades to a default branch.

**Total: 33 sites across 13 files.**

| File:line | Code | Canonical replacement |
|-----------|------|----------------------|
| `apps/customer-app/src/views/OrderHistoryView.vue:217` | `v-if="order.status === 0"` | `v-if="order.status === 'pending'"` |
| `apps/customer-app/src/views/OrderTrackingView.vue:424` | `return order.value?.status === 0 \|\| order.value?.status === 1; // PENDING or CONFIRMED` | `return order.value?.status === 'pending' \|\| order.value?.status === 'confirmed'` |
| `apps/customer-app/src/views/OrderTrackingView.vue:474` | `if (order.value.status === 6) {` | `if (order.value.status === 'cancelled') {` |
| `apps/customer-app/src/views/OrderTrackingView.vue:476` | `status: 6,` (timeline entry) | `status: 'cancelled',` |
| `apps/customer-app/src/views/OrderTrackingView.vue:488-496` | `statusTitles = computed(() => ({ 0: ..., 1: ..., 2: ..., 3: ..., 4: ..., 5: ..., 6: ... }))` | rewrite as `Record<OrderStatus, string>` keyed by string values; add `refunded`; remove dead `5: paid` index if it overlaps |
| `apps/customer-app/src/views/OrderTrackingView.vue:498-506` | `statusDescriptions = computed(() => ({ 0..6: ... }))` | same |
| `apps/customer-app/src/views/OrderTrackingView.vue:510-519` | `getStatusIcon: { 0: ClockIcon, 1: CheckCircleIcon, 2: FireIcon, 3: CheckCircleIcon, 4: TruckIcon, 5: CheckCircleIcon, 6: XCircleIcon }` | rewrite keys as strings |
| `apps/customer-app/src/views/OrderTrackingView.vue:522-532` | `getStatusColor: { 0..6: { bg, text } }` | rewrite keys as strings |
| `apps/customer-app/src/views/OrderTrackingView.vue:545-555` | `getProgressPercentage: { 0: 20, 1: 40, 2: 60, 3: 80, 4: 100, 5: 100, 6: 0 }` | rewrite keys as strings; add `refunded: 0` |
| `apps/customer-app/src/components/OrderItemCard.vue:71` | `v-if="item.status === 1"` | `v-if="item.status === 'confirmed'"` (verify intent — may actually want `preparing`) |
| `apps/customer-app/src/utils/format.ts:273-285` | `formatOrderStatus(status: number)` with `Record<number, string>` | `formatOrderStatus(status: OrderStatus): string` keyed by string values |
| `apps/kitchen-display/src/services/kitchenStatisticsService.ts:185` | `const pending = orders.filter((o) => o.status === 1).length;` | `o.status === 'confirmed'` (mislabel: `1` is `CONFIRMED` not `PENDING` in legacy) |
| `apps/kitchen-display/src/services/kitchenStatisticsService.ts:186` | `const cooking = orders.filter((o) => o.status === 2).length;` | `o.status === 'preparing'` |
| `apps/kitchen-display/src/services/kitchenStatisticsService.ts:423` | `(o: KitchenOrder) => o.status === 1,` | `o.status === 'confirmed'` |
| `apps/kitchen-display/src/views/EnhancedKitchenDashboard.vue:210` | `filteredOrders.value.filter((order) => order.status === 1)` | `order.status === 'confirmed'` |
| `apps/kitchen-display/src/views/EnhancedKitchenDashboard.vue:214` | `filteredOrders.value.filter((order) => order.status === 2)` | `order.status === 'preparing'` |
| `apps/kitchen-display/src/views/EnhancedKitchenDashboard.vue:218` | `filteredOrders.value.filter((order) => order.status === 3)` | `order.status === 'ready'` |
| `apps/kitchen-display/src/views/HistoryView.vue:75` | `order.status === 6` | `order.status === 'cancelled'` |
| `apps/kitchen-display/src/views/HistoryView.vue:94` | `order.status === 6 ? 'text-ios-tertiary' : 'text-ios-secondary'` | `order.status === 'cancelled'` |
| `apps/kitchen-display/src/views/HistoryView.vue:244` | `(o) => o.status === 4 \|\| o.status === 5,` | `o.status === 'delivered' \|\| o.status === 'paid'` |
| `apps/kitchen-display/src/components/orders/OrderCard.vue:299` | `const isCancelled = computed(() => props.order.status === 6);` | `props.order.status === 'cancelled'` |
| `apps/kitchen-display/src/components/orders/OrderCard.vue:302` | `if (props.order.status === 6) return "border-t-4 border-[#8E8E93]";` | `=== 'cancelled'` |
| `apps/kitchen-display/src/components/orders/PriorityTimingManager.vue:349` | `const pendingOrders = props.orders.filter((order) => order.status === 1);` | `=== 'confirmed'` |
| `apps/kitchen-display/src/components/orders/PriorityTimingManager.vue:350` | `const preparingOrders = props.orders.filter((order) => order.status === 2);` | `=== 'preparing'` |
| `apps/kitchen-display/src/components/orders/PriorityTimingManager.vue:456` | `order.status === 1` | `=== 'confirmed'` |
| `apps/kitchen-display/src/components/orders/PriorityTimingManager.vue:458` | `: order.status === 2` | `=== 'preparing'` |
| `apps/kitchen-display/src/components/orders/OrderFilters.vue:455` | `() => props.orders.filter((o) => o.status === 1).length,` | `=== 'confirmed'` |
| `apps/kitchen-display/src/components/orders/OrderFilters.vue:458` | `() => props.orders.filter((o) => o.status === 2).length,` | `=== 'preparing'` |
| `apps/kitchen-display/src/components/orders/OrderFilters.vue:461` | `() => props.orders.filter((o) => o.status === 3).length,` | `=== 'ready'` |
| `apps/kitchen-display/src/components/orders/OrderFilters.vue:494` | `count: props.orders.filter((o) => o.status === 1).length,` | `=== 'confirmed'` |
| `apps/kitchen-display/src/components/orders/OrderFilters.vue:501` | `count: props.orders.filter((o) => o.status === 2).length,` | `=== 'preparing'` |
| `apps/kitchen-display/src/components/orders/OrderFilters.vue:508` | `count: props.orders.filter((o) => o.status === 3).length,` | `=== 'ready'` |
| `apps/kitchen-display/src/components/workflow/WorkflowAutomation.vue:645` | `(order) => order.status === 1 && !order.assignedChef,` | `=== 'confirmed'` |
| `apps/kitchen-display/src/components/workflow/WorkflowAutomation.vue:665` | `(order) => order.status === 1 && order.assignedChef,` | `=== 'confirmed'` |
| `apps/kitchen-display/src/components/workflow/WorkflowAutomation.vue:677` | `order.status === 2 && ...` | `=== 'preparing'` |
| `apps/kitchen-display/src/stores/orders.ts:31` | `() => orders.value.filter((order) => order.status === 1), // CONFIRMED` | `=== 'confirmed'` |
| `apps/kitchen-display/src/stores/orders.ts:35` | `() => orders.value.filter((order) => order.status === 2), // PREPARING` | `=== 'preparing'` |
| `apps/kitchen-display/src/stores/orders.ts:39` | `() => orders.value.filter((order) => order.status === 3), // READY` | `=== 'ready'` |
| `apps/kitchen-display/src/composables/useAudioNotifications.ts:196` | `return elapsedMinutes >= estimatedTime * 0.8 && order.status === 2;` | `=== 'preparing'` |

**⚠️ Semantic note:** The legacy numeric mapping in customer-app/kitchen-display reads `0=PENDING, 1=CONFIRMED, 2=PREPARING, 3=READY, 4=DELIVERED, 5=PAID, 6=CANCELLED` — matches `shared-types/src/order.ts:95-103`. The mappings ARE internally consistent across customer-app and kitchen-display, so the rewrite is mechanical. The breakage is purely in the wire-format mismatch between numeric runtime literals and the DB string return values.

## 4. Runtime `typeof status === "number"` Guards

**Total: 5 sites in 3 files.** Each guard exists to bridge the dual numeric/string wire format. After unification, all 5 become dead code (or, in one case, a cache invalidation trigger).

### 4.1 `apps/api/src/features/orders/services/OrdersService.ts:1238`

```ts
private normalizeStatus(status: OrderStatus | number | string): OrderStatus {
  if (typeof status === "number") {
    // map numeric → string via lookup
  }
  // ...
}
```

**Why it exists:** Bidirectional bridge between numeric shared-types enum and DB string. The whole `normalizeStatus` method is the bridge layer.
**Safe to delete after unification?** ✅ Yes — Phase 2 Task 14 removes the entire method.

### 4.2 `apps/api/src/features/orders/routes/index.ts:75`

```ts
return (typeof status === "string" ? [status] : status) as DbOrderStatus[];
```

**Why it exists:** The query string can be `?status=pending` (string) or `?status=pending,confirmed` (also string but parsed to array). This guard normalizes single → array.
**Safe to delete after unification?** ⚠️ **No** — this guard distinguishes scalar vs array, NOT numeric vs string. Re-read in Phase 2 Task 17 to confirm. Likely keep but rename for clarity.

### 4.3 `apps/api/src/features/orders/routes/index.ts:95`

```ts
if (typeof status === "string") {
  // single-value path
}
```

**Why it exists:** Same scalar vs array distinction as 4.2.
**Safe to delete after unification?** Same as 4.2.

### 4.4 `apps/api/src/features/kitchen/services/KitchenService.ts:157`

```ts
typeof order.status === "number"
```

**Why it exists:** Defensive guard against orders flowing through KitchenService whose `status` field somehow arrived as a number — in practice this happens when an old client emits the legacy wire format. Phase 2 Task 17 documents the guard's removal.
**Safe to delete after unification?** ✅ Yes (after Phase 6.3 — once dual-emit window closes).

### 4.5 `apps/api/src/features/kitchen/services/KitchenService.ts:178`

```ts
typeof item.status === "number"
```

**Why it exists:** Same as 4.4 but for `OrderItem.status` (note: `OrderItemStatus` is a separate type — verify in Phase 0 dead-code section whether it has the same drift).
**Safe to delete after unification?** Same as 4.4.

### 4.6 `apps/kitchen-display/src/services/offlineService.ts:485` — *additional finding*

```ts
return cachedOrders.every(
  (order) =>
    order.id &&
    order.orderNumber &&
    Array.isArray(order.items) &&
    typeof order.status === "number",
);
```

**Why it exists:** localStorage cache validator — asserts that every cached order has a numeric status field. **Currently the validator is correct under the local `OrderStatus = 0|1|2|3|4|5|6` numeric literal type** (definition #6).
**Safe to delete after unification?** ⚠️ **Critical** — this guard is the load-bearing mechanism that will trigger one-time cache invalidation across every kitchen-display tab the moment we ship the new bundle. We **must** keep it (or replace it with `typeof === "string"`) so old caches are explicitly rejected — not silently rendered with type-mismatched data. See §9.1 for full handling.

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
