# Spec: Group Ordering (多人合併點餐) — Design

## Objective

Let **3–30 people** (dynamic, no fixed size — e.g. an office of any headcount)
each browse the same restaurant's menu on their own device, add their own
items to a **shared cart**, and have one person (the **host**) merge
everyone's selections into **one single order** submitted to the restaurant —
instead of N separate orders. Must work for both:

- **`dine_in`** — a physical table (reuses existing seat/table QR flow).
- **`delivery` / `pickup`** — a remote group (e.g. an office) with no physical
  table, needing a delivery address or pickup time.

Split billing (calculate each member's share) ships in this iteration.
Online payment capture is explicitly deferred but the data model must not
need reshaping to add it later.

## Current state (ground truth)

A `group_orders` schema already exists
(`packages/database/src/schema/group-orders.ts`): `group_orders`,
`group_members`, `group_cart_items`, `split_bills`, `share_codes`,
`group_activity_logs`. The design of these tables is largely correct and
reusable, but **nothing in the codebase actually wires it up**:

- `group_orders.masterOrderId` is documented as "created at final checkout"
  but is only ever initialized to `null` (`GroupOrdersService.ts:143,235`) —
  no code path ever creates a real `orders`/`order_items` row from a group
  order's cart.
- `group_orders.createdBy` is `NOT NULL → users.id` — a group order cannot
  be hosted by a guest today.
- No `dine_in` vs `delivery`/`pickup` distinction exists.
- Frontend scaffolding (`apps/customer-app/src/composables/useGroupOrder.ts`,
  `components/group/GroupCartPanel.vue`) exists but is **unreachable** (no
  router entry) and calls API routes that don't exist
  (`/group-orders/{id}/submit` 404s — the feature mounts at
  `/api/v1/orders/group` with no `/submit` route).
- The real kitchen pipeline (`orders`, `OrdersView.vue`, seat QR flow via
  `seats.currentOrderId`) has zero awareness of group orders — each seat/QR
  session independently creates and submits its own order.
- `apps/realtime` already has a Durable Object room keyed
  `customer:{groupOrderId}` (`RealtimeSession.ts:190-227,798-815`), unused by
  anything live today.

**Decision: extend and repair this scaffold rather than rebuild.** The
schema direction is right (`split_bills` already has `paymentMethod` /
`paymentReference`, anticipating future online payment) and the realtime
channel already exists. The gap is host identity, fulfillment branching, and
the finalize glue — not the overall shape.

## Locked decisions (surfaced assumptions — object now if wrong)

1. **Dynamic group size, soft cap 30.** No fixed headcount; enforced as a
   best-effort check at join time (`COUNT(active members) < maxMembers`), not
   a hard distributed lock — acceptable at this scale.
2. **Host and members can both be guests.** No account required to open or
   join a group order (matches existing seat/QR guest ordering pattern).
   Registered users may still join/host using their account.
3. **Host recovery via a separate secret**, not account login. Host control
   is bound to a local `creatorSessionId`; if lost, a distinct
   `recoveryCode` (shown once, only to the host) can reclaim host control on
   any device. If both the device session *and* the recovery code are lost,
   there is no self-service recovery — acceptable given the 45-minute session
   lifespan and guest-only identity.
4. **Join is one `shareCode`, two entry points**, not two separate secrets:
   a deep-link URL (`/join/:shareCode`) for one-tap sharing (chat apps,
   QR-encoded for table/screen display) and the same code shown as plain
   text for manual/verbal entry. Opening the URL lands on a join **preview**
   screen (restaurant, host, member count, fulfillment type, time left) with
   an explicit "加入點餐" confirm — never silently drops the visitor into the
   shared cart.
5. **Split billing = calculate + display only (Plan A) this iteration.**
   `split_bills.paymentStatus` starts `pending`; settlement happens outside
   the app (cash/existing in-person payment) and is marked `paid` manually by
   host/cashier. Online capture (Plan B) is future work and requires **no
   schema change** — `paymentMethod`/`paymentReference` already exist for it.
6. **Two split strategies implemented now**: `equal` (bill ÷ active member
   count, remainder cents assigned to host) and `proportional` (shared
   costs — tax/service/delivery fee — prorated by each member's item
   subtotal). The schema's `individual`/`custom` enum values stay reserved,
   unimplemented, until there's a concrete need.
7. **45-minute session timeout, host-configurable auto-submit.** At
   creation the host toggles `autoSubmitOnExpiry` (default on). On expiry: if
   on and the cart is non-empty, auto-run the same finalize path as a manual
   host lock; otherwise transition to `cancelled` with no order created. A
   reminder broadcasts 5 minutes before expiry.
8. **Finalize is atomic via `db.batch()`, not `db.transaction()`.** D1
   doesn't support Drizzle's `db.transaction()` (see
   `[[backend_rust_refactor_docs]]`); the order+order_items+masterOrderId
   write is one `db.batch()` call. Finalize is also idempotent — if
   `masterOrderId` is already set, return the existing result rather than
   double-booking (guards against the cron sweep and a manual host lock
   racing each other).
9. **Do not reuse the generic `share_codes` table.** It appears intended for
   other resource types (table/event) and isn't wired to anything currently;
   `group_orders.shareCode` is sufficient on its own. Left untouched.

## Data model changes

`group_orders` — new/changed columns:

| Column | Change | Purpose |
|---|---|---|
| `createdBy` | now nullable | guest hosts |
| `creatorSessionId` (new) | text, not null | guest host's device/session id, same pattern as `group_members.sessionId` |
| `recoveryCode` (new) | text, unique, not null | host-only secret for device recovery — never included in the shared URL/QR |
| `fulfillmentType` (new) | text, not null, default `'dine_in'` | `dine_in` \| `delivery` \| `pickup` |
| `deliveryAddress` (new) | json, nullable | `delivery` only |
| `pickupAt` (new) | timestamp_ms, nullable | `pickup` only |
| `deliveryFeeCents` (new) | integer, nullable | prorated per `splitType` |
| `maxMembers` (new) | integer, not null, default `30` | soft cap |

`group_members`, `group_cart_items`, `split_bills`, `group_activity_logs`:
**no schema change.** `group_members.userId`/`sessionId` already support
guests; the host is inserted as a `group_members` row with `role: 'creator'`
so their own cart items get the same attribution as everyone else's.

Migration: hand-written sequential SQL in `migrations_fresh` (next free
number) per `[[db_migration_workflow]]`, paired in `migrations/` and
registered in `migration-dual-track.json`. Additive only.

## API

Public (customer, guest-capable):

- `POST /api/v1/group-orders` — host creates a group order. Body:
  `restaurantId`, `fulfillmentType` (+ `tableId` / `deliveryAddress` /
  `pickupAt` as applicable), `splitType`, `autoSubmitOnExpiry`, host
  `name`. Returns `shareCode` (+ QR via existing
  `POST /api/v1/qr/generate`), `recoveryCode` (shown once), `creatorSessionId`.
- `GET /api/v1/group-orders/join/:shareCode` — join **preview** (restaurant,
  host name, member count, fulfillment type, `expiresAt`). No side effects.
- `POST /api/v1/group-orders/join/:shareCode` — actually join. Body: `name`
  (guest) or authenticated user context. Rejects with `GROUP_ORDER_FULL` at
  `maxMembers`, or `GROUP_ORDER_EXPIRED`/`GROUP_ORDER_LOCKED` if not joinable.
- `GET /api/v1/group-orders/:id` — current state (members + cart items),
  scoped to the caller's session/user.
- `POST /api/v1/group-orders/:id/cart-items`,
  `PATCH .../cart-items/:itemId`, `DELETE .../cart-items/:itemId` — add/edit
  own items; host may `DELETE` any member's item.
- `POST /api/v1/group-orders/:id/lock` — host locks + finalizes (see below).
- `POST /api/v1/group-orders/:id/recover` — reclaim host control via
  `recoveryCode`; rebinds `creatorSessionId` to the calling device.
- `GET /api/v1/group-orders/:id/split-bills` — caller sees own share; host
  sees all.
- `POST /api/v1/group-orders/:id/split-bills/:memberId/mark-paid` — host/staff
  marks a member's share settled (Plan A).

Realtime (`customer:{groupOrderId}` DO room, already exists — wire it up):
broadcast `member_joined`, `item_added|updated|removed`, `locked`,
`expiring_soon`, `finalized`, `cancelled`. Realtime is enhancement only — all
writes land in D1 first; a dropped WebSocket is recovered by client refetch,
never by blocking the write.

Cron: extend the existing scheduled-worker pattern
(`apps/backup-scheduler` sibling, or a new trigger) to sweep
`group_orders` where `expiresAt` has passed and `status = 'active'`, firing
the 5-minute-out warning and then the expiry transition described in
decision 7.

## Finalize (lock → order) flow

Triggered by either a host `POST .../lock` or the cron expiry sweep — same
code path either way:

1. Atomically claim the lock: `UPDATE group_orders SET status = 'checkout' WHERE id = ? AND status = 'active'`. If zero rows affected, someone else already triggered it — return the existing result (idempotent, decision 8).
2. Reject if the cart is empty (manual lock) or transition straight to `cancelled` (expiry with empty cart).
3. Aggregate `group_cart_items` by `menuItemId`, preserving each item's `memberId` for split-bill attribution.
4. One `db.batch()`: insert `orders` + `order_items` (with `tableId` for `dine_in`, or `deliveryAddress`/`pickupAt`/`deliveryFeeCents` for `delivery`/`pickup`), then update `group_orders.masterOrderId` + `status = 'completed'`.
5. Compute `split_bills` rows per active member per decision 6, then broadcast `finalized`.

From here, `dine_in` orders flow through the existing kitchen pipeline
(`orders`, `OrdersView.vue`) exactly like any other order — the restaurant
sees one ticket, with no awareness that it came from a merged group cart.

## Split billing

Each `split_bills` row gets `subtotalCents` (that member's own items),
prorated `taxAmountCents`/`serviceChargeCents`/discounts per `splitType`,
and `totalAmountCents`. `items` (json) stores the itemized breakdown so a
member's own device can show *why* they owe that amount. Rounding remainders
from `equal` splits are assigned to the host so the sum always equals the
order total exactly.

## Verification

- Unit: split calculation (`equal`/`proportional` + rounding remainder),
  local builders (`buildGroupOrder(overrides)` etc.), no
  `@makanmakan/testing-utils` import.
- Service-level: mock D1, assert `db.batch()` is called with the expected
  set of writes (not just the return value) for finalize.
- Real-D1 integration: finalize is atomic (partial failure leaves no rows)
  and idempotent (second finalize call on an already-completed group order
  doesn't create a second `orders` row); join rejects at `maxMembers`;
  expiry sweep transitions correctly for empty vs non-empty carts.
- API contract: `pnpm contract:check`/`contract:update` for the new/changed
  `group-orders` routes.
- Frontend: repair and test `useGroupOrder.ts`/`GroupCartPanel.vue` — join
  flow, realtime cart updates, host lock/submit state — via `data-testid`/
  text assertions, not CSS classes.
- Manual QA: ≥3 browser tabs as members + 1 as host — create, join via
  link, concurrent adds, lock, verify per-member split amounts.

## Boundaries

- Never: require an account to host or join.
- Never: block a cart write on realtime broadcast success.
- Never: use `db.transaction()` for finalize (unsupported on D1).
- Ask first: implementing `individual`/`custom` split strategies, online
  payment capture (Plan B), staff-assignment-style features borrowed from
  other modules.

## Out of scope (this iteration)

- Online payment capture (Plan B) — schema supports it, logic deferred.
- `individual`/`custom` split strategies.
- Cross-device host handoff *without* the recovery code.
- Changing table/fulfillment type after a group order is created.
- Admin-side UI for viewing group orders as anything other than the
  resulting merged order (they already appear identically to normal orders
  once finalized).

## Still open

1. Exact cron sweep interval (every 1 min vs 5 min) — an implementation
   detail, not a design blocker.
2. Whether `service crew`/`cashier` roles (not just the host) should be able
   to mark a member's split bill as paid — default to reusing the existing
   role matrix unless told otherwise.
