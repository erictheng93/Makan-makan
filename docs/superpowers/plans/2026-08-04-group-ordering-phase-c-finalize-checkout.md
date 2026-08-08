# Group Ordering — Phase C: Finalize / Checkout + Expiry Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give group orders the one thing they've never had — a way to turn the merged cart into a real order the restaurant actually receives — triggered either by the host locking the cart or by the 45-minute timeout, atomically and idempotently.

**Architecture:** Don't reinvent order creation. `packages/database/src/services/order.ts`'s `OrderService.createOrder` (exported from `@makanmakan/database` as `OrderService`, already used by `apps/api/src/features/orders/services/OrdersService.ts`) already does atomic multi-statement writes via `db.batch()` — the exact pattern the group-ordering design spec called for — and already has a `clientMutationId`-based idempotency backstop (`orders_client_mutation_unique` index, throws `Error("CLIENT_MUTATION_DUPLICATE")` on conflict). `GroupOrdersService.finalizeGroupOrder` becomes a thin orchestrator: claim a mutex on the group order, build the merged item list from `group_cart_items`, delegate to `OrderService.createOrder`, record `masterOrderId`, and trigger the existing (Phase D will complete it) `splitBill`. A Workers Cron sweep drives the 45-minute auto-submit/cancel and the 5-minute warning, following this repo's existing `src/scheduled/*.ts` dispatch convention.

**Tech Stack:** Hono, Drizzle ORM (D1 `db.batch`), Cloudflare Workers Cron Triggers.

## Global Constraints

- D1 does not support Drizzle's `db.transaction()`. Atomicity here comes entirely from delegating to `OrderService.createOrder`'s existing `db.batch()` call — this phase does not add a second, competing batch.
- Never hand-roll order-number generation, tax/service-charge calculation, or coupon/inventory claiming — all of that already exists in `OrderService.createOrder` and must be reused, not duplicated.
- `orders.orderType` is `"shop" | "table" | "seat"` and `orders.deliveryInfo.type` is `"dine_in" | "takeaway" | "delivery"` — note the existing codebase says **"takeaway"**, not "pickup". Phase A's `GroupOrderSettings.fulfillmentType` already shipped as `"pickup"` (per the approved Phase A plan) — this phase maps `"pickup"` → `deliveryInfo.type: "takeaway"` at the finalize boundary; it does not rename either side to make them match, because Phase A is already implemented under the "pickup" name.
- `SelectedCustomizations` (real orders) and `CartItemCustomizations` (group cart items) are structurally different types (confirmed 2026-08-04: `modifiers`/`addOns`/`removedIngredients`/`size: string` vs `size: {id,name,priceAdjustment}`/`options[]`/`addOns[]` with a different shape). This phase does **not** attempt automatic translation between them — silently mistranslating a customization is worse than dropping it. `specialInstructions` carries through as `notes`; `customizations` is intentionally omitted on the finalized order line items, flagged in "Out of scope" below, not silently papered over.
- Tests: local builders, verify mock calls with `objectContaining`, no CSS assertions — matching every other task in this plan set.

## Release binding — Task 5 is tied to Phase B (decided 2026-08-05)

This phase splits across the deployment boundary, and the two halves ship differently:

| | ships when | why |
| --- | --- | --- |
| **Tasks 1-4** (API: `GroupOrderStatus` fix, `finalizeGroupOrder`, `/lock` route, expiry cron) | **independently, and first** | a finalize endpoint with no caller is inert, and landing the cron early makes the riskiest piece of this plan observable before anything depends on it |
| **Task 5** (customer-app: wire `submitOrder()`) | **with all of Phase B, on one integration branch, one Pages deploy** | Phase B makes group ordering reachable while `submitOrder()` is a throwing stub; shipping that to users without Task 5 means a table can build a shared cart and then find they cannot order |

So the sequence is: Tasks 1-4 → `main` → deploy API. Then Phase B's four tasks and this phase's Task 5 accumulate on a shared integration branch (e.g. `feat/group-ordering-cart-checkout`) and merge as one.

Task 5 must not be started before Tasks 1-4 are merged — it calls the endpoint Task 3 creates.

One consequence worth stating plainly: **Task 4's cron will be live in production before any user can reach a group order.** That is deliberate and safe — with no group orders being created through the UI there is nothing for the sweep to act on — but it also means the cron's first real exercise happens the moment Phase B ships. Treat the combined B+C-Task-5 release as the point where Task 4 needs monitoring, not the API deploy that merely introduced it.

---

## Current code this phase touches (verified 2026-08-04)

