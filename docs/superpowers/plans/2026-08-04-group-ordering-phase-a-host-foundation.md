# Group Ordering — Phase A: Guest Host Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a group order be created and hosted by a **guest** (no account required), with a host recovery mechanism, a public join-preview lookup, and dine-in/delivery/pickup fulfillment metadata — without breaking the existing staff-hosted flow.

**Architecture:** Extend the existing `group-orders` feature (schema, service, routes) rather than rebuild it — `POST /orders/group/create` and `POST /orders/group/join/:shareCode` already work; this phase makes creation guest-capable, adds a `recoveryCode` secret + `/recover` endpoint, adds a side-effect-free `GET /orders/group/join/:shareCode` preview, and stores new fulfillment/expiry preferences in the existing `settings` JSON blob (no new columns for those — only `recoveryCode` and a nullable `created_by` need a real migration).

**Tech Stack:** Hono (Cloudflare Workers), Drizzle ORM (D1/SQLite), Zod validation, Vitest.

## Global Constraints

- D1 does not support Drizzle's `db.transaction()` — none of this phase needs a multi-statement transaction, but don't introduce one.
- SQLite/D1 cannot alter a column's NOT NULL constraint or add a `UNIQUE` constraint in place — changing `group_orders.created_by` requires the CREATE-new-table → INSERT → DROP → RENAME recreation pattern (see `packages/database/migrations_fresh/0073_images_uploaded_by_text.sql` for the house style).
- Every schema change must be paired in both `packages/database/migrations_fresh/` (fresh baseline, used by `apps/api/wrangler.toml`) and `packages/database/migrations/` (legacy Wrangler track, used by `apps/management-api/wrangler.toml`), registered in `packages/database/migration-dual-track.json`, and verified with `pnpm check:migration-dual-track`.
- Timestamps are `INTEGER` Unix milliseconds via Drizzle `{ mode: "timestamp_ms" }`; TypeScript code passes `Date` objects, never raw numbers.
- No raw string SQL in application code — Drizzle query builder or `sql` + schema refs only.
- API error responses go through `ApiError`/`badRequest`/`notFound`/`forbidden`/`conflict` from `@makanmasak/utils` (re-exported at `apps/api/src/shared/utils/api-error.ts`) — never hand-roll an error JSON shape.
- Tests: local builder functions, not `@makanmasak/testing-utils` (doesn't exist). Verify mock calls with `expect(...).toHaveBeenCalledWith(expect.objectContaining(...))`, never exact-match generated IDs/timestamps.

---

## Current code this phase touches (verified against the live local D1 schema and current source, 2026-08-04)

- `group_orders` table (live schema, confirmed via `sqlite3` against `.wrangler/shared-state`):
  ```sql
  CREATE TABLE "group_orders" (
    `id` text PRIMARY KEY NOT NULL,
    `share_code` text NOT NULL,
    `master_order_id` TEXT,
    `created_by` TEXT NOT NULL,
    `restaurant_id` text NOT NULL,
    `table_id` integer,
    `status` text DEFAULT 'active' NOT NULL,
    `split_type` text DEFAULT 'individual' NOT NULL,
    `expires_at_ms` integer NOT NULL,
    `locked_at_ms` integer,
    `completed_at_ms` integer,
    `settings` text DEFAULT '{}' NOT NULL,
    `notes` text,
    `created_at_ms` integer NOT NULL,
    `updated_at_ms` integer NOT NULL,
    `total_amount_cents` integer, `tax_amount_cents` integer,
    `service_charge_cents` integer, `final_amount_cents` integer,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
  )
  ```
  Indexes: `group_orders_share_code_unique` (unique, `share_code`), `idx_group_orders_expires` (`expires_at_ms`), `idx_group_orders_restaurant_status` (`restaurant_id`,`status`), `idx_group_orders_status_created` (`status`,`created_at_ms`), `idx_group_orders_table` (`table_id`).
  Triggers: `group_orders_restaurant_guard_bi`/`_bu` (abort insert/update if `restaurant_id` doesn't exist in `restaurants`).
- `apps/api/src/features/group-orders/services/GroupOrdersService.ts` — `createGroupOrder(data, hostId)` (line 265) always requires `hostId`; `joinGroup(shareCode, memberData)` (line 393) is already guest-callable (no auth); `generateShareCode()` (line 1711) is a private 8-char `Math.random()` helper — leave it as-is, it's for public join codes, not the new secret.
- `apps/api/src/features/group-orders/routes/index.ts` — `POST /create` (line 206) is gated `authMiddleware, requireRole([0,1,2,3,4])` (staff-only roles; excludes guests entirely). `POST /join/:shareCode` (line 250) has no auth gate (confirmed by `routes/anonymous-access.test.ts`).
- `apps/api/src/middleware/moduleGate.ts` — `moduleGate(module)` (line 139) derives `restaurantId` only from `c.get("user")`; with no user it throws `forbidden("NO_RESTAURANT")`, which would break a guest-hosted `/create` even after the auth gate is relaxed.
- `packages/shared-types/src/schema-json-types.ts` — `GroupOrderSettings` (line 13) already has `maxMembers?`, `expirationMinutes?` (currently unused by the service), `notes?`, `tableNumber?`. This is where the new fulfillment/expiry preferences belong — no migration needed for them.

---

### Task 1: `moduleGate` guest-restaurantId fallback

**Files:**
- Modify: `apps/api/src/middleware/moduleGate.ts:139-185`
- Test: `apps/api/src/middleware/moduleGate.guest-fallback.test.ts` (new)

**Interfaces:**
- Produces: `moduleGate(module: ModuleKey, resolveGuestRestaurantId?: (c: Context<{ Bindings: Env }>) => string | undefined | Promise<string | undefined>)` — second parameter is optional and backward compatible; existing calls (`moduleGate("online_ordering")`) are unaffected.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/middleware/moduleGate.guest-fallback.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { moduleGate } from "./moduleGate";
import { ApiError } from "../shared/utils/api-error";

class FakeKv {
  constructor(private data: Record<string, unknown>) {}
  async get<T>(key: string): Promise<T | null> {
    const restaurantId = key.replace(/^subscription:/, "");
    return (this.data[restaurantId] as T) ?? null;
  }
  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

function envWithActiveSubscription(restaurantId: string) {
  return {
    DB: {},
    CACHE_KV: new FakeKv({
      [restaurantId]: {
        isActive: true,
        planTier: "basic",
        moduleOverrides: {},
        trialEndsAt: null,
      },
    }),
  } as unknown as Record<string, unknown>;
}

function buildApp(fallback: (c: any) => string | undefined) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 403,
      );
    }
    return c.json({ success: false, error: { message: String(err) } }, 500);
  });
  app.post("/create", moduleGate("online_ordering", fallback), (c) =>
    c.json({ success: true }),
  );
  return app;
}

