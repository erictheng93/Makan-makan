# Order Multi-Tenant Isolation (Defence-in-Depth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add service-layer tenant isolation as a defence-in-depth safety net for the order system, so that even if a future route handler omits the restaurant check, the service layer catches it.

**Architecture:** Introduce a `CallerContext` type carrying `userId`, `userRole`, and `userRestaurantId`. Pass it to `OrdersService` methods that access or mutate orders. The service validates restaurant ownership when the caller is non-admin. This supplements (not replaces) the existing route-level checks in `routes/index.ts`.

**Tech Stack:** TypeScript, Vitest, existing Hono middleware patterns

---

## Current State

The **route layer** (`apps/api/src/features/orders/routes/index.ts`) already enforces:

- `GET /orders`: Sets `filters.restaurantId = user.restaurantId` for non-admin (line 392)
- `GET /orders/:id`: Checks `user.restaurantId !== order.restaurantId` (line 440)
- `PUT /orders/:id/status`: Checks `user.restaurantId !== existingOrder.restaurantId` (line 481)
- `DELETE /orders/:id`: Checks `user.restaurantId !== order.restaurantId` (line 609)
- `POST /orders`: Checks `user.restaurantId !== data.restaurantId` (line 303)

The **service layer** (`OrdersService`) has a stub `applyPermissionFilters()` and no ownership checks. This is the gap to fill.

## File Map

| Action        | File                                                              | Responsibility                                                                  |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Modify**    | `apps/api/src/features/orders/types/index.ts`                     | Add `CallerContext` type                                                        |
| **Modify**    | `apps/api/src/features/orders/services/OrdersService.ts`          | Implement `applyPermissionFilters`, add ownership checks, add post-query filter |
| **Modify**    | `apps/api/src/features/orders/routes/index.ts`                    | Pass `CallerContext` from auth user to service calls                            |
| **Modify**    | `apps/api/src/features/orders/__tests__/tenant-isolation.test.ts` | Convert KNOWN GAP tests to real enforcement tests                               |
| **No change** | `apps/api/src/middleware/auth.ts`                                 | Already provides `restaurantId` in JWT context                                  |
| **No change** | `packages/database/`                                              | DB layer unchanged — filtering is at service level                              |

---

### Task 1: Add CallerContext type

**Files:**

- Modify: `apps/api/src/features/orders/types/index.ts`

- [ ] **Step 1: Add CallerContext interface**

At the end of the existing type definitions (after the `OrderQueryFilters` interface), add:

```typescript
/**
 * Caller context for service-layer defence-in-depth authorization.
 * Passed from route handlers to service methods.
 * When provided, the service validates restaurant ownership for non-admin callers.
 */
export interface CallerContext {
  userId: number;
  userRole: number;
  /** The restaurant the caller belongs to. undefined for admin users. */
  userRestaurantId?: string;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -5`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/orders/types/index.ts
git commit -m "feat(orders): add CallerContext type for service-layer tenant isolation"
```

---

### Task 2: Implement service-layer tenant checks

**Files:**

- Modify: `apps/api/src/features/orders/services/OrdersService.ts`

- [ ] **Step 1: Add helper method `assertRestaurantAccess`**

Add a private method that throws when a non-admin caller accesses an order from a different restaurant:

```typescript
/**
 * Defence-in-depth: verify the caller has access to the order's restaurant.
 * Admin (role 0) is always allowed. Non-admin must match restaurantId.
 */
private assertRestaurantAccess(
  order: { restaurantId: string },
  caller?: CallerContext,
): void {
  if (!caller) return; // No caller context = trust the route layer
  if (caller.userRole === 0) return; // Admin bypasses
  if (caller.userRestaurantId && caller.userRestaurantId !== order.restaurantId) {
    throw new Error(
      `Access denied: user restaurant ${caller.userRestaurantId} cannot access order from restaurant ${order.restaurantId}`,
    );
  }
}
```

- [ ] **Step 2: Implement `applyPermissionFilters`**

Replace the stub with actual enforcement:

```typescript
private async applyPermissionFilters(
  filters: OrderQueryFilters,
  userId?: number,
  userRole?: UserRole,
  caller?: CallerContext,
): Promise<OrderQueryFilters> {
  const role = caller?.userRole ?? userRole;
  const restaurantId = caller?.userRestaurantId;

  if (role === 0 || role === undefined) {
    // Admin or unknown role — no additional filtering
    return filters;
  }

  // Non-admin users MUST be scoped to their restaurant
  if (restaurantId) {
    // Override any provided restaurantId with the caller's own restaurant
    return { ...filters, restaurantId };
  }

  return filters;
}
```

- [ ] **Step 3: Add post-query restaurant filter to `getOrders`**

After the `getOrders` base service call, add a safety filter:

```typescript
// Defence-in-depth: strip any orders that don't match the requested restaurant
if (filters.restaurantId) {
  orders = orders.filter((o) => o.restaurantId === filters.restaurantId);
}
```

- [ ] **Step 4: Add CallerContext parameter to key methods**

Update method signatures (add optional `caller?: CallerContext` as last param):

- `getOrder(id, includeItems, caller?)` — after fetching, call `assertRestaurantAccess(order, caller)`
- `updateOrderStatus(id, statusData, userId, userRole, caller?)` — after fetching order, call `assertRestaurantAccess`
- `cancelOrder(id, reason, userId, caller?)` — fetch order first, call `assertRestaurantAccess`
- `getOrders(filters, userId, userRole, caller?)` — pass caller to `applyPermissionFilters`
- `getOrderAnalytics(filters, userId, caller?)` — enforce restaurantId for non-admin

Import `CallerContext` from types.

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -10`
Expected: No new errors (CallerContext is optional, so all existing callers are unaffected)