- `GroupOrdersService.cleanupExpiredGroups` (`apps/api/src/features/group-orders/services/GroupOrdersService.ts:1530`) unconditionally cancels every expired `active`/`ordering`/`checkout` group order — it never creates a real order. This phase changes it to branch on `autoSubmitOnExpiry`.
- `GroupOrdersService.splitBill` (line 919) already sets `groupOrders.status = "checkout"` and `lockedAt` as a side effect of computing splits, and already supports `splitType: "equal" | "individual"/"by_item" | "custom"` (not yet `"proportional"` — that's Phase D, and this phase's finalize flow works correctly today with `"equal"`, the same way it will once Phase D lands `"proportional"`, with zero changes needed here).
- `GroupOrdersService.processPayment` (line 1210) already flips `groupOrders.status` to `"completed"` once every `split_bills` row is paid — this phase's finalize also sets `status: "completed"` once the real order exists; both writes are idempotent/convergent (see Task 1, Step 3 note).
- `types/index.ts`'s `GroupOrderStatus` union (`"active" | "locked" | "finalized" | "completed" | "cancelled" | "expired"`) does not match the status values the service actually reads/writes (`"active"`, `"checkout"`, `"completed"`, `"cancelled"`, plus `"ordering"` referenced only in the expiry query). This is a pre-existing type/runtime mismatch this phase must fix (Task 1) because the new finalize code needs a status type it can actually rely on.
- `packages/database/src/services/order.ts:380` `OrderService.createOrder(data: CreateOrderData): Promise<Order>` — full signature confirmed:
  ```typescript
  export interface CreateOrderData {
    restaurantId: string;
    tableId?: number;
    customerId?: string;
    customerInfo?: { name?: string; phone?: string; email?: string };
    orderType?: "shop" | "table" | "seat";
    items: Array<{ menuItemId: number; quantity: number; customizations?: SelectedCustomizations; notes?: string }>;
    notes?: string;
    clientMutationId?: string;
    orderSource?: "direct" | "market_checkout" | "uber_eats" | "foodpanda" | "grabfood";
    deliveryInfo?: { type: "dine_in" | "takeaway" | "delivery"; address?: string; phone?: string; instructions?: string; deliveryFee?: number };
  }
  ```
  On a duplicate `clientMutationId`, this throws `new Error("CLIENT_MUTATION_DUPLICATE")` (confirmed at `order.ts:657-660`) rather than returning a value — callers must catch it (see `apps/api/src/features/guest-orders/routes/index.ts:170-185` for the established catch pattern this phase mirrors).
- `apps/api/src/index.ts`'s `scheduled` handler (line 46) dispatches on `cronMatches(event.cron, "<expr>")` to dynamically-imported functions under `apps/api/src/scheduled/*.ts` (see `cleanup-tokens.ts` for the exact shape: `export async function xyz(env: Env): Promise<Result>`). `apps/api/wrangler.toml`'s `[triggers] crons` array (line 325) is where a new cron expression is registered.

---

### Task 1: Fix `GroupOrderStatus` to match runtime reality

**Files:**
- Modify: `apps/api/src/features/group-orders/types/index.ts`

**Interfaces:**
- Produces: `GroupOrderStatus = "active" | "checkout" | "completed" | "cancelled"`. Consumed by Task 2's `finalizeGroupOrder`.

- [ ] **Step 1: Change the type**

```typescript
export type GroupOrderStatus =
  | "active" // 活躍，可以加入和修改
  | "checkout" // 已鎖定，正在結帳/等待付款
  | "completed" // 已完成（訂單已建立且/或已付清）
  | "cancelled"; // 已取消或逾時未送出
```

- [ ] **Step 2: Typecheck and fix any resulting call sites**