describe("moduleGate guest-restaurantId fallback", () => {
  it("resolves the module gate from the fallback when there is no authenticated user", async () => {
    const app = buildApp(() => "rest-guest-1");

    const res = await app.fetch(
      new Request("https://test/create", { method: "POST" }),
      envWithActiveSubscription("rest-guest-1"),
    );

    expect(res.status).toBe(200);
  });

  it("still throws NO_RESTAURANT when the fallback also returns nothing", async () => {
    const app = buildApp(() => undefined);

    const res = await app.fetch(
      new Request("https://test/create", { method: "POST" }),
      envWithActiveSubscription("rest-guest-1"),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "NO_RESTAURANT" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @makanmasak/api exec vitest run src/middleware/moduleGate.guest-fallback.test.ts`
Expected: FAIL — `moduleGate` currently accepts only one argument, the fallback is never called, first test gets `403 NO_RESTAURANT` instead of `200`.

- [ ] **Step 3: Implement the fallback parameter**

In `apps/api/src/middleware/moduleGate.ts`, replace the `moduleGate` function (currently lines 139-185):

```typescript
export function moduleGate(
  module: ModuleKey,
  resolveGuestRestaurantId?: (
    c: Context<{ Bindings: Env }>,
  ) => string | undefined | Promise<string | undefined>,
) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get("user");

    // Admins bypass all module gates
    if (user?.role === 0) {
      await next();
      return;
    }

    const restaurantId =
      user?.restaurantId != null
        ? String(user.restaurantId)
        : await resolveGuestRestaurantId?.(c);

    if (!restaurantId) {
      throw forbidden(
        "No restaurant associated with this account",
        "NO_RESTAURANT",
      );
    }

    const sub = await getSubscription(c, restaurantId);

    if (!sub) {
      throw forbidden(
        "Subscription not found. Please contact support.",
        "SUBSCRIPTION_NOT_FOUND",
      );
    }

    if (!resolveModule(sub, module)) {
      const isTrialExpired =
        sub.planTier === "trial" &&
        sub.trialEndsAt !== null &&
        Date.now() > sub.trialEndsAt;

      throw forbidden(
        isTrialExpired
          ? "Trial period has ended. Please upgrade your plan."
          : "This feature is not included in your current plan.",
        isTrialExpired ? "TRIAL_EXPIRED" : "MODULE_NOT_ENABLED",
      );
    }

    await next();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @makanmasak/api exec vitest run src/middleware/moduleGate.guest-fallback.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Run the full moduleGate test suite to check for regressions**

Run: `pnpm --filter @makanmasak/api exec vitest run src/middleware/moduleGate`
Expected: PASS — existing `moduleGate("x")` one-argument call sites are unaffected (`resolveGuestRestaurantId` is `undefined`, `await undefined?.()` short-circuits to `undefined`, identical to today's behavior).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/moduleGate.ts apps/api/src/middleware/moduleGate.guest-fallback.test.ts
git commit -m "feat(api): let moduleGate resolve restaurantId from a guest fallback"
```

---

### Task 2: Migration — nullable `created_by` + `recovery_code` on `group_orders`

**Files:**
- Modify: `packages/database/src/schema/group-orders.ts:32-82` (the `groupOrders` table definition)
- Create: `packages/database/migrations_fresh/0080_group_orders_guest_host.sql`
- Create: `packages/database/migrations/0097_group_orders_guest_host.sql` (legacy track pair — confirm the exact next free number with `ls packages/database/migrations | tail -5` before writing, and confirm the legacy `group_orders.created_by` FK clause with `grep -n "created_by" packages/database/migrations/0017_group_ordering_system.sql` — it currently reads `ON DELETE CASCADE`, unlike the fresh track's `no action`; preserve that legacy-specific clause when recreating)
- Modify: `packages/database/migration-dual-track.json` (append a `pairs` entry)
- Test: real-D1 integration test, e.g. `apps/api/src/features/group-orders/services/GroupOrdersService.migration.real.test.ts` (new) — only add if the repo's real-D1 test harness is already wired for this feature; otherwise verify manually per Step 4 below and skip a dedicated test file (do not invent a harness this task doesn't need).

**Interfaces:**
- Produces: `groupOrders.createdBy` becomes nullable in the Drizzle schema; `groupOrders.recoveryCode` (`text`, unique, not null) is added. Both are consumed by Task 4's `createGroupOrder`.

- [ ] **Step 1: Update the Drizzle schema (source of truth)**

In `packages/database/src/schema/group-orders.ts`, change:

```typescript
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
```

to:

```typescript
    createdBy: text("created_by").references(() => users.id),
    recoveryCode: text("recovery_code").notNull().unique(),
```

- [ ] **Step 2: Write the fresh-track migration**

Create `packages/database/migrations_fresh/0080_group_orders_guest_host.sql`:

```sql
-- 0080: group_orders.created_by -> nullable, add recovery_code
--
-- Group orders must be hostable by a guest (no account), so created_by can
-- no longer be NOT NULL. SQLite/D1 cannot alter a NOT NULL constraint in
-- place, so the table is rebuilt (same pattern as 0073).
--
-- recovery_code is the host's device-recovery secret (see design spec
-- docs/superpowers/specs/2026-08-04-group-ordering-design.md, decision 3) —
-- a plaintext high-entropy bearer token, same convention as
-- reservations.confirmation_code / service_bookings.confirmation_code
-- elsewhere in this schema, not a hash. Existing rows are backfilled with a
-- random value so the NOT NULL + UNIQUE constraint holds immediately.

DROP TABLE IF EXISTS `__new_group_orders`;
--> statement-breakpoint

CREATE TABLE `__new_group_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`share_code` text NOT NULL,
	`master_order_id` TEXT,
	`created_by` TEXT,
	`recovery_code` TEXT NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`split_type` text DEFAULT 'individual' NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`locked_at_ms` integer,
	`completed_at_ms` integer,
	`settings` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`total_amount_cents` integer,
	`tax_amount_cents` integer,
	`service_charge_cents` integer,
	`final_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `__new_group_orders` (
  `id`, `share_code`, `master_order_id`, `created_by`,
  `recovery_code`,
  `restaurant_id`, `table_id`, `status`, `split_type`,
  `expires_at_ms`, `locked_at_ms`, `completed_at_ms`, `settings`, `notes`,
  `created_at_ms`, `updated_at_ms`,
  `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents`
)
SELECT
  `id`, `share_code`, `master_order_id`, `created_by`,
  lower(hex(randomblob(16))),
  `restaurant_id`, `table_id`, `status`, `split_type`,
  `expires_at_ms`, `locked_at_ms`, `completed_at_ms`, `settings`, `notes`,
  `created_at_ms`, `updated_at_ms`,
  `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents`
FROM `group_orders`;
--> statement-breakpoint

DROP TABLE `group_orders`;
--> statement-breakpoint

ALTER TABLE `__new_group_orders` RENAME TO `group_orders`;
--> statement-breakpoint

CREATE UNIQUE INDEX `group_orders_share_code_unique` ON `group_orders` (`share_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_orders_recovery_code_unique` ON `group_orders` (`recovery_code`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_restaurant_status` ON `group_orders` (`restaurant_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_status_created` ON `group_orders` (`status`,`created_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_table` ON `group_orders` (`table_id`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_expires` ON `group_orders` (`expires_at_ms`);
--> statement-breakpoint

CREATE TRIGGER `group_orders_restaurant_guard_bi`
BEFORE INSERT ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
```

- [ ] **Step 3: Write the paired legacy-track migration**

First run `ls packages/database/migrations | tail -5` to get the actual next free number (it was `0096_qr_two_phase_rotation.sql` plus two non-numbered files as of 2026-08-04 — confirm before naming). Then read the legacy `group_orders` CREATE TABLE (`grep -n "CREATE TABLE group_orders" -A 25 packages/database/migrations/0017_group_ordering_system.sql`, and check `packages/database/migrations/0087_money_cents_cutover.sql` for any later column changes to `group_orders` in this track) and write `packages/database/migrations/0097_group_orders_guest_host.sql` mirroring Step 2's logic but against the legacy table's actual current column list and its `ON DELETE CASCADE` FK clause on `created_by`. Do not guess the legacy column list from this plan — read it live, the same way Step 2's list was confirmed against the fresh track's live local D1 (`sqlite3 .wrangler/shared-state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite "SELECT sql FROM sqlite_master WHERE type='table' AND name='group_orders';"` — find the right hash file for management-api's local D1 the same way this plan found the api one).

- [ ] **Step 4: Apply and manually verify locally**

```bash
pnpm db:migrate:local
sqlite3 ".wrangler/shared-state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite" "PRAGMA table_info(group_orders);"
```

Expected: `created_by` shows `notnull = 0`; `recovery_code` is present with `notnull = 1`; a subsequent `SELECT recovery_code, created_by FROM group_orders LIMIT 3;` (if any rows exist) shows backfilled hex strings for `recovery_code` and preserved values for `created_by`.

- [ ] **Step 5: Register the pair and verify the dual-track guard**

Add to `packages/database/migration-dual-track.json`'s `pairs` array (matching the existing entries' shape):

```json
{
  "fresh": "0080_group_orders_guest_host.sql",
  "legacy": "0097_group_orders_guest_host.sql",
  "reason": "group_orders.created_by becomes nullable and a recovery_code secret column is added so a group order can be hosted by a guest with no account (group ordering design, decision 3)."
}
```

Run: `pnpm check:migration-dual-track`
Expected: PASS

- [ ] **Step 6: Run the existing group-orders test suite for regressions**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders`
Expected: PASS — `createGroupOrder` still inserts `createdBy: hostId` (a non-null string in every existing call site so far), so no existing behavior changes yet; this task only makes the column *capable* of being null. `recoveryCode` isn't written yet either — that's Task 4. If any test inserts a `group_orders` row directly without a `recovery_code` (bypassing the service), it will now fail NOT NULL; fix by adding a `recoveryCode` value to that test's fixture, not by loosening the schema.

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/schema/group-orders.ts \
  packages/database/migrations_fresh/0080_group_orders_guest_host.sql \
  packages/database/migrations/0097_group_orders_guest_host.sql \
  packages/database/migration-dual-track.json
git commit -m "feat(database): make group_orders.created_by nullable, add recovery_code"
```

---

### Task 3: `GroupOrderSettings` — fulfillment + expiry preferences

**Files:**
- Modify: `packages/shared-types/src/schema-json-types.ts:13-27`

**Interfaces:**
- Produces: `GroupOrderSettings.fulfillmentType?: "dine_in" | "delivery" | "pickup"`, `GroupOrderSettings.deliveryAddress?: GroupOrderDeliveryAddress`, `GroupOrderSettings.pickupAt?: string` (ISO datetime), `GroupOrderSettings.autoSubmitOnExpiry?: boolean`. New exported type `GroupOrderDeliveryAddress`. Consumed by Task 4.

- [ ] **Step 1: Add the fields**

In `packages/shared-types/src/schema-json-types.ts`, add above `GroupOrderSettings`:

```typescript
/**
 * Delivery address for a fulfillmentType: "delivery" group order.
 */
export interface GroupOrderDeliveryAddress {
  line1: string;
  line2?: string;
  contactPhone?: string;
  notes?: string;
}
```

Then extend `GroupOrderSettings`:

```typescript
export interface GroupOrderSettings {
  maxMembers?: number;
  allowLateJoin?: boolean;
  requireApproval?: boolean;
  expirationMinutes?: number;
  allowSplitBill?: boolean;
  defaultSplitType?: "equal" | "proportional" | "individual" | "custom";
  permissions?: {
    canInviteMembers?: boolean;
    canModifyOthersCart?: boolean;
    canFinalizeOrder?: boolean;
    canSplitBill?: boolean;
    canProcessPayment?: boolean;
  };
  notes?: string | null;
  tableNumber?: string | null;
  /** "dine_in" | "delivery" | "pickup" — defaults to "dine_in" when absent. */
  fulfillmentType?: "dine_in" | "delivery" | "pickup";
  /** Required when fulfillmentType is "delivery". */
  deliveryAddress?: GroupOrderDeliveryAddress;
  /** ISO 8601 datetime. Required when fulfillmentType is "pickup". */
  pickupAt?: string;
  /** Whether the group auto-finalizes on expiry instead of cancelling. Defaults to true. */
  autoSubmitOnExpiry?: boolean;
}
```

This is a pure type change with no runtime code — no test file needed for this step. `pnpm --filter @makanmasak/shared-types typecheck` (or the workspace-wide `pnpm typecheck`) is the verification.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @makanmasak/shared-types typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/schema-json-types.ts
git commit -m "feat(shared-types): add fulfillment/expiry fields to GroupOrderSettings"
```

---

### Task 4: `GroupOrdersService.createGroupOrder` — guest host + recovery code + fulfillment

**Files:**
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts:265-388` (`createGroupOrder`)
- Modify: `apps/api/src/features/group-orders/types/index.ts` (`CreateGroupOrderRequest`, `CreateGroupOrderResponse`)
- Test: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts` (extend existing)

**Interfaces:**
- Consumes: `groupOrders.recoveryCode` column (Task 2), `GroupOrderSettings.fulfillmentType/deliveryAddress/pickupAt/autoSubmitOnExpiry` (Task 3).
- Produces: `createGroupOrder(data: CreateGroupOrderRequest, hostId: string | null): Promise<{ success: boolean; data?: CreateGroupOrderResponse; error?: string }>` — `hostId` is now nullable. `CreateGroupOrderResponse` gains `recoveryCode: string`. Consumed by Task 5's route.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts` (follow that file's existing mock-D1 setup — read its top-of-file `beforeEach`/mock pattern first and match it; the sketch below assumes the existing helper that builds a `GroupOrdersService` against a mocked `this.db`):

```typescript
describe("createGroupOrder — guest host", () => {
  it("creates a group order with hostId = null and returns a recoveryCode", async () => {
    const result = await service.createGroupOrder(
      { restaurantId: "rest-1", hostName: "Alex" },
      null,
    );

    expect(result.success).toBe(true);
    expect(result.data?.recoveryCode).toMatch(/^[0-9a-f-]{36}$/);
    expect(insertGroupOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: null,
        recoveryCode: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    );
  });

  it("defaults expiresAt to 45 minutes out when no expiration is given", async () => {
    const before = Date.now();

    const result = await service.createGroupOrder(
      { restaurantId: "rest-1" },
      null,
    );

    const expiresAtMs = result.data!.expiresAt.getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 44 * 60 * 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(before + 46 * 60 * 1000);
  });

  it("stores fulfillmentType, deliveryAddress and autoSubmitOnExpiry in settings", async () => {
    await service.createGroupOrder(
      {
        restaurantId: "rest-1",
        fulfillmentType: "delivery",
        deliveryAddress: { line1: "1 Example Rd" },
        autoSubmitOnExpiry: false,
      },
      null,
    );

    expect(insertGroupOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          fulfillmentType: "delivery",
          deliveryAddress: { line1: "1 Example Rd" },
          autoSubmitOnExpiry: false,
        }),
      }),
    );
  });

  it("still accepts a staff hostId unchanged (existing behavior)", async () => {
    const result = await service.createGroupOrder(
      { restaurantId: "rest-1" },
      "user-42",
    );

    expect(insertGroupOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "user-42" }),
    );
    expect(result.success).toBe(true);
  });
});
```

(If the existing test file doesn't already expose an `insertGroupOrdersMock`-style spy on the Drizzle insert call, add one following the same mocking approach the file already uses for `listGroupOrders`/`joinGroup` tests — do not introduce a second, different mocking style in the same file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts -t "guest host"`
Expected: FAIL — `hostId` is typed as `string` (not nullable) so this won't even compile yet; `recoveryCode` isn't generated; the 24-hour default and lack of settings fields also fail the other assertions.

- [ ] **Step 3: Implement**

In `apps/api/src/features/group-orders/types/index.ts`, extend the request/response:

```typescript
export interface CreateGroupOrderRequest {
  restaurantId: string;
  tableId?: number;
  expirationHours?: number;
  expirationMinutes?: number;
  maxMembers?: number;
  expectedMembers?: number;
  hostName?: string;
  notes?: string;
  tableNumber?: string;
  permissions?: Partial<GroupOrderPermissions>;
  fulfillmentType?: "dine_in" | "delivery" | "pickup";
  deliveryAddress?: {
    line1: string;
    line2?: string;
    contactPhone?: string;
    notes?: string;
  };
  pickupAt?: string;
  autoSubmitOnExpiry?: boolean;
}

export interface CreateGroupOrderResponse {
  groupOrderId: string;
  shareCode: string;
  expiresAt: Date;
  host: GroupOrderMember;
  memberToken: string;
  /**
   * Host-only device-recovery secret. Returned exactly once, at creation —
   * never surfaced again by any other endpoint. See
   * GroupOrdersService.recoverHost.
   */
  recoveryCode: string;
}
```

In `apps/api/src/features/group-orders/services/GroupOrdersService.ts`, replace the `createGroupOrder` signature and body (lines 265-388):

```typescript
  async createGroupOrder(
    data: CreateGroupOrderRequest,
    hostId: string | null,
  ): Promise<{
    success: boolean;
    data?: CreateGroupOrderResponse;
    error?: string;
  }> {
    const timer = this.performance.startTimer("createGroupOrder");

    try {
      this.logger.info("Creating group order", {
        restaurantId: data.restaurantId,
        hostId,
      });

      const groupOrderId = randomUUID();
      const shareCode = this.generateShareCode();
      const recoveryCode = randomUUID();

      const expirationSeconds = data.expirationMinutes
        ? data.expirationMinutes * 60
        : (data.expirationHours ?? 45 / 60) * 3600;
      const expiresAt = Math.floor(Date.now() / 1000) + expirationSeconds;

      const defaultPermissions = {
        ...DEFAULT_GROUP_ORDER_PERMISSIONS,
        ...data.permissions,
      };

      const effectiveMaxMembers = data.maxMembers || data.expectedMembers || 30;

      const now = new Date();

      await this.db.insert(groupOrders).values({
        id: groupOrderId,
        restaurantId: data.restaurantId,
        tableId: data.tableId || null,
        shareCode,
        createdBy: hostId,
        recoveryCode,
        status: "active",
        expiresAt: new Date(expiresAt * 1000),
        settings: {
          maxMembers: effectiveMaxMembers,
          permissions: defaultPermissions,
          notes: data.notes || null,
          tableNumber: data.tableNumber || null,
          fulfillmentType: data.fulfillmentType || "dine_in",
          deliveryAddress: data.deliveryAddress,
          pickupAt: data.pickupAt,
          autoSubmitOnExpiry: data.autoSubmitOnExpiry ?? true,
        },
        totalAmountCents: 0,
        taxAmountCents: 0,
        serviceChargeCents: 0,
        finalAmountCents: 0,
        createdAt: now,
        updatedAt: now,
      });

      const hostMemberId = randomUUID();
      const sessionId = randomUUID();
      await this.db.insert(groupMembers).values({
        id: hostMemberId,
        groupOrderId: groupOrderId,
        sessionId,
        name: data.hostName || "Host",
        role: "creator",
        joinedAt: now,
        lastActiveAt: now,
        isActive: true,
      });

      await this.logActivity(
        groupOrderId,
        hostMemberId,
        "group_created",
        "Group order created",
        {
          shareCode,
          expiresAt,
          maxMembers: effectiveMaxMembers,
        },
      );

      const hostMemberRows = await this.db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.id, hostMemberId));

      const hostMember = hostMemberRows[0];

      const response: CreateGroupOrderResponse = {
        groupOrderId,
        shareCode,
        expiresAt: new Date(expiresAt * 1000),
        host: this.formatMember(hostMember),
        memberToken: sessionId,
        recoveryCode,
      };

      const { memberToken: _hostToken, recoveryCode: _recovery, ...cacheableResponse } =
        response;
      await this.cache.set(
        `group_order:${groupOrderId}`,
        cacheableResponse,
        3600,
      );
      await this.cache.set(`share_code:${shareCode}`, groupOrderId, 3600);

      this.logger.info("Group order created successfully", {
        groupOrderId,
        shareCode,
      });
      return { success: true, data: response };
    } catch (error) {
      this.errorTracker.logError("createGroupOrder", error as Error, {
        data,
        hostId,
      });
      this.logger.error("Failed to create group order", error);
      return { success: false, error: "Failed to create group order" };
    } finally {
      this.performance.endTimer(timer);
    }
  }
```

Note the cache-scrubbing destructure now also strips `recoveryCode`, for the same reason the existing code already strips `memberToken` — neither secret belongs in a shared cache entry.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts`
Expected: PASS (new tests and all pre-existing ones in the file)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @makanmasak/api typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/types/index.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts
git commit -m "feat(api): support guest hosts, recovery codes and fulfillment settings in createGroupOrder"
```

---

### Task 5: `POST /orders/group/create` — allow guest hosts

**Files:**
- Modify: `apps/api/src/features/group-orders/routes/index.ts:206-244`
- Modify: `apps/api/src/features/group-orders/schemas/validation.ts:19-53` (`createGroupOrderSchema`)
- Test: `apps/api/src/features/group-orders/routes/index.test.ts` (extend existing), `apps/api/src/features/group-orders/routes/anonymous-access.test.ts` (extend existing)

**Interfaces:**
- Consumes: `moduleGate` fallback param (Task 1), `createGroupOrder(data, hostId: string | null)` (Task 4), `optionalAuth` from `apps/api/src/middleware/auth.ts`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/features/group-orders/routes/anonymous-access.test.ts` (extend the existing mock setup in that file — it already mocks `GroupOrdersService` and `RealtimeBroadcastService`; add `createGroupOrder` to the hoisted mocks alongside the existing `joinGroup`):

```typescript
it("allows an anonymous guest to create a group order without a JWT", async () => {
  groupServiceMocks.createGroupOrder.mockResolvedValue({
    success: true,
    data: {
      groupOrderId: "go-1",
      shareCode: "ABC12345",
      expiresAt: new Date(),
      host: { id: "m-1", memberName: "Guest Host" },
      memberToken: "session-1",
      recoveryCode: "recovery-1",
    },
  });

  const response = await buildApp().fetch(
    new Request("https://test/orders/group/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ restaurantId: "rest-1", hostName: "Guest Host" }),
    }),
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ success: true });
  expect(groupServiceMocks.createGroupOrder).toHaveBeenCalledWith(
    expect.objectContaining({ restaurantId: "rest-1" }),
    null,
  );
});
```

(This requires updating `buildApp()`'s route mount in that file to include `createGroupOrder` in the hoisted `groupServiceMocks`, and adjusting the `vi.mock("../services/GroupOrdersService", ...)` factory to return it — mirror exactly how `joinGroup` is already wired.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/routes/anonymous-access.test.ts`
Expected: FAIL — `POST /create` currently 401s with no JWT (`authMiddleware` + `requireRole` reject it before reaching the handler).

- [ ] **Step 3: Update the validation schema**

In `apps/api/src/features/group-orders/schemas/validation.ts`, replace `createGroupOrderSchema` (lines 19-53):

```typescript
export const createGroupOrderSchema = z
  .object({
    restaurantId: z
      .union([z.string(), z.number()])
      .transform((val) => String(val)),
    tableId: z
      .number()
      .int()
      .positive("Table ID must be a positive integer")
      .optional(),
    tableNumber: z.string().optional(),
    hostName: z.string().max(50).optional(),
    expectedMembers: z.number().int().min(2).max(30).optional(),
    notes: notesSchema(500).optional(),
    expirationHours: z
      .number()
      .min(1, "Expiration hours must be at least 1 hour")
      .max(168, "Expiration hours cannot exceed 7 days (168 hours)")
      .optional(),
    expirationMinutes: z
      .number()
      .min(5, "Expiration must be at least 5 minutes")
      .max(180, "Expiration cannot exceed 180 minutes")
      .optional(),
    maxMembers: z
      .number()
      .min(2, "Maximum members must be at least 2")
      .max(30, "Maximum members cannot exceed 30")
      .optional(),
    permissions: z
      .object({
        canInviteMembers: z.boolean().optional(),
        canModifyOthersCart: z.boolean().optional(),
        canFinalizeOrder: z.boolean().optional(),
        canSplitBill: z.boolean().optional(),
        canProcessPayment: z.boolean().optional(),
      })
      .optional(),
    fulfillmentType: z.enum(["dine_in", "delivery", "pickup"]).optional(),
    deliveryAddress: z
      .object({
        line1: z.string().min(1).max(200),
        line2: z.string().max(200).optional(),
        contactPhone: z.string().max(20).optional(),
        notes: notesSchema(300).optional(),
      })
      .optional(),
    pickupAt: z.iso.datetime().optional(),
    autoSubmitOnExpiry: z.boolean().optional(),
  })
  .refine(
    (data) => data.fulfillmentType !== "delivery" || !!data.deliveryAddress,
    {
      message: "deliveryAddress is required when fulfillmentType is delivery",
      path: ["deliveryAddress"],
    },
  )
  .refine((data) => data.fulfillmentType !== "pickup" || !!data.pickupAt, {
    message: "pickupAt is required when fulfillmentType is pickup",
    path: ["pickupAt"],
  });
```

(Removing the old `.optional().default(24)` on `expirationHours` and `.optional().default(8)` on `maxMembers` is intentional — the 45-minute/30-member defaults now live in the service per Task 4, so an omitted field must stay `undefined`, not get silently defaulted here.)

- [ ] **Step 4: Update the route**

In `apps/api/src/features/group-orders/routes/index.ts`, replace the `/create` route registration (lines 206-212):

```typescript
app.post(
  "/create",
  optionalAuth,
  moduleGate("online_ordering", async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const restaurantId = body?.restaurantId;
    return typeof restaurantId === "string" || typeof restaurantId === "number"
      ? String(restaurantId)
      : undefined;
  }),
  quotaGate("orders.created"),
  validateBody(groupOrderSchemas.createGroupOrder),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.createGroupOrder(
      data,
      user?.id ?? null,
    );
```

(the rest of the handler body — `meterEmit`, `broadcastGroupOrderEvent`, the `c.json` response — is unchanged) and add `optionalAuth` to the existing import from `"../../../middleware/auth"`:

```typescript
import { authMiddleware, requireRole, optionalAuth } from "../../../middleware/auth";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/routes`
Expected: PASS — including the pre-existing `index.test.ts` cases for `/create`, which now need their mocked auth layer adjusted from a required-JWT expectation to an `optionalAuth`-compatible one (update those fixtures to either supply a staff JWT and assert `createGroupOrder` is called with that user's id, or omit it and assert `null` — do not delete existing staff-hosted coverage, add the guest case alongside it).

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm --filter @makanmasak/api typecheck && pnpm --filter @makanmasak/api lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/group-orders/routes/index.ts \
  apps/api/src/features/group-orders/schemas/validation.ts \
  apps/api/src/features/group-orders/routes/index.test.ts \
  apps/api/src/features/group-orders/routes/anonymous-access.test.ts
git commit -m "feat(api): allow guest hosts to create group orders"
```

---

### Task 6: Join preview — `GET /orders/group/join/:shareCode`

**Files:**
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts` (add `previewGroupByShareCode`, near `joinGroup` at line 393)
- Modify: `apps/api/src/features/group-orders/routes/index.ts` (add route, before the existing `POST /join/:shareCode` at line 250)
- Test: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`, `apps/api/src/features/group-orders/routes/anonymous-access.test.ts`

**Interfaces:**
- Produces: `previewGroupByShareCode(shareCode: string): Promise<{ found: boolean; data?: GroupOrderJoinPreview }>` where `GroupOrderJoinPreview = { groupOrderId: string; restaurantId: string; hostName: string; memberCount: number; fulfillmentType: "dine_in" | "delivery" | "pickup"; expiresAt: Date; status: string }`. No side effects — does not create a member, does not touch the cache written by `joinGroup`.

- [ ] **Step 1: Write the failing tests**

Service test, in `GroupOrdersService.test.ts`:

```typescript
describe("previewGroupByShareCode", () => {
  it("returns preview data without creating a member", async () => {
    // arrange a mocked select returning one active, unexpired group order
    // and one creator-role member named "Alex" for that groupOrderId
    const result = await service.previewGroupByShareCode("ABC12345");

    expect(result).toEqual({
      found: true,
      data: expect.objectContaining({
        hostName: "Alex",
        memberCount: 1,
        fulfillmentType: "dine_in",
      }),
    });
    expect(insertGroupMembersMock).not.toHaveBeenCalled();
  });

  it("returns found: false for an unknown or expired share code", async () => {
    const result = await service.previewGroupByShareCode("NOPE0000");
    expect(result).toEqual({ found: false });
  });
});
```

Route test, in `anonymous-access.test.ts`:

```typescript
it("returns a join preview without a JWT and without joining", async () => {
  groupServiceMocks.previewGroupByShareCode.mockResolvedValue({
    found: true,
    data: {
      groupOrderId: "go-1",
      restaurantId: "r-1",
      hostName: "Alex",
      memberCount: 2,
      fulfillmentType: "dine_in",
      expiresAt: new Date(),
      status: "active",
    },
  });

  const response = await buildApp().fetch(
    new Request("https://test/orders/group/join/ABC12345", { method: "GET" }),
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    success: true,
    data: { hostName: "Alex", memberCount: 2 },
  });
  expect(groupServiceMocks.joinGroup).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders -t "preview"`
Expected: FAIL — `previewGroupByShareCode` doesn't exist yet; `GET /join/:shareCode` isn't a registered route (only `POST /join/:shareCode` exists).

- [ ] **Step 3: Implement the service method**

Add to `GroupOrdersService.ts`, near `joinGroup`:

```typescript
  async previewGroupByShareCode(
    shareCode: string,
  ): Promise<{ found: boolean; data?: GroupOrderJoinPreview }> {
    const groupOrderRows = await this.db
      .select()
      .from(groupOrders)
      .where(
        and(
          eq(groupOrders.shareCode, shareCode),
          eq(groupOrders.status, "active"),
          gte(groupOrders.expiresAt, new Date()),
        ),
      );

    const groupOrder = groupOrderRows[0];
    if (!groupOrder) {
      return { found: false };
    }

    const memberRows = await this.db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupOrderId, groupOrder.id),
          isNull(groupMembers.leftAt),
        ),
      );

    const host = memberRows.find((m) => m.role === "creator");
    const settings = (groupOrder.settings || {}) as GroupOrderSettings;

    return {
      found: true,
      data: {
        groupOrderId: groupOrder.id,
        restaurantId: groupOrder.restaurantId,
        hostName: host?.name || "Host",
        memberCount: memberRows.length,
        fulfillmentType: settings.fulfillmentType || "dine_in",
        expiresAt: groupOrder.expiresAt,
        status: groupOrder.status,
      },
    };
  }
```

Add `GroupOrderJoinPreview` to `apps/api/src/features/group-orders/types/index.ts`:

```typescript
export interface GroupOrderJoinPreview {
  groupOrderId: string;
  restaurantId: string;
  hostName: string;
  memberCount: number;
  fulfillmentType: "dine_in" | "delivery" | "pickup";
  expiresAt: Date;
  status: string;
}
```

- [ ] **Step 4: Implement the route**

In `apps/api/src/features/group-orders/routes/index.ts`, add before the existing `POST /join/:shareCode`:

```typescript
/**
 * Preview a group order before joining (no side effects)
 * GET /api/v1/orders/group/join/{shareCode}
 */
app.get(
  "/join/:shareCode",
  validateParams(groupOrderSchemas.shareCodeParam),
  async (c) => {
    const { shareCode } = c.get("validatedParams");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.previewGroupByShareCode(shareCode);

    if (!result.found) {
      throw notFound("Group order not found or expired", "GROUP_ORDER_NOT_FOUND");
    }

    return c.json({ success: true, data: result.data });
  },
);
```

(Hono matches `GET`/`POST` on the same path independently, so this doesn't conflict with the existing `POST /join/:shareCode` below it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @makanmasak/api typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/types/index.ts \
  apps/api/src/features/group-orders/routes/index.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts \
  apps/api/src/features/group-orders/routes/anonymous-access.test.ts
git commit -m "feat(api): add side-effect-free group order join preview"
```

---

### Task 7: Host recovery — `POST /orders/group/:groupOrderId/recover`

**Files:**
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts` (add `recoverHost`)
- Modify: `apps/api/src/features/group-orders/schemas/validation.ts` (add `recoverHostSchema`)
- Modify: `apps/api/src/features/group-orders/routes/index.ts` (add route, near the end, after `/leave/:memberId`)
- Test: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`, `apps/api/src/features/group-orders/routes/anonymous-access.test.ts`

**Interfaces:**
- Consumes: `groupOrders.recoveryCode` (Task 2), `strictRateLimit` from `apps/api/src/middleware/rateLimit.ts`.
- Produces: `recoverHost(groupOrderId: string, recoveryCode: string): Promise<{ success: boolean; data?: { memberToken: string }; error?: string }>` — rebinds the creator `group_members` row to a new `sessionId` and returns it as the new host credential.

- [ ] **Step 1: Write the failing tests**

Service test:

```typescript
describe("recoverHost", () => {
  it("issues a new memberToken for the creator when the recovery code matches", async () => {
    // arrange a mocked group_orders row with recoveryCode "correct-code"
    // and a groupMembers creator row for that groupOrderId
    const result = await service.recoverHost("go-1", "correct-code");

    expect(result.success).toBe(true);
    expect(result.data?.memberToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(updateGroupMembersMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: result.data?.memberToken }),
    );
  });

  it("fails without revealing whether the group order exists, on a wrong code", async () => {
    const result = await service.recoverHost("go-1", "wrong-code");
    expect(result).toEqual({ success: false, error: "Invalid recovery code" });
  });

  it("fails the same way when the group order doesn't exist", async () => {
    const result = await service.recoverHost("does-not-exist", "any-code");
    expect(result).toEqual({ success: false, error: "Invalid recovery code" });
  });
});
```

Route test, in `anonymous-access.test.ts`:

```typescript
it("allows anonymous host recovery without a JWT", async () => {
  groupServiceMocks.recoverHost.mockResolvedValue({
    success: true,
    data: { memberToken: "new-session-1" },
  });

  const response = await buildApp().fetch(
    new Request("https://test/orders/group/go-1/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryCode: "correct-code" }),
    }),
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    success: true,
    data: { memberToken: "new-session-1" },
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders -t "recover"`
Expected: FAIL — `recoverHost` doesn't exist; the route isn't registered.

- [ ] **Step 3: Implement the service method**

Add to `GroupOrdersService.ts`, near `joinGroup`:

```typescript
  async recoverHost(
    groupOrderId: string,
    recoveryCode: string,
  ): Promise<{ success: boolean; data?: { memberToken: string }; error?: string }> {
    try {
      const groupOrderRows = await this.db
        .select()
        .from(groupOrders)
        .where(
          and(
            eq(groupOrders.id, groupOrderId),
            eq(groupOrders.recoveryCode, recoveryCode),
          ),
        );

      const groupOrder = groupOrderRows[0];
      // Deliberately identical error for "wrong code" and "no such group
      // order" — a distinguishing message would let an attacker enumerate
      // valid group order ids.
      if (!groupOrder) {
        return { success: false, error: "Invalid recovery code" };
      }

      const creatorRows = await this.db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupOrderId, groupOrderId),
            eq(groupMembers.role, "creator"),
          ),
        );

      const creator = creatorRows[0];
      if (!creator) {
        return { success: false, error: "Invalid recovery code" };
      }

      const newSessionId = randomUUID();
      await this.db
        .update(groupMembers)
        .set({ sessionId: newSessionId, lastActiveAt: new Date() })
        .where(eq(groupMembers.id, creator.id));

      await this.logActivity(
        groupOrderId,
        creator.id,
        "member_joined",
        "Host reconnected from a new device",
        { recovered: true },
      );

      return { success: true, data: { memberToken: newSessionId } };
    } catch (error) {
      this.errorTracker.logError("recoverHost", error as Error, {
        groupOrderId,
      });
      return { success: false, error: "Failed to recover host session" };
    }
  }
```

- [ ] **Step 4: Add the validation schema**

In `validation.ts`:

```typescript
export const recoverHostSchema = z.object({
  recoveryCode: z.string().min(1, "Recovery code is required").max(100),
});
```

Add it to `groupOrderSchemas`: `recoverHost: recoverHostSchema,`.

- [ ] **Step 5: Implement the route**

In `routes/index.ts`, add near the end (after the `/leave/:memberId` route), and import `strictRateLimit`:

```typescript
import { strictRateLimit } from "../../../middleware/rateLimit";
```

```typescript
/**
 * Recover host control of a group order using the recovery code
 * POST /api/v1/orders/group/{groupOrderId}/recover
 */
app.post(
  "/:groupOrderId/recover",
  strictRateLimit,
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateBody(groupOrderSchemas.recoverHost),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");
    const { recoveryCode } = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.recoverHost(groupOrderId, recoveryCode);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to recover host session");
    }

    return c.json({ success: true, data: result.data });
  },
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders`
Expected: PASS

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm --filter @makanmasak/api typecheck && pnpm --filter @makanmasak/api lint`
Expected: PASS

- [ ] **Step 8: Run the full API test suite once for this phase**

Run: `pnpm --filter @makanmasak/api test`
Expected: PASS — this is the final task of Phase A; confirm no regressions anywhere else in the API package before moving to Phase B.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/schemas/validation.ts \
  apps/api/src/features/group-orders/routes/index.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts \
  apps/api/src/features/group-orders/routes/anonymous-access.test.ts
git commit -m "feat(api): add rate-limited host recovery endpoint for group orders"
```

---

## Self-review notes

- **Spec coverage:** this phase covers spec decisions 1 (dynamic size / 30 cap — done via `maxMembers` bump, enforced by the pre-existing `joinGroup` check, unchanged), 2 (guest host/member — Tasks 1, 4, 5), 3 (host recovery — Tasks 2, 7), 4 (join via `shareCode`, preview screen before joining — Task 6), 7 (45-minute default, `autoSubmitOnExpiry` toggle stored — Tasks 3, 4). Decisions 5, 6, 8, 9 (split billing, finalize/checkout, atomicity) are explicitly out of scope for Phase A and belong to the later phases (cart collaboration/realtime, finalize/checkout, split billing) agreed with the user.
- **Placeholder scan:** no TBD/TODO; Task 2's Step 3 intentionally defers the *exact* legacy-track column list to a live read at implementation time rather than guessing it here, because guessing risks writing incorrect SQL against a track this plan did not directly inspect — that's a scoped verification instruction, not an unresolved design question.
- **Type consistency:** `CreateGroupOrderRequest`/`CreateGroupOrderResponse` (Task 4) are the exact shapes Task 5's route and Task 6/7's new methods build on; `GroupOrderJoinPreview` and `recoverHost`'s return shape are each defined once and used identically in their route + test.