- [ ] **Step 6: Run existing tests to verify no regression**

Run: `pnpm vitest run apps/api/src/features/orders/__tests__/ 2>&1 | tail -5`
Expected: All 485 tests still pass (CallerContext is optional, defaults to no-op)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/orders/services/OrdersService.ts
git commit -m "feat(orders): implement service-layer tenant isolation with CallerContext"
```

---

### Task 3: Pass CallerContext from route handlers

**Files:**

- Modify: `apps/api/src/features/orders/routes/index.ts`

- [ ] **Step 1: Create `toCallerContext` helper at the top of routes file**

```typescript
import type { CallerContext } from "../types";

function toCallerContext(user: AuthUser): CallerContext {
  return {
    userId: user.id,
    userRole: user.role,
    userRestaurantId: user.restaurantId,
  };
}
```

- [ ] **Step 2: Pass CallerContext to service calls**

Update each route handler to pass the context:

- `POST /` (create): `ordersService.createOrder(createOrderData, user.id)` — no change needed (route already validates restaurant)
- `GET /` (list): `ordersService.getOrders(filters, user.id, user.role, toCallerContext(user))`
- `GET /:id` (detail): `ordersService.getOrder(parseInt(id), true, toCallerContext(user))`
- `PUT /:id/status`: `ordersService.updateOrderStatus(parseInt(id), {...}, user.id, user.role, toCallerContext(user))`
- `DELETE /:id`: `ordersService.cancelOrder(parseInt(id), "Cancelled by user", user.id, toCallerContext(user))`
- `GET /stats`: `ordersService.getDailyStats(...)` — already scoped by restaurantId param
- `GET /analytics`: `ordersService.getOrderAnalytics(filters, user.id, toCallerContext(user))`
- `POST /bulk`: `ordersService.bulkUpdateOrders(bulkOp, user.id)` — leave for separate enhancement

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run apps/api/src/features/orders/__tests__/ 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/orders/routes/index.ts
git commit -m "feat(orders): pass CallerContext from route handlers to service layer"
```

---

### Task 4: Update tenant isolation tests

**Files:**

- Modify: `apps/api/src/features/orders/__tests__/tenant-isolation.test.ts`

- [ ] **Step 1: Convert "KNOWN GAP" tests to enforcement tests**

The 6 KNOWN GAP tests should now expect the service to **reject** cross-restaurant access when `CallerContext` is provided. Update each:

**Gap 1** — `non-admin user can call getOrders without restaurantId`:
→ Now `applyPermissionFilters` forces `restaurantId = caller.userRestaurantId`, so the base service receives the caller's restaurant.

**Gap 2** — `getOrder returns order from any restaurant`:
→ Now `assertRestaurantAccess` throws when caller's restaurant doesn't match.

**Gap 3** — `updateOrderStatus allows cross-restaurant status change`:
→ Now `assertRestaurantAccess` throws before updating.

**Gap 4** — `cancelOrder allows cross-restaurant cancellation`:
→ Now `assertRestaurantAccess` throws before cancelling.

**Gap 5** — `base service returns orders from wrong restaurant`:
→ Now post-query filter strips them.

**Gap 6** — `applyPermissionFilters does not modify filters for non-admin`:
→ Now it overrides `restaurantId` with caller's restaurant.

- [ ] **Step 2: Add backward-compatibility test**

Verify that when `CallerContext` is NOT provided (existing callers), the service still works without enforcement (no regression for internal/system calls).

- [ ] **Step 3: Run updated tests**

Run: `pnpm vitest run apps/api/src/features/orders/__tests__/tenant-isolation.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass, no KNOWN GAP tests remain

- [ ] **Step 4: Run full order test suite**

Run: `pnpm vitest run apps/api/src/features/orders/__tests__/ 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/orders/__tests__/tenant-isolation.test.ts
git commit -m "test(orders): convert KNOWN GAP tests to enforcement tests after tenant isolation fix"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full order test suite across all layers**

```bash
pnpm vitest run apps/api/src/features/orders/__tests__/ && \
pnpm vitest run packages/database/src/services/__tests__/order.test.ts && \
pnpm vitest run apps/api/src/features/guest-orders/ && \
pnpm vitest run apps/kitchen-display/src/components/orders/__tests__/ apps/kitchen-display/src/stores/__tests__/orders.test.ts apps/kitchen-display/src/stores/__tests__/orderManagement.test.ts apps/kitchen-display/src/__tests__/integration/ && \
pnpm vitest run apps/admin-dashboard/src/stores/__tests__/order.test.ts
```

Expected: All pass

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 3: Commit final state**

Only if any loose changes remain.