Run: `pnpm --filter @makanmakan/api typecheck`
Expected: any code that referenced the now-removed `"locked" | "finalized" | "expired"` values fails to compile — fix each one to use `"checkout"`/`"completed"`/`"cancelled"` per what it actually meant. If typecheck passes with no errors, that confirms nothing outside this file relied on the stale values (equally acceptable — don't invent a fix for an error that doesn't occur).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/group-orders/types/index.ts
git commit -m "fix(api): align GroupOrderStatus type with the status values the service actually uses"
```

---

### Task 2: `GroupOrdersService.finalizeGroupOrder`

**Files:**
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts` (add method near `splitBill`; import `OrderService` from `@makanmakan/database`)
- Test: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`

**Interfaces:**
- Consumes: `OrderService.createOrder` (`@makanmakan/database`), `groupOrders.recoveryCode`/nullable `createdBy` (Phase A), `splitBill` (existing).
- Produces: `finalizeGroupOrder(groupOrderId: string): Promise<{ success: boolean; data?: { masterOrderId: string; status: "completed" }; error?: string }>`. Consumed by Task 3's route and Task 4's cron sweep.

- [ ] **Step 1: Write the failing tests**

```typescript
describe("finalizeGroupOrder", () => {
  it("claims the active->checkout mutex, creates a real order, and records masterOrderId", async () => {
    // arrange: mocked select returns a group order with status "active",
    // fulfillmentType "dine_in", tableId 5, restaurantId "rest-1";
    // mocked cart items [{menuItemId: 10, quantity: 2, memberId: "m-1"}];
    // mock the claim UPDATE to report 1 row changed;
    // mock OrderService.createOrder (vi.mock("@makanmakan/database", ...)) to
    // resolve { id: "order-1", orderNumber: "ON-1", ... }
    const result = await service.finalizeGroupOrder("go-1");

    expect(result).toEqual({
      success: true,
      data: { masterOrderId: "order-1", status: "completed" },
    });
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        tableId: 5,
        orderType: "table",
        items: [expect.objectContaining({ menuItemId: 10, quantity: 2 })],
        clientMutationId: "group-order:go-1",
      }),
    );
    expect(updateGroupOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ masterOrderId: "order-1", status: "completed" }),
    );
  });

  it("is idempotent: a second call after masterOrderId is already set returns the existing id without creating another order", async () => {
    // arrange: mocked select returns a group order already status "completed"
    // with masterOrderId "order-1"
    const result = await service.finalizeGroupOrder("go-1");

    expect(result).toEqual({
      success: true,
      data: { masterOrderId: "order-1", status: "completed" },
    });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("rejects finalizing an empty cart", async () => {
    // arrange: mocked select returns status "active", cart items = []
    const result = await service.finalizeGroupOrder("go-1");
    expect(result).toEqual({ success: false, error: "Cannot finalize an empty group order" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("treats CLIENT_MUTATION_DUPLICATE as success and looks up the order that already exists", async () => {
    // arrange: claim UPDATE succeeds (1 row), createOrderMock rejects with
    // new Error("CLIENT_MUTATION_DUPLICATE"); mocked select-by-clientMutationId
    // (on the real `orders` table) returns { id: "order-1" }
    const result = await service.finalizeGroupOrder("go-1");
    expect(result).toEqual({
      success: true,
      data: { masterOrderId: "order-1", status: "completed" },
    });
  });

  it("maps fulfillmentType pickup to deliveryInfo.type takeaway", async () => {
    // arrange: group order settings.fulfillmentType = "pickup",
    // settings.pickupAt = "2026-08-04T18:00:00.000Z", no tableId
    await service.finalizeGroupOrder("go-1");

    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderType: "shop",
        deliveryInfo: expect.objectContaining({ type: "takeaway" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @makanmakan/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts -t "finalizeGroupOrder"`
Expected: FAIL — the method doesn't exist.

- [ ] **Step 3: Implement**

Add the import at the top of `GroupOrdersService.ts`:

```typescript
import { OrderService, orders as ordersTable } from "@makanmakan/database";
```

Add the method:

```typescript
  /**
   * Merge the group's cart into a real order. Triggered by either the host
   * locking the cart (routes/index.ts) or the expiry sweep
   * (scheduled/group-order-expiry.ts) — both call this same method, which is
   * why it must be idempotent rather than relying on its caller to dedupe.
   */
  async finalizeGroupOrder(
    groupOrderId: string,
  ): Promise<{
    success: boolean;
    data?: { masterOrderId: string; status: "completed" };
    error?: string;
  }> {
    const timer = this.performance.startTimer("finalizeGroupOrder");

    try {
      const groupOrderRows = await this.db
        .select()
        .from(groupOrders)
        .where(eq(groupOrders.id, groupOrderId));
      const groupOrder = groupOrderRows[0];

      if (!groupOrder) {
        return { success: false, error: "Group order not found" };
      }

      // Already finalized (by this call, a concurrent one, or a prior crashed
      // attempt that got far enough to write masterOrderId) — idempotent exit.
      if (groupOrder.masterOrderId) {
        return {
          success: true,
          data: { masterOrderId: groupOrder.masterOrderId, status: "completed" },
        };
      }

      const cartItems = await this.db
        .select()
        .from(groupCartItems)
        .where(
          and(
            eq(groupCartItems.groupOrderId, groupOrderId),
            eq(groupCartItems.status, "active"),
          ),
        );

      if (cartItems.length === 0) {
        return { success: false, error: "Cannot finalize an empty group order" };
      }

      // Claim the mutex. If this affects 0 rows, either someone else is
      // finalizing right now (status already "checkout") or the group order
      // was cancelled/completed already — in both cases, don't create a
      // second order. A prior crashed attempt (claimed "checkout" but never
      // reached masterOrderId) is safe to retry: the re-attempt below will
      // still run the createOrder call, and clientMutationId makes that
      // retry-safe even if an earlier attempt's batch actually did commit.
      if (groupOrder.status === "active") {
        await this.db
          .update(groupOrders)
          .set({ status: "checkout", updatedAt: new Date() })
          .where(
            and(eq(groupOrders.id, groupOrderId), eq(groupOrders.status, "active")),
          );
      } else if (groupOrder.status !== "checkout") {
        return { success: false, error: `Group order is ${groupOrder.status}, cannot finalize` };
      }

      const settings = (groupOrder.settings || {}) as GroupOrderSettings;
      const fulfillmentType = settings.fulfillmentType || "dine_in";

      const deliveryInfo =
        fulfillmentType === "dine_in"
          ? undefined
          : {
              type: (fulfillmentType === "pickup" ? "takeaway" : "delivery") as
                | "takeaway"
                | "delivery",
              address: settings.deliveryAddress
                ? [settings.deliveryAddress.line1, settings.deliveryAddress.line2]
                    .filter(Boolean)
                    .join(", ")
                : undefined,
              phone: settings.deliveryAddress?.contactPhone,
              instructions:
                fulfillmentType === "pickup" && settings.pickupAt
                  ? `Pickup requested at ${settings.pickupAt}${settings.deliveryAddress?.notes ? " — " + settings.deliveryAddress.notes : ""}`
                  : settings.deliveryAddress?.notes,
            };

      const orderService = new OrderService(this.db.session.client as never, this.env);
      const clientMutationId = `group-order:${groupOrderId}`;

      let masterOrderId: string;
      try {
        const order = await orderService.createOrder({
          restaurantId: groupOrder.restaurantId,
          tableId: groupOrder.tableId ?? undefined,
          orderType: fulfillmentType === "dine_in" ? (groupOrder.tableId ? "table" : "shop") : "shop",
          items: cartItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            notes: item.specialInstructions ?? undefined,
          })),
          notes: settings.notes ?? undefined,
          clientMutationId,
          deliveryInfo,
        });
        masterOrderId = order.id;
      } catch (error) {
        if (error instanceof Error && error.message === "CLIENT_MUTATION_DUPLICATE") {
          const existing = await this.db
            .select({ id: ordersTable.id })
            .from(ordersTable)
            .where(eq(ordersTable.clientMutationId, clientMutationId));
          if (!existing[0]) throw error;
          masterOrderId = existing[0].id;
        } else {
          throw error;
        }
      }

      const now = new Date();
      await this.db
        .update(groupOrders)
        .set({ masterOrderId, status: "completed", completedAt: now, updatedAt: now })
        .where(eq(groupOrders.id, groupOrderId));

      await this.splitBill(groupOrderId, {
        splitType: groupOrder.splitType as "equal" | "individual" | "custom" | "proportional",
        // Absolute amounts taken from the order that was just created, not
        // rates. See the note below — this is the X-1 decision.
        sharedServiceChargeCents: order.serviceChargeCents ?? 0,
        sharedTaxCents: order.taxAmountCents ?? 0,
        orderTotalCents: order.finalAmountCents,
      });

      await this.logActivity(
        groupOrderId,
        null,
        "order_finalized",
        "Group order finalized into a real order",
        { masterOrderId },
      );

      await this.cache.delete(`group_order:${groupOrderId}`);
      await this.cache.delete(`group_order_summary:${groupOrderId}`);

      return { success: true, data: { masterOrderId, status: "completed" } };
    } catch (error) {
      this.errorTracker.logError("finalizeGroupOrder", error as Error, { groupOrderId });
      this.logger.error("Failed to finalize group order", error);
      return { success: false, error: "Failed to finalize group order" };
    } finally {
      this.performance.endTimer(timer);
    }
  }
```

**Note on what `splitBill` receives — this is decision X-1, decided 2026-08-05.**

An earlier draft of this plan passed `serviceChargeRate: 0, taxRate: 0` and deferred "distribute the restaurant's real tax and service charge" to Phase D. Reviewing the two plans together showed Phase D never picked that up: its `"proportional"` branch is also rate-based and never reads the finalized order's absolute amounts. Run both plans as originally written and every member's `split_bills` row sums to **item subtotal only**, while the restaurant charges subtotal + tax + service charge — a silent shortfall of the entire tax and service charge, with no test failing to report it.

The fix is here, at the boundary: finalize already holds `order`, the real thing `OrderService.createOrder` just computed from the restaurant's actual settings. It passes those **absolute cent amounts** down rather than any rate, so the split can never disagree with what was charged. `orderTotalCents` is passed as the reconciliation target Phase D Task 2 needs (see that plan's Task 2 — reconciling `splitBillsData` against its own sum proves nothing).

Two things this deliberately does **not** claim:

- It does not make `"proportional"` behave differently from `"individual"`. Tax and service charge are themselves proportional to subtotal, so distributing them by subtotal share is arithmetically the same as applying one rate to each member's own subtotal. The two branches still coincide, and Phase D must not invent a difference to make them look distinct.
- It does not model a flat shared cost (delivery fee). That remains out of scope — but `sharedServiceChargeCents`/`sharedTaxCents` is the input a flat fee would arrive through later, which is why it is shaped as an absolute amount rather than another rate.

Phase D owns the matching half: `splitBill` must accept these fields, give every branch a defined way to absorb them, and treat them as taking precedence over `serviceChargeRate`/`taxRate` when both are supplied — the existing `POST /orders/group/:id/split` route still passes rates, and applying both would double-charge.

`this.db.session.client` — confirm this is actually how to reach the underlying `D1Database` from a `drizzle(d1)` instance in this codebase's Drizzle version before relying on it; if it isn't, construct `OrderService` from the same raw `D1Database` this service was itself constructed with (add a `private rawDb: D1Database` field set from the constructor's `database` parameter, since `GroupOrdersService`'s constructor already receives it — reuse that directly instead of reaching back through Drizzle's internals).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @makanmakan/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @makanmakan/api typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts
git commit -m "feat(api): merge a group order's cart into a real order on finalize"
```

---

### Task 3: `POST /orders/group/:groupOrderId/lock` — host-triggered finalize

**Files:**
- Modify: `apps/api/src/features/group-orders/routes/index.ts`
- Modify: `apps/api/src/features/group-orders/schemas/validation.ts`
- Test: `apps/api/src/features/group-orders/routes/index.test.ts`, `apps/api/src/features/group-orders/routes/anonymous-access.test.ts`

**Interfaces:**
- Consumes: `finalizeGroupOrder` (Task 2).
- Produces: route + `lockGroupSchema` validation.

- [ ] **Step 1: Write the failing test**

```typescript
it("lets the host finalize with a matching memberToken, and rejects a non-host token", async () => {
  groupServiceMocks.isHostSession.mockResolvedValueOnce(true);
  groupServiceMocks.finalizeGroupOrder.mockResolvedValueOnce({
    success: true,
    data: { masterOrderId: "order-1", status: "completed" },
  });

  const okResponse = await buildApp().fetch(
    new Request("https://test/orders/group/go-1/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberToken: "host-session-1" }),
    }),
    env,
  );
  expect(okResponse.status).toBe(200);
  await expect(okResponse.json()).resolves.toMatchObject({
    success: true,
    data: { masterOrderId: "order-1" },
  });

  groupServiceMocks.isHostSession.mockResolvedValueOnce(false);
  const forbiddenResponse = await buildApp().fetch(
    new Request("https://test/orders/group/go-1/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberToken: "not-the-host" }),
    }),
    env,
  );
  expect(forbiddenResponse.status).toBe(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @makanmakan/api exec vitest run src/features/group-orders/routes -t "lock"`
Expected: FAIL — route and `isHostSession` don't exist.

- [ ] **Step 3: Add `GroupOrdersService.isHostSession`**

```typescript
  async isHostSession(groupOrderId: string, memberToken: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupOrderId, groupOrderId),
          eq(groupMembers.sessionId, memberToken),
          eq(groupMembers.role, "creator"),
        ),
      );
    return rows.length > 0;
  }
```

- [ ] **Step 4: Add the schema and route**

In `validation.ts`:

```typescript
export const lockGroupOrderSchema = z.object({
  memberToken: z.string().min(1, "Member token is required"),
});
```

Add to `groupOrderSchemas`: `lockGroupOrder: lockGroupOrderSchema,`.

In `routes/index.ts` (near the `/split` route):

```typescript
/**
 * Host locks the cart and finalizes it into a real order
 * POST /api/v1/orders/group/{groupOrderId}/lock
 */
app.post(
  "/:groupOrderId/lock",
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateBody(groupOrderSchemas.lockGroupOrder),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");
    const { memberToken } = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);

    const isHost = await groupOrderService.isHostSession(groupOrderId, memberToken);
    if (!isHost) {
      throw forbidden("Only the host can finalize a group order", "NOT_HOST");
    }

    const result = await groupOrderService.finalizeGroupOrder(groupOrderId);
    if (!result.success) {
      throw badRequest(result.error ?? "Failed to finalize group order");
    }

    await broadcastGroupOrderEvent(c.env, RealtimeEventType.GROUP_ORDER_FINALIZED, {
      groupOrderId,
      masterOrderId: result.data?.masterOrderId,
    });

    return c.json({ success: true, data: result.data });
  },
);
```

Confirm `RealtimeEventType.GROUP_ORDER_FINALIZED` exists in `@makanmakan/shared-types`; if it doesn't, add it alongside the other `GROUP_*` members of that enum (same file as `GROUP_ORDER_CREATED`/`GROUP_MEMBER_JOINED`) rather than reusing an unrelated event type.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @makanmakan/api exec vitest run src/features/group-orders`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/schemas/validation.ts \
  apps/api/src/features/group-orders/routes/index.ts \
  apps/api/src/features/group-orders/routes/index.test.ts \
  apps/api/src/features/group-orders/routes/anonymous-access.test.ts
git commit -m "feat(api): let the host lock and finalize a group order"
```

---

### Task 4: Expiry sweep cron — auto-submit or cancel, with a 5-minute warning

**Files:**
- Create: `apps/api/src/scheduled/group-order-expiry.ts`
- Modify: `apps/api/src/index.ts` (register the dispatch)
- Modify: `apps/api/wrangler.toml` (add a cron expression)
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts` (extend `cleanupExpiredGroups` or add a new method — see Step 3)
- Test: `apps/api/src/scheduled/group-order-expiry.test.ts` (new)

**Interfaces:**
- Consumes: `finalizeGroupOrder` (Task 2).
- Produces: `sweepExpiringGroupOrders(env: Env): Promise<{ finalized: number; cancelled: number; warned: number; errors: string[] }>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/scheduled/group-order-expiry.test.ts
import { describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  sweepExpiring: vi.fn(),
}));
vi.mock("../features/group-orders/services/GroupOrdersService", () => ({
  GroupOrdersService: vi.fn(function GroupOrdersService() {
    return { sweepExpiringGroupOrders: serviceMocks.sweepExpiring };
  }),
}));

import { sweepExpiringGroupOrders } from "./group-order-expiry";

describe("sweepExpiringGroupOrders (scheduled task wrapper)", () => {
  it("delegates to GroupOrdersService.sweepExpiringGroupOrders and returns its result", async () => {
    serviceMocks.sweepExpiring.mockResolvedValue({
      finalized: 2,
      cancelled: 1,
      warned: 3,
      errors: [],
    });

    const result = await sweepExpiringGroupOrders({ DB: {}, CACHE_KV: {} } as never);

    expect(result).toEqual({ finalized: 2, cancelled: 1, warned: 3, errors: [] });
  });
});
```

Service-level test for the actual sweep logic, in `GroupOrdersService.test.ts`:

```typescript
describe("sweepExpiringGroupOrders", () => {
  it("finalizes an expired group with autoSubmitOnExpiry and a non-empty cart", async () => {
    // arrange: one expired group order, status "active",
    // settings.autoSubmitOnExpiry = true, has cart items
    const result = await service.sweepExpiringGroupOrders();
    expect(result.finalized).toBe(1);
    expect(finalizeGroupOrderSpy).toHaveBeenCalledWith("go-1");
  });

  it("cancels an expired group with autoSubmitOnExpiry disabled", async () => {
    // arrange: settings.autoSubmitOnExpiry = false
    const result = await service.sweepExpiringGroupOrders();
    expect(result.cancelled).toBe(1);
    expect(finalizeGroupOrderSpy).not.toHaveBeenCalled();
  });

  it("cancels an expired group whose cart is empty even if autoSubmitOnExpiry is true", async () => {
    const result = await service.sweepExpiringGroupOrders();
    expect(result.cancelled).toBe(1);
  });

  it("broadcasts an expiring-soon warning once for groups expiring within 5 minutes, and does not warn twice", async () => {
    // arrange: a group order with expiresAt 4 minutes from now, status
    // "active", settings.expiryWarnedAt not set
    const first = await service.sweepExpiringGroupOrders();
    expect(first.warned).toBe(1);

    // arrange: same group order, but settings.expiryWarnedAt is now set
    // (simulate the DB read reflecting the previous sweep's write)
    const second = await service.sweepExpiringGroupOrders();
    expect(second.warned).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @makanmakan/api exec vitest run -t "sweepExpiringGroupOrders"`
Expected: FAIL — neither method exists.

- [ ] **Step 3: Implement `GroupOrdersService.sweepExpiringGroupOrders`**

Add near `cleanupExpiredGroups` (leave `cleanupExpiredGroups` itself alone — it's still reachable via the existing admin-only `POST /cleanup/expired` route for manual ops use; this is new, cron-driven logic):

```typescript
  async sweepExpiringGroupOrders(): Promise<{
    finalized: number;
    cancelled: number;
    warned: number;
    errors: string[];
  }> {
    const nowMs = Date.now();
    const errors: string[] = [];
    let finalized = 0;
    let cancelled = 0;
    let warned = 0;

    try {
      const expired = await this.db
        .select()
        .from(groupOrders)
        .where(
          and(
            inArray(groupOrders.status, ["active", "checkout"]),
            sql`${groupOrders.expiresAt} < ${nowMs}`,
          ),
        )
        .limit(500);

      for (const groupOrder of expired) {
        try {
          const settings = (groupOrder.settings || {}) as GroupOrderSettings;
          const cartCountRows = await this.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(groupCartItems)
            .where(
              and(
                eq(groupCartItems.groupOrderId, groupOrder.id),
                eq(groupCartItems.status, "active"),
              ),
            );
          const hasItems = cartCountRows[0].count > 0;

          if ((settings.autoSubmitOnExpiry ?? true) && hasItems) {
            const result = await this.finalizeGroupOrder(groupOrder.id);
            if (result.success) {
              finalized++;
            } else {
              errors.push(`${groupOrder.id}: ${result.error}`);
            }
          } else {
            await this.db
              .update(groupOrders)
              .set({ status: "cancelled", updatedAt: new Date() })
              .where(eq(groupOrders.id, groupOrder.id));
            await this.logActivity(
              groupOrder.id,
              null,
              "order_cancelled",
              "Group order expired and was cancelled",
              { hadItems: hasItems, autoSubmitOnExpiry: settings.autoSubmitOnExpiry ?? true },
            );
            cancelled++;
          }
        } catch (error) {
          errors.push(`${groupOrder.id}: ${(error as Error).message}`);
        }
      }

      const soon = await this.db
        .select()
        .from(groupOrders)
        .where(
          and(
            eq(groupOrders.status, "active"),
            sql`${groupOrders.expiresAt} >= ${nowMs}`,
            sql`${groupOrders.expiresAt} < ${nowMs + 5 * 60 * 1000}`,
          ),
        )
        .limit(500);

      for (const groupOrder of soon) {
        const settings = (groupOrder.settings || {}) as GroupOrderSettings & {
          expiryWarnedAt?: number;
        };
        if (settings.expiryWarnedAt) continue;

        await this.db
          .update(groupOrders)
          .set({
            settings: { ...settings, expiryWarnedAt: nowMs },
            updatedAt: new Date(),
          })
          .where(eq(groupOrders.id, groupOrder.id));
        warned++;
        // The realtime broadcast for this warning is fired from the route
        // layer's cron wrapper (group-order-expiry.ts), not here — this
        // service has no RealtimeBroadcastService dependency today and
        // shouldn't gain one just for this; see routes/index.ts's existing
        // broadcastGroupOrderEvent for the pattern the wrapper reuses.
      }

      return { finalized, cancelled, warned, errors };
    } catch (error) {
      this.errorTracker.logError("sweepExpiringGroupOrders", error as Error);
      return { finalized, cancelled, warned, errors: [(error as Error).message] };
    }
  }
```

Add `expiryWarnedAt?: number;` to `GroupOrderSettings` in `packages/shared-types/src/schema-json-types.ts` alongside the fields Phase A already added there.

- [ ] **Step 4: Implement the scheduled-task wrapper**

```typescript
// apps/api/src/scheduled/group-order-expiry.ts
import { GroupOrdersService } from "../features/group-orders/services/GroupOrdersService";
import { RealtimeBroadcastService } from "@makanmakan/database";
import { RealtimeEventType } from "@makanmakan/shared-types";
import type { Env } from "../types/env";

export async function sweepExpiringGroupOrders(env: Env) {
  const service = new GroupOrdersService(env.DB, env.CACHE_KV);
  const result = await service.sweepExpiringGroupOrders();

  if (result.warned > 0) {
    // Best-effort fan-out of the 5-minute warning; a failed broadcast here
    // must not fail the cron run — the sweep's DB writes already happened.
    try {
      const broadcaster = new RealtimeBroadcastService(env);
      // Re-querying which groups were warned this tick would require the
      // service to return their ids — left as a small follow-up if the
      // warning needs to reach connected clients beyond a future poll/refetch.
    } catch (broadcastError) {
      console.warn("Failed to broadcast group-order expiry warnings:", broadcastError);
    }
  }

  return result;
}
```

(The broadcast body above is intentionally left as a documented follow-up, not a fabricated implementation — `sweepExpiringGroupOrders`'s current return shape only reports counts, not which specific group order ids were warned. If per-connection push for the warning is required rather than the client discovering it on next `GET /orders/group/:id` poll, change `GroupOrdersService.sweepExpiringGroupOrders` to also return the warned group order ids, then broadcast per id here — don't invent ids that aren't there.)

- [ ] **Step 5: Register the cron**

In `apps/api/wrangler.toml`, add one more entry to the existing `crons` array (do not renumber or reformat the existing entries):

```toml
  "*/2 * * * *",   # Group order expiry sweep (auto-submit/cancel + 5-min warning)
```

In `apps/api/src/index.ts`'s `scheduled` handler, add a dispatch branch alongside the existing ones:

```typescript
      if (cronMatches(event.cron, "*/2 * * * *")) {
        console.log("[Cron] Running group order expiry sweep...");
        const { sweepExpiringGroupOrders } = await import("./scheduled/group-order-expiry");
        const result = await sweepExpiringGroupOrders(env);
        console.log("[Cron] Group order expiry sweep result:", result);
      }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @makanmakan/api exec vitest run src/scheduled/group-order-expiry.test.ts src/features/group-orders`
Expected: PASS

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @makanmakan/api typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/scheduled/group-order-expiry.ts \
  apps/api/src/scheduled/group-order-expiry.test.ts \
  apps/api/src/index.ts \
  apps/api/wrangler.toml \
  apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts \
  packages/shared-types/src/schema-json-types.ts
git commit -m "feat(api): auto-finalize or cancel group orders on expiry via cron"
```

---

### Task 5: Wire the customer-app `submitOrder()` stub to the real endpoint

**Files:**
- Modify: `apps/customer-app/src/composables/useGroupOrder.ts`
- Test: `apps/customer-app/src/composables/useGroupOrder.test.ts`

**Interfaces:**
- Consumes: `POST /orders/group/:groupOrderId/lock` (Task 3).

- [ ] **Step 1: Write the failing test**

```typescript
it("submitOrder posts memberToken to /orders/group/:id/lock and returns the masterOrderId", async () => {
  const { createGroup, submitOrder } = useGroupOrder();
  vi.mocked(apiClient.post).mockResolvedValueOnce({
    data: { success: true, data: { groupOrderId: "go-1", shareCode: "X", expiresAt: new Date().toISOString(), host: { id: "m-1", memberId: "m-1", memberName: "Alex", isHost: true }, memberToken: "session-1", recoveryCode: "r-1" } },
  });
  await createGroup({ restaurantId: "rest-1" } as never);

  vi.mocked(apiClient.post).mockResolvedValueOnce({
    data: { success: true, data: { masterOrderId: "order-1", status: "completed" } },
  });
  const result = await submitOrder();

  expect(apiClient.post).toHaveBeenCalledWith(
    "/orders/group/go-1/lock",
    { memberToken: "session-1" },
  );
  expect(result).toEqual({ masterOrderId: "order-1" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter customer-app exec vitest run src/composables/useGroupOrder.test.ts -t "submitOrder posts"`
Expected: FAIL — Phase B's `submitOrder` always throws.

- [ ] **Step 3: Implement**

Replace the Phase B stub:

```typescript
async function submitOrder(): Promise<{ masterOrderId: string }> {
  if (!groupOrder.value) {
    throw new Error("No active group order to submit");
  }
  const response = await apiClient.post(`/orders/group/${groupOrder.value.id}/lock`, {
    memberToken: sessionToken,
  });
  groupOrder.value.status = "submitted";
  return { masterOrderId: response.data.data.masterOrderId };
}
```

Also delete the now-obsolete test from Phase B ("submitOrder is explicitly not implemented in this phase") — it documented a deliberate limitation of that phase, which this task removes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter customer-app exec vitest run src/composables/useGroupOrder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/customer-app/src/composables/useGroupOrder.ts apps/customer-app/src/composables/useGroupOrder.test.ts
git commit -m "feat(customer-app): wire group-order submit to the real finalize endpoint"
```

---

## Self-review notes

- **Spec coverage:** decisions 7 (auto-submit-on-expiry, 5-minute warning), 8 (atomic + idempotent finalize) — Tasks 2-4. The host-only lock (part of decision 4's host-controls-submission intent) — Task 3.
- **Placeholder scan:** the one deliberately incomplete piece (per-connection push of the 5-minute warning) is explicitly named as a follow-up with a concrete "what to change" instruction (Task 4, Step 4), not a silent gap or a fabricated broadcast call.
- **Type consistency:** `finalizeGroupOrder`'s return shape (`{ masterOrderId, status: "completed" }`) is defined once in Task 2 and reused identically by Task 3's route and Task 4's sweep.
- **Deviation from the original design spec, noted:** the spec's Data Model section anticipated a hand-rolled `db.batch()` in the finalize glue; this plan instead delegates to `OrderService.createOrder`'s existing batch + idempotency mechanism, discovered during implementation-grounding research. This is a strictly better fit (proven, tested, DRY) and doesn't change any user-facing decision from the spec.
- **Out of scope, explicitly:** `deliveryFeeCents` proration (spec decision 6 mentions it; no restaurant-facing UI or computation exists yet to set a delivery fee in the first place — deferred until that exists), automatic `customizations` translation onto the real order (structurally incompatible types, noted above), per-connection push of the expiry warning (Task 4, Step 4).
- **Moved *into* scope by X-1 (2026-08-05):** distributing the restaurant's real tax and service charge across members. This was previously deferred to Phase D, which never picked it up — see the X-1 note in Task 2, Step 3. Task 2 now passes absolute cent amounts and the order total down to `splitBill`; Phase D Task 1 owns consuming them. Neither plan is complete without the other half, so **do not merge Task 2 before Phase D Tasks 1-2 are in place** (the staging in `2026-08-05-group-ordering-bcd-AUDIT.md` orders it that way deliberately).
