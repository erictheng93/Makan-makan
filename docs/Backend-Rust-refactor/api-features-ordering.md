# `apps/api` Ordering & Front-of-House Feature Modules — Rust Rewrite Reference

Source reviewed: all non-test `.ts` files under `apps/api/src/features/{orders,group-orders,guest-orders,kitchen,pos,queue,waiting-list,reservations,tables,seats}/`, the underlying `packages/database/src/services/{order,WaitingListService,ReservationService,table,seat}.ts` business-logic services those features delegate to, `apps/api/src/app-factory.ts` (mount points/middleware), `apps/api/src/middleware/{auth,guestAuth,moduleGate,quotaGate}.ts`, and `apps/api/src/shared/services/order-identity.ts`. Line numbers cited where useful; `apps/api` and `packages/database` paths below are repo-relative.

**Mount points** (from `apps/api/src/app-factory.ts`; full path = `/api/v1` + prefix below):

| Feature | Mount prefix | Registration section | Blanket middleware applied to prefix |
|---|---|---|---|
| orders | `/orders` | protected | `staffOrUserCustomerAuthMiddleware` (role ≤ 5 JWT) — **also matches `/orders/group/*`, see §2** |
| group-orders | `/orders/group` | protected | inherits the `/orders/*` blanket above (mounted as a sub-path of `/orders`) |
| guest-orders | `/guest-orders` | **public** (registered before the auth blanket middlewares and before the 404 catch-all) | none — auth is per-route KV guest tokens |
| kitchen | `/kitchen` | protected | none (auth handled per-route: `authMiddleware` or `sseAuthMiddleware`) |
| pos | `/pos` | protected | `authMiddleware` + `moduleGate("pos")` |
| queue | `/queue` | **public** section | none — mixed `optionalAuth`/`authMiddleware` per-route |
| waiting-list | `/waiting-list` | **public** section | none at app-factory level; the route file itself applies `app.use("/*", authMiddleware)` + `moduleGate("reservations")` partway through, after 6 explicitly-public routes |
| reservations | `/reservations` | **public** section | same pattern: route file applies `app.use("/*", authMiddleware)` + `moduleGate("reservations")` after 4 public routes |
| tables | `/tables` | protected | none (comment: "Tables routes handle auth at the route level so public QR lookups remain reachable") |
| seats | `/seats` | protected | `authMiddleware` — **this also gates the one route in the seats file that has no per-route `authMiddleware` (`GET /qr/:qrCode`), see §10** |

Global request pipeline (rate limiting, CORS, security headers, edge cache, CSRF, `usageTracker`) is described in `app-factory.ts` and applies uniformly; it is not repeated per-module below except where it changes a specific route's behavior (e.g. SSE endpoints skip the cache middleware).

---

## 1. Orders (`apps/api/src/features/orders/`)

### Purpose

Core order lifecycle for the platform: creation (staff/customer/guest), listing/filtering, status transitions (state machine gated by role), cancellation, bulk operations, coupon preview, receipt generation, and CSV/Excel/PDF export. It is the most heavily depended-upon feature — kitchen, waiting-list (pre-orders), guest-orders, and group-orders all call into `OrdersService`/`OrderService` rather than re-implementing order writes.

### Routes

Mounted at `/api/v1/orders`. All paths below sit behind the blanket `staffOrUserCustomerAuthMiddleware` (JWT, role 0–5) applied to `/orders/*` in `app-factory.ts:390` **in addition to** whatever the route itself declares.

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/v1/orders/guest` | `guestSessionAuth` (KV guest session token) **layered under** the blanket JWT middleware — **effectively unreachable, see note below** | Create a guest order from a pre-issued guest session | `createOrderSchema` body | `{order, guestToken}` |
| GET | `/api/v1/orders/guest/:id` | `guestTokenAuth` **layered under** the blanket JWT middleware — **effectively unreachable** | Guest order status lookup | — | order |
| POST | `/api/v1/orders/preview-coupon` | `customerAuthMiddleware` (0–5) + `moduleGate("online_ordering")` | Dry-run coupon discount calc, no order created | `couponPreviewSchema` | discount preview |
| POST | `/api/v1/orders/batch-sync` | `customerAuthMiddleware` | Compatibility shim: writes an arbitrary client payload to KV (`orders:batch-sync:*`) for offline-queue reconciliation; does **not** touch the orders table | free-form JSON | `{syncId, synced, itemCount}` |
| POST | `/api/v1/orders` | `customerAuthMiddleware` + `moduleGate("online_ordering")` + `quotaGate("orders.created")` | Create order (authenticated customer or staff) | `createOrderSchema` | created order |
| GET | `/api/v1/orders` | `customerAuthMiddleware`, `requireRole([0,1,2,3,4,5])` + `moduleGate` | List/filter orders, role-scoped (customers see own, staff see own restaurant, admin sees all) | `orderFilterSchema` query | `{data, pagination}` |
| GET | `/api/v1/orders/stats` | roles `[0,1]` | Daily order stats for a restaurant | query | `OrderStats` |
| GET | `/api/v1/orders/analytics` | roles `[0,1]` | Analytics (mostly placeholder fields, see §Business logic) | query | `OrderAnalytics` |
| GET | `/api/v1/orders/active` | roles `[0,1,2,3]` | Active orders (`confirmed\|preparing\|ready`) for a restaurant | — | orders[] |
| GET | `/api/v1/orders/:id` | all roles 0–5 | Single order (customer restricted to own `customerId`) | — | order |
| PUT | `/api/v1/orders/:id/status` | roles `[0,1,2,3,4]` | Status transition (see state machine below) | `updateOrderStatusSchema` | updated order |
| DELETE | `/api/v1/orders/:id` | roles `[0,1]` | Cancel order | — | `{message}` |
| POST | `/api/v1/orders/bulk` | roles `[0,1]` | Bulk `update_status`/`cancel` over an order-ID list | `bulkOrderOperationSchema` | `BulkOrderResult` |
| POST | `/api/v1/orders/export` | roles `[0,1]` | CSV/Excel/PDF export | `exportOrdersSchema` | file stream — **`exportOrders` in `OrdersService` is a stub that returns `Buffer.from("")`, see §Business logic** |
| GET | `/api/v1/orders/:id/receipt` | all roles 0–5 + `moduleGate("receipt_printing")` + `quotaGate("print.jobs")` | Generate a receipt payload for an order | — | `OrderReceipt` |

**Finding — `/orders/guest` and `/orders/guest/:id` are unreachable in production.** `app-factory.ts` registers `apiV1.use("/orders/*", staffOrUserCustomerAuthMiddleware)` *before* mounting `ordersFeature.routes`. In Hono, matched middleware/handlers compose in **registration order** (hono-base.js `#addRoute` pushes onto `this.routes` in call order), and here the blanket `.use("/orders/*", …)` at `app-factory.ts:581` is registered *before* the `.route()` mounts at lines 653-655 — so the middleware runs first and 401s the request before the inner guest routes are reached (verified empirically against the installed `hono@4.12.27`). Registration order is the operative mechanism: had the mounts come first, the concrete handlers would win. `staffOrUserCustomerAuthMiddleware` requires a valid signed JWT; a guest session token (`Bearer gt_<hex>`, issued by `guestSessionAuth`/`generateGuestToken()` in `guest-orders`) is not a JWT and fails JWT verification, so the request 401s before Hono ever reaches `guestSessionAuth`/`guestTokenAuth` on the inner route. The only *working* guest-ordering path is the separately-mounted, genuinely-public `/api/v1/guest-orders` feature (§3). Do not port `orders/guest*` as a functioning endpoint in the Rust rewrite without first confirming with product/eng whether it's intentionally dead or a real bug to fix.

### Business logic

`OrdersService` (`apps/api/src/features/orders/services/OrdersService.ts`) is a thin defence-in-depth/caching wrapper around `packages/database/src/services/order.ts::OrderService`, which holds the actual state machine and DB writes.

**Order creation** (`OrderService.createOrder`, `packages/database/src/services/order.ts:373`):
1. Validate restaurant exists and `isAvailable`.
2. If `tableId` given, validate table exists and `isActive` (shop/takeaway orders omit `tableId`).
3. If `waitingListId` given, validate the waiting-list ticket: exists, belongs to restaurant, status is `waiting|called|confirmed`, and `customerPhone` matches — else throws one of `WAITING_LIST_TICKET_NOT_FOUND` / `WAITING_LIST_TICKET_NOT_ACTIVE` / `WAITING_LIST_PHONE_MISMATCH`, which the route layer maps to 404/409/403.
4. `prepareOrderItems`: batch-fetch all referenced menu items, validate `isAvailable`, validate combined per-item quantity against `inventoryCount` (null = unlimited), resolve size/customization/add-on price adjustments against the menu item's catalog `options` JSON (throws on unknown choice IDs, duplicate choices, or add-on quantity over `maxQuantity`), and compute `unitPriceCents`/`totalPriceCents` per line plus `subtotalCents`.
5. Coupon: if `couponCode` present, calls `CouponService.validateCoupon` with subtotal/user/menu items; invalid coupon throws (translated as a plain `Error`, not an `ApiError` — the route layer doesn't special-case a "COUPON_INVALID" code here).
6. Minimum-order check: `restaurant.settings.minOrderAmount` compared against `subtotal - discount` (post-discount, pre-tax).
7. `calculateOrderTotal` (base service helper): `taxAmountCents = round(subtotalCents * taxRate)`, `serviceChargeCents = round(subtotalCents * serviceChargeRate)`, `totalAmountCents = subtotal + tax + serviceCharge - discount`. Rates are fractional (e.g. `0.06`), sourced from `restaurant.settings`.
8. Order number generated (`generateOrderNumber`, not shown above but restaurant-scoped).
9. **Atomic write phase** — D1/Workers has no interactive `BEGIN`, so `db.batch()` is the only atomic-commit primitive: a single batch inserts `orders` (returning the row) + `order_items` (using a `sql` subquery `(SELECT id FROM orders WHERE order_number = ?)` to backfill the order's UUID FK within the same batch, since the insert and the subquery run in one transaction), plus a coupon-usage insert if applicable and a per-item `orderCount + quantity` update and a restaurant `totalOrders + 1` update.
10. **Inventory claim is *outside* the batch**, executed as sequential conditional `UPDATE ... WHERE inventory_count IS NULL OR inventory_count >= quantity RETURNING` per item *before* the batch runs — this is a manual optimistic decrement (not a DB constraint). If any item's claim fails (0 rows returned, meaning insufficient stock), previously-claimed items are restored via reverse-order compensating `UPDATE +quantity`, and the coupon slot (if claimed) is released, then the error is thrown *before* the batch executes. If the batch itself throws (e.g. a `UNIQUE` violation on `client_mutation_id`), the same inventory/coupon restoration runs, then the error propagates.
11. Idempotency: `client_mutation_id` has a DB-level unique constraint per restaurant; a duplicate throws a `UNIQUE constraint failed` error whose message is pattern-matched (`.includes("client_mutation_id")`) and remapped to the sentinel string `"CLIENT_MUTATION_DUPLICATE"`, which `OrdersService.createOrder` catches and re-throws as `conflict()` (409). Message-substring matching is fragile — different D1/SQLite surfaces (local miniflare vs CI wrangler dev) quote the violated column differently, and the code has an explicit comment acknowledging this.
12. Post-write: `OrdersService` fires (all `Promise.all`, not sequenced) — cache the order in KV, log activity (console only, no audit table), broadcast a `NEW_ORDER` realtime event (skipped if `waitingListId` is set — pre-orders don't broadcast until the ticket is seated), and send a restaurant push notification (also skipped for pre-orders).

**Status transitions** (`OrdersService.updateOrderStatus`): validated against two independent tables, both defined in `apps/api/src/features/orders/types/index.ts`:
- `ORDER_STATUS_TRANSITIONS`: `pending→{confirmed,cancelled}`, `confirmed→{preparing,cancelled}`, `preparing→{ready,cancelled}`, `ready→{delivered,cancelled}`, `delivered→{paid,refunded}`, and `paid`/`cancelled`/`refunded` are terminal.
- `ROLE_STATUS_PERMISSIONS`: admin(0) any status; owner(1) `confirmed,cancelled`; chef(2) `preparing,ready`; service(3) `delivered`; cashier(4) `confirmed,paid` (comment notes `paid` was added specifically so cashiers can close orders at the counter for a K6 load-test release gate).
- The DB-layer `updateOrderStatus` (`order.ts:1088`) takes an **optional-CAS** `expectedVersion` — if provided, the `UPDATE` `WHERE` clause also requires `version = expectedVersion`; a 0-row result is translated to `"Order version conflict"` → `conflict()` 409. If `expectedVersion` is omitted, no concurrency check happens at all (route always passes the pre-fetched order's `version`, so CAS is effectively always active from this route, but the service method itself allows bypassing it).
- Reaching `paid` or `delivered` on an order with a `tableId` releases the table (`isOccupied=false`, clears `currentOrderId`/`occupiedAt`/`occupiedBy`) as a side effect of the same DB call.
- After a successful transition, `finalizeOrderStatusSideEffects` (shared with `order-finalization.ts`) invalidates the order's two KV cache keys and broadcasts an `ORDER_STATUS_UPDATE` realtime event, run in parallel (`Promise.all`).
- If the order has a non-`"direct"` `orderSource` (i.e. it came from a delivery platform integration), the route fires an out-of-band `waitUntil`-wrapped call into `PlatformOrderService.syncStatusToPlatform` (lazy `import()`), swallowing errors into a log line — status sync failures never fail the primary request.

**Cancellation** (`OrderService.cancelOrder`, `order.ts:1160`): only `pending`/`confirmed` orders are cancellable (checked both in a pre-read and, atomically, in the `db.batch()` UPDATE's `WHERE status IN (...)` clause plus a `raw SQL EXISTS` subquery guarding the inventory-restore UPDATEs so they only fire if the order row transition actually happened in the same batch). Batch = restore inventory for every line item (`+quantity`, guarded by the `EXISTS` check) + set `orders.status='cancelled'`. If the batch's final `RETURNING` is empty, the whole operation is treated as failed with `"Order cannot be cancelled"` even though individual inventory-restore statements may have silently no-op'd (they're guarded, so this is safe, just worth knowing it's not a single monolithic assertion).

**Bulk operations** (`OrdersService.bulkUpdateOrders`): sequential loop over `orderIds` (no batching/parallelism), each wrapped in its own try/catch so one failure doesn't abort the rest; accumulates per-ID success/failure into `BulkOrderResult`.

**Stubs / incomplete logic worth flagging for the rewrite:**
- `exportOrders` always returns `Buffer.from("")` regardless of filters/format — the export route effectively downloads an empty file today.
- `updatePaymentStatus` is a no-op that re-fetches the order and invalidates cache but never writes payment fields to the DB.
- `getOrderAnalytics` returns a mostly-hardcoded/placeholder structure (`orderCompletionRate: 0.95`, `cancellationRate: 0.05`, etc. are literal constants, not computed).
- `getPopularItems` always returns `[]` (query never implemented, only the KV-cache plumbing exists).
- `subscribeToOrderUpdates` only logs; there is no actual subscription mechanism at this layer (real-time fan-out happens entirely through `RealtimeBroadcastService` → Durable Object, independent of this method).

### Data

- **D1 tables** (via Drizzle schema imports): `orders`, `order_items`, `menu_items`, `restaurants`, `tables`, `waiting_list`, `coupon_usage` (all in `packages/database/src/services/order.ts`).
- **KV (`CACHE_KV`)**: `order:{id}:full` / `order:{id}:basic` (order cache, 5 min TTL), `analytics:{filters-json}` (15 min TTL), `popular-items:{restaurantId}:{range}` (30 min TTL, dead — always empty), `orders:batch-sync:{scope}:{userId}:{syncId|latest}` (30-day TTL, offline-sync compatibility shim), `guest_active:{restaurantId}:{phoneDigits}` / `guest_active_lookup:{orderId}` (cleared on admin cancel — cross-references the guest-orders feature's KV keys).
- **Realtime**: `RealtimeBroadcastService` (from `@makanmakan/database`) broadcasts `NEW_ORDER`, `ORDER_STATUS_UPDATE`, `ORDER_CANCELLED` event types (see `@makanmakan/shared-types` `RealtimeEventType`) to the restaurant's room in the `REALTIME_SESSION` Durable Object.
- **Push**: `RestaurantOrderPushService` (feature `push`) sends a native push notification on new order creation.

### Cross-module dependencies

- `packages/database`: `OrderService` (order.ts), `CouponService`, `RealtimeBroadcastService`.
- `features/push/services/RestaurantOrderPushService`.
- `features/integrations/services/PlatformOrderService` (lazy-imported only on status update for platform-sourced orders).
- `shared/utils/api-error`, `shared/utils/meter` (`meterEmit` for `orders.created`/`print.jobs` usage billing events), `middleware/quotaGate` (`enforceQuota`/`quotaGate`), `middleware/moduleGate` (entitlement checks: `online_ordering`, `analytics`, `receipt_printing`).
- Consumed BY: `kitchen` (reads via `OrdersService.getOrders`/`updateItemStatus`), `guest-orders` (calls `OrdersService.createOrder`/`getOrder`/`addItemsToOrder`/`cancelOrder` directly), `waiting-list`'s underlying `WaitingListService` (calls `OrderService.confirmWaitingListPreOrders`/`cancelWaitingListPreOrders` on seat/cancel/expire).

### Rust rewrite notes

- **Money**: all amounts persisted as integer cents (`*_cents` columns); wire/API contract is decimal float dollars, converted at the boundary via `fromCents`/`toRequiredCents`/`amountFromCents` (`packages/database/src/utils/money.ts`). A Rust port should use an integer (i64) cents type internally end-to-end and only convert to a decimal representation at the JSON boundary — do not carry floats through business logic (the TS code already avoids this, but it's easy to regress).
- **Timestamps**: DB columns are `INTEGER … {mode: 'timestamp_ms'}` (Drizzle hands back `Date` objects); the wire contract is Unix-ms integers. The routes layer has an explicit `serializeOrderForWire`/`toWireTimestamp` pass specifically because `JSON.stringify` on a `Date` silently produces an ISO string, which breaks downstream `Date.now() - createdAt` arithmetic on the client. A Rust port serializing directly from an integer/`i64` column has no equivalent footgun, but must replicate the same wire shape (ms integers, not ISO strings) for API compatibility.
- **JSON columns**: `orders.customerInfo`, `orders.deliveryInfo`, `order_items.customizations`, `order_items.itemSnapshot`, `menu_items.options` (nested customization/add-on catalog) are all JSON columns Drizzle types via `.$type<...>()`. The customization-resolution logic (`resolveCatalogCustomizations`) walks nested JSON to find matching catalog entries and sum price adjustments — this needs a faithful re-implementation, including its specific error cases (unknown choice, duplicate choice/add-on, add-on quantity over max).
- **Concurrency**: order status updates use optimistic concurrency via a `version` integer column + conditional `UPDATE … WHERE version = ?`; order creation's inventory decrement uses the same "conditional UPDATE, check rows affected" pattern rather than DB-level check constraints or `SELECT … FOR UPDATE` (D1/SQLite has no row locking). A Rust port on D1 must preserve this exact compare-and-swap pattern; it cannot assume transactional isolation across separate statements (`db.batch()` is the only atomicity primitive, and even that is a batch of *independent* statements, not a session-scoped transaction with mid-transaction reads).
- **Idempotency**: `client_mutation_id` dedup relies on a DB-level unique index and *string-matching the driver's error message* to distinguish "duplicate mutation" from any other insert failure. This is brittle (already documented in-repo as differing between local miniflare and CI wrangler). A Rust port should catch the underlying SQLite error code (`SQLITE_CONSTRAINT_UNIQUE` / D1's equivalent) rather than parsing prose.
- **Inventory compensation is manual, not transactional**: failed inventory claims are unwound with hand-written compensating `UPDATE +quantity` statements run in reverse order, outside of `db.batch()`. There is a real (if narrow) window where the process could crash between claiming inventory and either completing or unwinding — there is no saga/outbox log backing this. Worth deciding whether the Rust port keeps this behavior or hardens it (e.g. via a D1 `SAVEPOINT`-equivalent if platform-tables ever move to Postgres+Hyperdrive, per the `night_market_scaling` note in memory).

---

## 2. Group Orders (`apps/api/src/features/group-orders/`)

### Purpose

"Split the table" group ordering: one host generates a share code, other diners join anonymously via that code, everyone adds items to a shared cart against their own `memberId`, the host (or anyone with permission) splits the bill (equal/by-item/custom), and each member pays their portion independently. Distinct from `orders` — it writes to its own `group_orders`/`group_members`/`group_cart_items`/`split_bills`/`group_activity_logs` tables and never creates a row in `orders` itself; it is a pre-checkout collaboration layer, not an order-fulfillment pipeline.

### Routes

Mounted at `/api/v1/orders/group`. **Critical finding: because this is nested under `/orders`, every route here is also subject to the blanket `apiV1.use("/orders/*", staffOrUserCustomerAuthMiddleware)` registered in `app-factory.ts` — see the callout below the table.**

| Method | Full path | Auth (as coded in the route file) | Purpose | Request | Response |
|---|---|---|---|---|---|
| GET | `/api/v1/orders/group` | `authMiddleware` + `requireRole([0,1])` | List group orders for a restaurant | query `restaurantId`, `status` | `GroupOrderListItem[]` |
| POST | `/api/v1/orders/group/generate-code` | `authMiddleware` + `requireRole([0,1,2,3,4])` + `moduleGate` + `quotaGate("orders.created")` | Create a group order and return only the share code/URL | body `{restaurantId?}` | `{shareCode, shareUrl, expiresAt}` |
| GET | `/api/v1/orders/group/export` | `authMiddleware` + `requireRole([0,1])` | CSV export of group orders | query | CSV file |
| POST | `/api/v1/orders/group/create` | `authMiddleware` + `requireRole([0,1,2,3,4])` + `moduleGate` + `quotaGate` | Create a group order (full response incl. host member) | `createGroupOrderSchema` | `CreateGroupOrderResponse` |
| POST | `/api/v1/orders/group/join/:shareCode` | **none in this file** (intended public — anonymous diner joining by code) | Join an active, non-full, non-expired group by share code | `joinGroupSchema` | `{member, groupOrder}` |
| GET | `/api/v1/orders/group/statistics` | `authMiddleware` + `requireRole([0,1])` | Aggregate stats (count/avg size/avg value) | query | `GroupOrderStatistics` |
| GET | `/api/v1/orders/group/:groupOrderId` | **none in this file** (intended public) | Full group order detail: members, cart, activities | — | `GroupOrderSummary` |
| POST | `/api/v1/orders/group/:groupOrderId/cart` | **none in this file** (intended public — any member adds to own cart) | Add a cart item | `addCartItemSchema` | `GroupOrderCartItem` |
| PUT | `/api/v1/orders/group/:groupOrderId/cart/:itemId` | **none in this file** | Update quantity/customizations/notes on a cart item | `updateCartItemSchema` | updated item |
| DELETE | `/api/v1/orders/group/:groupOrderId/cart/:itemId` | **none in this file** | Remove a cart item (body must include the owning `memberId`) | `{memberId}` | `{message}` |
| POST | `/api/v1/orders/group/:groupOrderId/split` | **none in this file** | Compute and persist per-member split bills | `splitBillSchema` | `SplitBillData[]` |
| POST | `/api/v1/orders/group/:groupOrderId/payment/:memberId` | **none in this file** | Record one member's payment against their split bill | `processPaymentSchema` | payment result incl. `groupOrderStatus` |
| POST | `/api/v1/orders/group/:groupOrderId/leave/:memberId` | **none in this file** | Member leaves before checkout | — | `{message}` |
| GET | `/api/v1/orders/group/:groupOrderId/activities` | **none in this file** | Activity log feed | query | `GroupOrderActivity[]` |
| POST | `/api/v1/orders/group/cleanup/expired` | `authMiddleware` + `requireRole([0])` | Cancel any group orders past `expiresAt` (admin/cron-triggered) | — | `{cleaned, errors}` |

**Finding — the "public" group routes are not actually reachable without a staff/customer JWT.** `app-factory.ts` registers `apiV1.use("/orders/*", staffOrUserCustomerAuthMiddleware)` before mounting either `/orders/group` or `/orders`; because Hono's prefix-`use()` matches on the request path independent of `.route()` mount order (verified empirically against `hono@4.12.27`: a blocking `.use("/orders/*", …)` intercepts `/orders/group/join/ABC123` even though the group sub-app is `.route("/orders/group", …)`-mounted afterward), **every one of the seven routes marked "none in this file" above is actually gated behind a valid signed JWT for a role ≤ 5.** This defeats the apparent design intent (a diner scans a QR/share link and joins with no account), and is very likely either a live bug or evidence that the group-ordering flow is only reachable today via the customer app while already logged in (i.e. `optionalAuth`/anonymous QR-mode customers never see this feature working). Flag for product confirmation before porting the auth model as-is.

### Business logic

`GroupOrdersService` (`apps/api/src/features/group-orders/services/GroupOrdersService.ts`) uses `drizzle(d1)` directly (not the shared `BaseService`) and issues **individual, non-batched** statements for every write — there is no `db.batch()` or transaction anywhere in this service, unlike `orders`.

- **Create**: generates `groupOrderId` (UUID), an 8-char alnum `shareCode` (`generateShareCode`, `Math.random()`-based, not cryptographically strong), and `expiresAt` (`Date.now() + expirationHours*3600s`, default 24h, max 168h per schema). Inserts the group order row then a `creator`-role member row, then logs a `group_created` activity — three sequential inserts, not batched.
- **Join**: re-reads the group by `shareCode` with `status='active' AND expiresAt >= now()` (two separate SQL calls — the WHERE-clause expiry check and the later re-check in other methods use `new Date()` vs a stored `Date` field comparison; no single-transaction guarantee against a concurrent `cleanupExpiredGroups` sweep). Enforces `maxMembers` (from the `settings` JSON column, default 8) via a separate `COUNT(*)` query, and enforces unique member name per group (case-sensitive exact match) via another separate query. **Race window**: capacity and name-uniqueness checks are read-then-insert, not enforced by a DB constraint, so two simultaneous joins could both pass the capacity check and both insert, exceeding `maxMembers`.
- **Cart operations** (`addCartItem`/`updateCartItem`/`removeCartItem`): each is read-menu-item → insert/update cart row → **two separate follow-up writes** (`updateMemberTotal` then `updateGroupOrderTotal`, each doing their own `SELECT SUM(...)` then delete-or-upsert into `split_bills` / update `group_orders.totalAmountCents`) → log activity → invalidate KV summary cache. None of this is batched; a crash mid-sequence leaves cart/member-total/group-total inconsistent until the next mutating call recomputes them (they're always fully recomputed from `SUM()`, so they self-heal on the next write, but reads in between can be stale).
- **Split bill** (`splitBill`): supports `by_item`/`individual` (each member pays for their own cart items), `equal` (total ÷ member count), and `custom` (caller-supplied per-member amounts). **`splitData.splitType === "proportional"` is accepted by the Zod schema (`splitBillSchema` allows `"equal"|"proportional"|"individual"|"by_item"|"custom"`) but has no branch in the service's `if/else if` chain — it falls through to the final `else` and returns `{success:false, error:"Unsupported split type: proportional"}`.** This is a schema/service mismatch: a caller can pass a value the validator accepts but the business logic rejects. For each computed split, service/tax are simple percentage-of-subtotal (`rate` is a whole-number percentage, e.g. `6` not `0.06`, divided by 100 inline — inconsistent with `orders`' fractional-rate convention). Writes are delete-then-insert-or-update per member (again not batched), then updates the parent `group_orders` row to `status='checkout'` with aggregated totals and `lockedAt`.
- **Payment** (`processPayment`): looks up the member's `split_bills` row, requires `paymentStatus !== 'paid'`, validates the paid amount against the split total with a **±0.01 float tolerance** (`Math.abs(amount - splitBillTotal) > 0.01`), generates a synthetic `transactionId` if none supplied, stores raw payment metadata as a JSON string in a `paymentReference` text column, marks the split bill paid, then re-queries `COUNT(*) WHERE payment_status != 'paid'` — if zero, marks the whole group order `completed`. There is no integration with the `payments`/`billing` feature's real payment-gateway flow here; this endpoint only *records* that a payment happened, it doesn't process one.
- **Cleanup** (`cleanupExpiredGroups`): batch-selects up to 500 expired-but-still-open groups, cancels each one individually in a loop (no batching), logging per-group failures into an `errors[]` array rather than aborting the sweep.

### Data

- **D1 tables**: `group_orders`, `group_members`, `group_cart_items`, `split_bills`, `group_activity_logs` (all `packages/database/src/schema/group-orders.ts`), plus a read of `menu_items` (price/name lookup) and an `innerJoin` to it in `getGroupOrder`.
- **KV**: `group_order:{id}` and `share_code:{code}` (1h TTL, set on create — `share_code` lookup key is written but the read path (`joinGroup`) actually re-queries D1 by `shareCode`, not this KV key, so the KV entry looks unused for the join flow), `group_order_summary:{id}` (5 min TTL, invalidated on every mutation).
- **Realtime**: a local `broadcastGroupOrderEvent` helper (in the route file, not the service) constructs `GroupOrderEvent`s and calls `RealtimeBroadcastService.broadcastEvent("group_order", groupOrderId, event)` for: `GROUP_ORDER_CREATED`, `GROUP_MEMBER_JOINED`, `GROUP_CART_ITEM_ADDED`, `GROUP_CART_ITEM_UPDATED`, `GROUP_CART_ITEM_REMOVED` (from `@makanmakan/shared-types` `RealtimeEventType`). Split/payment/leave do **not** broadcast — only creation, join, and cart mutations are real-time.

### Cross-module dependencies

- `packages/database`: `menuItems` schema (price snapshot at add-to-cart time), `RealtimeBroadcastService`.
- `middleware/moduleGate` (`online_ordering`), `middleware/quotaGate` (`orders.created` — shared quota bucket with the main `orders` feature and `guest-orders`), `shared/utils/meter`.
- Does **not** call into `orders`' `OrdersService` at all — group orders never materialize an `orders` row in the schema reviewed; `getReservationById`-style "confirm into a real order" step does not exist here (contrast with `waiting-list`, which does convert pre-orders into real `orders` rows on seating).

### Rust rewrite notes

- **No transactions anywhere in this service** — every multi-statement operation (create group + host member, add-item + member-total + group-total, split-bill writes) is a sequence of independent awaited statements. A Rust port should decide whether to preserve this (simpler, but same race windows) or introduce `db.batch()`/application-level locking, especially for the join-capacity and member-name-uniqueness checks, which have a real TOCTOU race today.
- **Money**: same cents-column + `fromCents`/`toRequiredCents` pattern as `orders`, but tax/service-charge rates here are **whole-number percentages** (`serviceChargeRate: 6` meaning 6%, divided by `100` inline in `splitBill`), not the fractional rates (`0.06`) used by `orders`' `calculateOrderTotal`. Don't assume a single money/rate convention project-wide — check per-service.
- **Share code is not cryptographically random** (`Math.random()` over a 36-char alphabet, 8 chars ⇒ ~41 bits of entropy from a non-CSPRNG source). If the Rust port cares about guessability of another table's group order, use a CSPRNG.
- **Schema/validator drift**: `splitBillSchema` accepts a `"proportional"` split type the service does not implement (falls through to an error). Audit all Zod enum unions against the corresponding `match`/`if-else` arms when porting — this class of bug (validator accepts more than the handler implements) won't be caught by TypeScript.
- **Auth bug carries into the port**: unless product decides otherwise, replicate the *effective* behavior (join/cart/split/payment/leave/activities all require a role ≤ 5 JWT today, despite reading as "public" in the route file) rather than the *apparent intent* in the code comments — silently "fixing" this while porting would change production behavior.

---

## 3. Guest Orders (`apps/api/src/features/guest-orders/`)

### Purpose

The **actually-working** unauthenticated ordering path for shop/table/seat QR flows: no account, no JWT — a short-lived KV-backed "guest token" scopes the whole session (create → view → add items → cancel) to one restaurant + one order. Genuinely mounted public (see mount table at top of doc): `apiV1.route("/guest-orders", guestOrdersRoutes)` is registered in the public section of `app-factory.ts`, before any blanket auth middleware and before the 404 catch-all, so none of its routes require a bearer JWT.

### Routes

Mounted at `/api/v1/guest-orders`.

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/v1/guest-orders` | none (public; rate-limited via the global geo rate limiter's `/api/v1/guest-orders` custom rule in `app-factory.ts`) | Create a guest order | `createGuestOrderSchema` | `{order, guestToken, tokenExpiresAt}` (201) |
| GET | `/api/v1/guest-orders/:id` | `guestTokenAuth` (`Bearer gt_<token>`, KV `guest_token:{token}`, and the token's `orderId` must match the path `:id`) | View guest order status | — | `{order}` |
| POST | `/api/v1/guest-orders/:id/items` | `guestTokenAuth` | Add items to a `pending`/`confirmed` guest order (max 20 items total) | `addGuestOrderItemsSchema` | `{order}` |
| POST | `/api/v1/guest-orders/:id/cancel` | `guestTokenAuth` | Cancel a `pending`/`confirmed` guest order | — | `{order}` |

### Business logic

All order-domain logic (pricing, inventory, coupon, status transitions) is delegated to `orders`' `OrdersService` — this feature's own code is entirely about **guest-session bookkeeping** layered on top:

1. **Create** (`POST /`): looks up the restaurant, requires `isActive && isAvailable` and `settings.allowGuestOrders === true` (a per-restaurant opt-in flag) — else 403/400.
2. **Active-order dedup**: builds `guest_active:{restaurantId}:{guestIdentifier}` where `guestIdentifier` is `phoneLastDigits` (3 digits) normally, or `anon:{clientIp}` (from `cf-connecting-ip`/`x-forwarded-for`) when `phoneLastDigits` is the default `"000"` — i.e. truly anonymous guests are deduped by IP instead of phone digits. If that KV key already holds a value, the request is rejected with **HTTP 429** ("you already have an active order... wait for it to complete") **unless** a `clientMutationId` is supplied and a matching order already exists in D1 (`orders.restaurantId + clientMutationId`), in which case it's treated as a safe retry and rejected instead with 409 `CLIENT_MUTATION_DUPLICATE` — so the same "already have an active order" state produces two different status codes depending on whether the caller is retrying a known mutation.
3. **Table/seat validation**: for `orderType in {table, seat}`, re-validates the table belongs to the restaurant (and, for `seat`, the seat belongs to the table) — this is *in addition to* whatever `OrdersService.createOrder` itself validates, i.e. duplicated checks across two layers.
4. Calls `OrdersService.createOrder(..., isGuestOrder: true)`. Catches two specific error shapes and remaps them: menu-item-unavailable (`/^Menu item \d+ is not available$/`, matched by regex against the raw `Error.message` from deep in `packages/database`) → 409 `MENU_ITEM_UNAVAILABLE`; `CLIENT_MUTATION_DUPLICATE` → 409. Every other error propagates as-is.
5. **Token issuance**: `generateGuestToken()` produces `gt_<64 hex chars>` from `crypto.getRandomValues` (32 random bytes) — this *is* a CSPRNG, unlike group-orders' share code. Stored in KV as `guest_token:{token}` → `{orderId, restaurantId, guestName, phoneLastDigits, createdAt}`, 4-hour TTL. A second KV entry `guest_active:{restaurantId}:{guestIdentifier}` → orderId (2-hour TTL) enforces the one-active-order-per-guest rule above, and a reverse-lookup key `guest_active_lookup:{orderId}` → the active-order key (also 2h TTL). ⚠️ **Only the admin cancel path uses the lookup** (`orders/routes/index.ts:758-766` reads it to resolve the real key). Guest **self-cancel does not** (`guest-orders/routes/index.ts:342-348`): it re-derives `guest_active:{restaurantId}:{phoneLastDigits}` directly from the token payload — but order creation stores the key under `anon:{clientIp}` when `phoneLastDigits === "000"` (`:87-89`), so for anonymous guests self-cancel deletes a key that never existed and the real active-order block survives its full 2-hour TTL, locking the guest out of creating a new order even after a successful cancel. **Real shipping bug** (also listed in the README bug inventory).
6. **Add items / cancel**: both re-fetch the order via `OrdersService.getOrder`, enforce a status allowlist (`pending`/`confirmed` only) purely at this route layer (the underlying `OrderService.addItemsToOrder` in `packages/database` enforces the same statuses independently — duplicated, not shared, validation), and (for add-items) an additional guest-specific cap of 20 total items that doesn't exist for the authenticated `orders` add-items path. Cancel also revokes the guest token itself (`CACHE_KV.delete('guest_token:'+token)`) so the token can't be reused after cancellation, and clears both active-order KV keys via `Promise.allSettled` (best-effort — a KV delete failure here does not fail the cancel request).

### Data

- **D1**: reads `restaurants`, `tables`, `seats` directly via `createDatabase(c.env.DB)` (Drizzle) for the pre-flight validation in step 1/3 above; all order writes go through `OrdersService`/`OrderService` (see §1) which itself touches `orders`, `order_items`, `menu_items`, `coupon_usage`.
- **KV (`CACHE_KV`)**: `guest_token:{token}` (4h TTL), `guest_active:{restaurantId}:{guestIdentifier}` (2h TTL), `guest_active_lookup:{orderId}` (2h TTL) — this trio is the entire guest-session state; there is no D1 "guest session" table.
- No dedicated realtime events from this feature — creation/cancellation reuse whatever `OrdersService` broadcasts (new-order broadcast is *not* suppressed here the way it is for waiting-list pre-orders, since guest orders don't carry a `waitingListId`).

### Cross-module dependencies

- `features/orders/services/OrdersService` (create/get/addItems/cancel) — this is the only feature outside `orders` itself that calls `OrdersService` methods directly rather than going through HTTP.
- `middleware/guestAuth` (`guestTokenAuth`, `generateGuestToken`) — shared with `orders/routes/index.ts`'s (dead) `/orders/guest*` routes; `guestSessionAuth` (the pre-order variant) is defined in the same middleware file but is only actually exercised by the dead `orders/guest` POST route, not by this feature (guest-orders issues its token *after* order creation, it doesn't consume a pre-issued session token the way `orders/guest` was designed to).
- `middleware/quotaGate` (`enforceQuota` for `orders.created`), `shared/utils/meter` (`meterEmit`).

### Rust rewrite notes

- **KV is the only source of truth for guest identity** — there is no D1 row linking a guest token to a customer identity beyond what's embedded in the KV JSON blob. A Rust port must replicate the exact key layout (`guest_token:`, `guest_active:`, `guest_active_lookup:`) if any other feature (notably `orders`' admin-cancel path) is expected to keep interoperating with guest sessions across the rewrite boundary — i.e. these KV keys are a de facto cross-service contract, not private implementation detail.
- **Dedup-by-IP fallback**: when `phoneLastDigits` is left at its default `"000"`, the active-order dedup key degrades to client IP. Behind NAT/CGNAT or corporate proxies this will falsely dedup unrelated guests sharing an egress IP; behind IP-rotating mobile networks it will fail to dedup the same guest across requests. This is an inherent product tradeoff already accepted in the TS code, not a bug — just flagging it as intentional, non-obvious behavior to preserve (or revisit) in the port.
- **Double status codes for the same conflict** (429 vs 409 `CLIENT_MUTATION_DUPLICATE`, both meaning "you already have this order in flight") — preserve both codes for client compatibility even though they look redundant.
- **Menu-item-unavailable detection is regex-matching a `packages/database` error string** (`/^Menu item \d+ is not available$/`) across a module boundary. A Rust port should use a typed error/enum variant from the order-creation domain logic instead of string matching, but the *external* HTTP behavior (409 `MENU_ITEM_UNAVAILABLE`) must be preserved.

---

## 4. Kitchen (`apps/api/src/features/kitchen/`)

### Purpose

Kitchen Display System backend: aggregates active orders into `pending`/`preparing`/`ready` buckets with derived stats (elapsed time, urgency, efficiency), and exposes a scoped item-status-update endpoint. Also issues a narrow, short-lived JWT for the kitchen SSE "connection status" stream, and hosts two deprecated legacy item-status routes kept alive for offline devices. Real order-event fan-out (new order, status change) does **not** flow through this feature's SSE endpoint — that goes through the `REALTIME_SESSION` Durable Object via WebSocket, independent of kitchen's HTTP surface.

### Routes

Mounted at `/api/v1/kitchen`. No blanket middleware at `app-factory.ts` level; every route declares its own `authMiddleware`/`sseAuthMiddleware`.

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| GET | `/api/v1/kitchen/notification-settings` | `authMiddleware` | Read the caller's stored kitchen notification prefs (KV, per-user+restaurant) | — | `{}`-shaped free-form settings |
| PUT | `/api/v1/kitchen/notification-settings` | `authMiddleware` | Store arbitrary notification-settings JSON (schema is `z.object({}).passthrough()` — no real validation) | any JSON object | `{settings, updatedAt}` |
| POST | `/api/v1/kitchen/:restaurantId/events/token` | `authMiddleware` + `moduleGate("kitchen_display")` + chef-access + restaurant-match checks | Mint a 60-second-TTL scoped JWT (`purpose:"kitchen_sse"`, `aud:"kitchen_sse"`) for the SSE endpoint below, because `EventSource` cannot send an `Authorization` header | — | `{sseToken, expiresIn: 60}` |
| POST | `/api/v1/kitchen/:orderId/items/:itemId/start` | `authMiddleware` + `moduleGate("kitchen_display")` | **Deprecated** — legacy path-shape compatibility shim, sets item status to `preparing`; logs a `[deprecated-route]` warning with a stated removal date (2026-07-01) | — | success payload |
| POST | `/api/v1/kitchen/:orderId/items/:itemId/ready` | same | **Deprecated** — same shim, sets `ready` | — | success payload |
| GET | `/api/v1/kitchen/:restaurantId/events` | `sseAuthMiddleware` (accepts the scoped token above, typically via query param) + `moduleGate("kitchen_display")` + chef/restaurant checks | SSE stream: emits one `connected` event then a `heartbeat` every 30s until the client disconnects. **Carries no order data** — purely an online/offline indicator | — | `text/event-stream` |
| GET | `/api/v1/kitchen/:restaurantId/orders` | `authMiddleware` + `moduleGate("kitchen_display")` + chef/restaurant checks | Kitchen board data: pending/preparing/ready buckets + stats | query `limit` (1–500, default 100) | `KitchenOrdersResponse` |
| PUT | `/api/v1/kitchen/:restaurantId/orders/:orderId/items/:itemId` | `authMiddleware` + `moduleGate("kitchen_display")` + chef/restaurant checks | Canonical item-status update, scoped to `restaurantId`+order-status window | `orderItemStatusUpdateSchema` (`status` enum + optional `notes`) | `{orderId, itemId, status, updatedAt, orderPublicId}` |

### Business logic

`KitchenService` (`apps/api/src/features/kitchen/services/KitchenService.ts`) wraps `OrdersService` for reads and adds a **kitchen-scope guard** plus **dual realtime broadcast** for writes.

- **`getKitchenOrders`**: calls `OrdersService.getOrders({restaurantId, status:["confirmed","preparing","ready"], limit})`, buckets the results client-side by `order.status` (`pending` bucket = orders with status `confirmed`, i.e. the kitchen's "not yet started" queue is semantically `confirmed`, not `pending` — a naming mismatch between the order state machine's `pending` and the kitchen board's `pending` bucket, worth calling out explicitly since it's easy to misport). Derives `elapsedTime` per order (`(now - createdAt) / 60000`, floored), a hardcoded `priority:"normal"`/`estimatedTime:15` per item (no real prioritization logic despite the field existing), `urgentOrders` (elapsed > 30 min), and `averageWaitingTime`/`efficiency` (`completedToday / totalOrders * 100` from `OrdersService.getDailyStats`, itself calling the same `getDailyOrderStats` used by `orders`' `/stats` endpoint).
- **`updateOrderItemStatus`**: the only kitchen-specific write path. Before touching anything, calls `getScopedKitchenItem` — a **hand-written raw-SQL** query (`env.DB.prepare(...)`, not Drizzle) joining `order_items` → `orders` → `menu_items` with `WHERE oi.id=? AND o.id=? AND o.restaurant_id=? AND o.status IN ('confirmed','preparing','ready')`. If this returns no row (item doesn't exist, belongs to a different restaurant, or the parent order has already left the active-kitchen status set), the request is rejected with 403 `KITCHEN_ITEM_SCOPE_DENIED` **before** the actual status mutation runs — this is the real authorization boundary for this endpoint, layered on top of (not instead of) the route-level `chef-access`+`restaurant-match` checks. It then calls `OrdersService.updateItemStatus` (which in turn calls `OrderService.updateOrderItemStatus` in `packages/database`, itself CAS-guarded via `WHERE status != target_status` to stop two chefs racing to complete the same item — see §1 sibling logic), then fires **two parallel realtime broadcasts**: `ORDER_ITEM_STATUS_UPDATE` (generic order-item event) and `KITCHEN_ITEM_STATUS` (kitchen-board-specific event with a derived `priority`/`waitingTime`/`tableName`), both via `RealtimeBroadcastService`.
- **Legacy shim routes** (`/:orderId/items/:itemId/start|/ready`): resolve `orderId` through `resolveOrderIdentity` (accepts UUID, `order_number`, *or* `client_mutation_id` as the path segment — see `shared/services/order-identity.ts`) before delegating to the same `updateOrderItemStatus`. Every hit logs a structured `console.warn` including a stated sunset date, intended to be grepped in production logs to confirm the old client population has drained before deletion.
- **SSE token**: a deliberately narrow JWT (60s expiry, `aud:"kitchen_sse"`) — this is *not* the user's normal access token, specifically because query-string tokens are more exposure-prone (logs, referrers) than an `Authorization` header, so its blast radius is capped to one minute and one purpose.

### Data

- **D1**: no Drizzle schema imports in this feature at all for reads — `getKitchenOrders`/stats go entirely through `OrdersService`. The one direct DB touch is `getScopedKitchenItem`'s raw SQL (`order_items`, `orders`, `menu_items`), which is a **Layer 3 (banned) raw-SQL query** per this repo's stated two-layer policy (see project `CLAUDE.md`) — it doesn't reference Drizzle schema column objects at all, just hand-written column/table name strings (`o.created_at_ms`, `oi.item_snapshot`, etc.), so a future column rename here would fail silently at runtime rather than at compile time.
- **KV (`CACHE_KV`)**: `kitchen:notification-settings:{scope}:{userId}` (no TTL set — persists indefinitely) where `scope` is the URL-encoded restaurant ID or `"global"`.
- **Realtime**: `ORDER_ITEM_STATUS_UPDATE` + `KITCHEN_ITEM_STATUS` events (both `RealtimeEventType` values) broadcast in parallel on every item-status write, restaurant-scoped.

### Cross-module dependencies

- `features/orders/services/OrdersService` (read path: `getOrders`, `getDailyStats`; write path: `updateItemStatus`).
- `shared/services/order-identity.ts` (`resolveOrderIdentity` — also used by `pos`'s receipt/refund routes and `tables`' occupy route, to accept UUID/order-number/client-mutation-id interchangeably wherever an "orderId" path/body param appears).
- `middleware/moduleGate` (`kitchen_display`), `hono/jwt` (`sign` — direct JWT minting, not through a shared auth-token service).

### Rust rewrite notes

- **Raw SQL in `getScopedKitchenItem` is the real authorization gate for the canonical status-update route** — must be ported faithfully (including the `status IN ('confirmed','preparing','ready')` scope restriction, which silently excludes `pending` or terminal-status orders from kitchen mutation even if the caller has a valid token and role).
- **"pending" is overloaded**: the kitchen board's `pending` bucket means order-status `confirmed`, not order-status `pending` (a genuinely-unconfirmed order never shows up on the kitchen board at all). Do not conflate this with `order_items.status` values (`pending|preparing|ready|completed`), which are a *different* enum on a *different* entity (the item, not the order) — the route's own `orderItemStatusUpdateSchema` uses `completed` where the order-level state machine (§1) uses `delivered`; there is a compatibility shim (`stringToOrderStatus`, in `orders/routes/index.ts`, not kitchen) that maps `"completed"` wire values to `"delivered"` for *order*-status updates, but that mapping does not apply to *item*-status updates, which are their own vocabulary end-to-end.
- **SSE stream carries zero business data** — it's a heartbeat-only liveness indicator; if the Rust port is tempted to "improve" this into a real event stream, that's a behavior change, not a straight port. Note it explicitly if doing so.
- **Legacy routes have a stated sunset date in a code comment, not a config flag** — a Rust port should either carry the same routes forward with the same warning-log behavior, or explicitly confirm with the team that the `[deprecated-route]` log line has stayed silent long enough in production to safely drop them.

---

## 5. POS (`apps/api/src/features/pos/`)

### Purpose

Point-of-sale/cash-drawer subsystem: cash registers, shift open/close, cash-movement (in/out/count/adjustment) ledger, refunds, receipts (simulated printing), reporting, and a POS-initiated payment path for market (multi-vendor) checkouts. This is the module with the most direct financial-ledger responsibility of the ten reviewed here.

### Routes

Mounted at `/api/v1/pos`, blanket `authMiddleware` + `moduleGate("pos")` (`app-factory.ts`). Composed from six sub-routers (`apps/api/src/features/pos/routes/index.ts`): `registers.ts` (`/registers`), `shifts.ts` (`/shifts`), `cash-movements.ts` (mounted at root — paths already include `/shifts/:shiftId/cash-movements` and `/registers/:registerId/cash-count`), `receipts.ts` (`/receipts`, plus a root-mounted `/registers/:registerId/receipts`), `refunds.ts` (`/refunds`, plus root-mounted `/registers/:registerId/refunds`), `reports.ts` (`/reports`), `market-checkouts.ts` (mounted at root).

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/v1/pos/registers` | roles `[0,1]` (owner scoped to own restaurant) | Create a cash register | `createRegisterSchema` | `CashRegister` |
| GET | `/api/v1/pos/registers` | any staff role | List registers for a restaurant | query `restaurantId?` | `CashRegister[]` |
| GET | `/api/v1/pos/registers/:registerId/status` | roles `[0,1,4]` | Register status + `isShiftActive` | — | register + flag |
| PUT | `/api/v1/pos/registers/:registerId` | roles `[0,1]` | Update register config | partial `createRegisterSchema` | `CashRegister` |
| POST | `/api/v1/pos/registers/:registerId/activate` | roles `[0,1]` | Activate | — | `{message}` |
| POST | `/api/v1/pos/registers/:registerId/deactivate` | roles `[0,1]` | Deactivate | — | `{message}` |
| DELETE | `/api/v1/pos/registers/:registerId` | roles `[0,1]` | Delete — **rejected if register has an active shift** | — | `{message}` |
| POST | `/api/v1/pos/shifts/start` | roles `[0,1,4]` (non-admin must open under their own `operatorId`) | Open a shift on a register (rejected if register already has an active shift) | `startShiftSchema` | `CashShift` |
| POST | `/api/v1/pos/shifts/:shiftId/end` | roles `[0,1,4]` | Close a shift, compute expected-vs-actual cash difference | `endShiftSchema` | `{shift}` |
| POST | `/api/v1/pos/shifts/:shiftId/suspend` | roles `[0,1,4]` | Suspend an active shift | `{reason?}` | `{message}` |
| POST | `/api/v1/pos/shifts/:shiftId/resume` | roles `[0,1,4]` | Resume a suspended shift | — | `{message}` |
| GET | `/api/v1/pos/shifts/current/:registerId` | roles `[0,1,4]` | Currently-active shift on a register, if any | — | `CashShift \| null` |
| GET | `/api/v1/pos/shifts/:shiftId/report` | roles `[0,1,4]` | Generate + persist a shift report | — | `{reportId, reportData}` |
| GET | `/api/v1/pos/shifts/stats` | roles `[0,1]` | Aggregated shift stats for a restaurant/date-range | query | stats |
| POST | `/api/v1/pos/shifts/:shiftId/cash-movements` | roles `[0,1,4]` | Record a manual cash movement against an active shift | `cashMovementSchema` | `{message}` |
| GET | `/api/v1/pos/shifts/:shiftId/cash-movements` | roles `[0,1,4]` | List a shift's cash movements | query `type,page,limit` | paginated list |
| GET | `/api/v1/pos/registers/:registerId/cash-count` | roles `[0,1,4]` | List `type='count'` movements for a register, optionally by date | query `date?` | list |
| POST | `/api/v1/pos/cash-movements/:movementId/approve` | roles `[0,1]` | Approve a pending cash movement | — | `{message}` |
| POST | `/api/v1/pos/cash-movements/:movementId/reject` | roles `[0,1]` | Reject a pending cash movement | `{reason?}` | `{message}` |
| POST | `/api/v1/pos/receipts/print` | roles `[0,1,4]` (requires `X-Register-Id` header) | Print/create a receipt for an order | `printReceiptSchema` + `orderId` (UUID or alias) | `Receipt` |
| POST | `/api/v1/pos/receipts/:receiptId/reprint` | roles `[0,1,4]` | Reprint | — | `{message}` |
| POST | `/api/v1/pos/receipts/:receiptId/cancel` | roles `[0,1,4]` | Cancel a pending print job | — | `{message}` |
| GET | `/api/v1/pos/registers/:registerId/receipts` | roles `[0,1,4]` | List receipts for a register | query | paginated list |
| GET | `/api/v1/pos/receipts/:receiptId` | roles `[0,1,4]` | Receipt detail | — | `Receipt` |
| POST | `/api/v1/pos/refunds/create` | roles `[0,1]` (requires `X-Register-Id` header) | Process a refund against an order | `processRefundSchema` + `originalOrderId` (UUID or alias) | `RefundResult` |
| GET | `/api/v1/pos/registers/:registerId/refunds` | roles `[0,1,4]` | List refunds for a register | query | paginated list |
| GET | `/api/v1/pos/refunds/:refundId` | roles `[0,1,4]` | Refund detail | — | `Refund` |
| POST | `/api/v1/pos/refunds/:refundId/approve` | roles `[0,1]` | Approve a processing refund | — | `{message}` |
| POST | `/api/v1/pos/refunds/:refundId/reject` | roles `[0,1]` | Reject a processing refund | `{reason?}` | `{message}` |
| POST | `/api/v1/pos/refunds/:refundId/cancel` | roles `[0,1]` | Cancel a pending/processing refund | `{reason?}` | `{message}` |
| GET | `/api/v1/pos/reports/daily` | roles `[0,1]` | Daily business report | query `restaurantId?,date` | report |
| GET | `/api/v1/pos/reports/register-usage` | roles `[0,1]` | Per-register usage stats over day/week/month | query | stats |
| GET | `/api/v1/pos/reports/export` | roles `[0,1]` | Export a report as JSON/CSV (PDF returns 501) | query | file or `501` |
| POST | `/api/v1/pos/market-checkouts/:checkoutId/pay` | roles `[0,1,4]` | Settle a multi-vendor market checkout via POS (cash/card/wallet at the counter) | `marketCheckoutPosPaymentSchema` + `Idempotency-Key` header | `{checkout, payment, alreadyPaid}` |

### Business logic

Seven services, each a thin `drizzle(d1)` wrapper (none use the shared `BaseService`), all money in `*_cents` columns via `packages/database/src/utils/money.ts`.

- **`RegisterService`**: pure CRUD + JSON-serialized `hardwareConfig`/`peripherals`/`settings` columns (stored as `TEXT` via manual `JSON.stringify`/`JSON.parse`, **not** Drizzle `{mode:'json'}` typed columns — unlike most other JSON columns in this codebase). Delete is blocked if an active shift references the register.
- **`ShiftService.startShift`**: rejects if the register already has an `active` shift (checked via a plain `SELECT`, not a unique partial index — a race between two concurrent `start` calls on the same register is possible in principle). On success, also flips `cash_registers.currentShiftId` and records an `opening` cash movement equal to the starting float.
  - **`endShift`**: `expectedAmount = startAmount + totalSales - totalRefunds`; `differenceAmount = actualAmount - expectedAmount` (i.e. positive = overage, negative = shortage) — this is the shift's over/short calculation, all in dollars derived from cents columns. Records a `closing` cash movement whose description embeds the signed difference as a human-readable string. Clears `cash_registers.currentShiftId`.
  - `suspendShift`/`resumeShift` are simple status flips; `suspendShift` appends a note to `closingNotes` via `COALESCE(...) || text || CHAR(10)` (accumulating log, not overwrite).
- **`CashMovementService`**: generic manual cash-movement ledger entries (`cash_in`, `cash_out`, `count`, `adjustment`, `payout`, `deposit`), independent of shift open/close; approve/reject are simple `approvalStatus` flips gated by `WHERE approvalStatus='pending'` (silently no-ops if the row is already approved/rejected — the route always reports success regardless).
- **`RefundService.processRefund`** — the most involved single method in POS:
  1. Validates the refund amount doesn't exceed the original order total, **and** that cumulative refunds-to-date (summed via `sumMoneyAmount` over `refunds` rows with status `completed`/`processing`) plus this new refund doesn't exceed the order total either — i.e. partial refunds are tracked cumulatively.
  2. **Post-close-shift detection (a documented "K6 release gate" behavior)**: if a `shiftId` is supplied and that shift's status is `closed`, the refund is processed as a **non-ledger-mutating adjustment** — it still writes a `refunds` row (with `metadata.postCloseAdjustment: true`) but does **not** post a live cash movement, and the response carries `ledgerMutation: false` plus an `adjustmentId` instead of the normal shape, so a caller can assert the closed shift's totals were left untouched. Any other shift status (`active`/`suspended`/unknown) takes the normal path (`ledgerMutation: true`), which does insert a cash movement (negative amount = outflow) when `refundMethod === "cash"`.
  3. Writes the refund row + (conditionally) the cash-movement row in a single `db.batch()` — this is the only batched write in POS besides `MarketCheckoutPOSPaymentService`.
  4. **`processRefundCompletion` is fire-and-forget `setTimeout(..., 5000)`, not `waitUntil`-wrapped, and the route never awaits or schedules it via `c.executionCtx.waitUntil`.** In the Cloudflare Workers runtime, a `setTimeout` callback scheduled during a request is only guaranteed to run if the isolate stays alive that long — normally the isolate can be frozen/evicted immediately after the response is returned unless the work is registered with `waitUntil`. **This means the refund's automatic `processing → completed` transition (and its failure-path `alertSink` call) may frequently never execute in production**, leaving refunds stuck in `processing` until some other code path (not present in the reviewed files) transitions them, or until a human calls the manual `approve`/`reject` endpoints. This is a strong candidate for either a bug report or an explicit "known limitation, approve manually" note before porting — a Rust rewrite on Workers would have the identical problem with a bare `tokio::spawn`/timer without `waitUntil`; on a long-lived server (not Workers) this concern disappears entirely, which is itself a meaningful platform-dependent behavior change to flag.
- **`ReceiptService.printReceipt`**: generates a receipt content snapshot (order items/totals/customer name from `customerInfo` JSON, an explicit `// TODO: join tables` for table number that was never implemented) and stores it as a JSON string in `receipts.content`. `simulatePrinting` has the **identical fire-and-forget `setTimeout` pattern** as refunds (`2000ms * copies`, never `waitUntil`-wrapped) — same non-guaranteed-execution caveat: printed receipts may permanently stay `printStatus: 'pending'` instead of transitioning to `printed`.
- **`ReportService`**: three report shapes (`shiftReport` — persisted to a `shift_reports` table as a JSON blob + also returned inline; `dailyReport` — computed live, not persisted; `registerUsageStats` — grouped by day/week/month using SQLite `strftime`/`date` helpers from `packages/database`'s money-sql/date helpers). All are read-heavy aggregate queries; no writes except the shift-report persistence.
- **`MarketCheckoutPOSPaymentService.process`** — settles a `market_checkout_sessions` row (owned by the `markets`/`market-checkouts` features, not POS) from the physical register: reads the session + its `market_checkout_child_orders` (one child order per vendor restaurant in the multi-vendor cart) + the register's active shift, authorizes the operator (admin bypasses; non-admin must belong to the shift's restaurant **and** that restaurant must actually be one of the checkout's vendors), then for each child order inserts a `payment_transactions` row (`onConflictDoNothing` — idempotent replay-safe) and flips `orders.paymentStatus='paid'` in one `db.batch()` per child, updates the parent session's `paymentStatus`/`paymentSummary` JSON, upserts a `market_checkout_payments` parent-payment row (`onConflictDoUpdate` keyed on `paymentId`), and posts one aggregate `cash_movements` row + increments the shift's running sales totals — this is the most "transactionally careful" write path in the whole `pos` feature (multiple `db.batch()` calls, explicit idempotency key derivation `pos-market-checkout:{checkoutId}` / `{parentKey}:{childOrderId}`, and a `settlement` breakdown computing a platform-fee-in-basis-points cut per vendor). Also mirrors the paid state into two KV blobs (`market_checkout:{id}` and the `market_checkout:index` list) so cached reads from the `markets` feature stay consistent — a cross-feature cache-invalidation responsibility living inside `pos`.

### Data

- **D1 tables**: `cash_registers`, `cash_shifts`, `cash_movements`, `receipts`, `refunds`, `shift_reports`, plus reads of `orders`, `order_items`, `menu_items` (for report joins), and — only in `MarketCheckoutPOSPaymentService` — `market_checkout_sessions`, `market_checkout_child_orders`, `market_checkout_payments`, `payment_transactions`.
- **KV**: only touched by `MarketCheckoutPOSPaymentService` (`market_checkout:{checkoutId}`, `market_checkout:index`), to keep the `markets` feature's cache coherent after a POS-initiated payment.
- **Realtime**: none. POS has no realtime broadcast of any kind in the reviewed code — shift/refund/receipt state changes are not pushed to any dashboard.

### Cross-module dependencies

- `shared/services/order-identity.ts` (`resolveOrderIdentity`) — receipts and refunds accept an order ID *or* order number *or* client-mutation-id in the request body/param and resolve it to the canonical UUID before delegating, same helper used by `kitchen` and `tables`.
- `services/AlertService` (root `apps/api/src/services/`, not a feature) — refund-completion failures optionally page out via Slack/email if `SLACK_WEBHOOK_URL`/`ALERT_EMAIL_TO` are configured; wired in only by the refunds route (`createRefundService`), not by `ShiftService`/`CashMovementService` even though they have analogous failure modes.
- `packages/database` schema for `markets`/`market-checkouts` (`marketCheckoutSessions`, `marketCheckoutChildOrders`, `marketCheckoutPayments`) — `MarketCheckoutPOSPaymentService` is effectively a cross-feature integration living inside `pos` rather than inside `market-checkouts`.

### Rust rewrite notes

- **Fire-and-forget `setTimeout` for "simulated" async completion (refund completion, receipt printing) is very likely non-functional today on Workers** and must not be ported as-is; if the Rust rewrite still targets Workers, use `waitUntil`/a Queue; if it moves to a persistent server process, a bare async task is fine but changes the reliability characteristics versus what's running in production now — call this out to the team rather than silently "fixing" or silently reproducing the bug.
- **Money**: same cents-column convention as `orders`; `endShift`'s over/short (`differenceAmount`) sign convention (positive = overage) should be preserved exactly, since it's user-facing in shift-close notes.
- **`hardwareConfig`/`peripherals`/`settings` on `cash_registers` are manually JSON-stringified `TEXT` columns**, not Drizzle-typed JSON — a straightforward serde `Value`/string column in Rust, but note this is the *odd one out* versus most other JSON columns in the codebase, which use Drizzle's typed `{mode:'json'}`.
- **No unique constraint backs "one active shift per register"** — enforcement is read-then-insert in application code. A Rust port on D1 (no better locking primitive available) should preserve the existing race window unless a partial unique index (`WHERE status='active'`) is added as part of the rewrite — that would be a deliberate hardening, not a straight port.
- **`MarketCheckoutPOSPaymentService` is the idempotency reference implementation for this whole feature set** — derives a stable idempotency key per child payment (`{parentKey}:{orderId}`), uses `onConflictDoNothing`/`onConflictDoUpdate` at the DB level rather than only checking-then-inserting, and batches related writes. Contrast this with `RefundService`/`ReceiptService`, which have no idempotency key handling at all for retried requests (a client retrying `POST /refunds/create` after a timeout could create a duplicate refund, bounded only by the "does not exceed order total" check, not by a request-level idempotency key). Worth deciding whether the Rust port normalizes all POS money-movement endpoints onto the market-checkout pattern.

---

## 6. Queue (`apps/api/src/features/queue/`) & 7. Waiting List (`apps/api/src/features/waiting-list/`)

These two features are documented together because **`queue` is a thin, partial adapter over the exact same `packages/database` `WaitingListService` that `waiting-list` exposes directly** — there is one waiting-list domain, reached through two different HTTP surfaces with different route shapes, different auth models, and (materially) different background-task handling. Treat `waiting-list` as the canonical/complete surface and `queue` as a legacy-compatible subset.

### Purpose

Restaurant walk-in waitlist: join a numbered queue (letter+number display code, e.g. `B012`), staff call the next party and assign a table, the customer confirms, staff mark them seated (which also auto-confirms and broadcasts any pre-orders placed against that waiting-list ticket via `orders`' `waitingListId` linkage — see §1), or the ticket expires/is cancelled (releasing any reserved table and cancelling any pre-order). Also estimates wait time from recent table-turnover data and exposes SMS notifications (Twilio) at key transitions.

### Routes

**Queue** — mounted at `/api/v1/queue`, **public section** (no blanket middleware), thin routes over `UnifiedQueueService`:

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/v1/queue/join` | `optionalAuth` (accepts anonymous or authenticated) | Join the queue | `{restaurantId,customerName,customerPhone,partySize,specialRequests}` (also accepts legacy `snake_case` aliases) | `UnifiedJoinResult` |
| GET | `/api/v1/queue/:restaurantId/status` | none | Public queue summary (counts, avg wait by party-size bucket) | — | `QueueStatus` |
| GET | `/api/v1/queue/:restaurantId/current` | `authMiddleware` + restaurant-match | Staff dashboard: current waiting entries | query `limit?` | `{queue, total}` |
| GET | `/api/v1/queue/:queueId/position` | none | Customer polls their own position | — | `{queueNumber, queueDisplay, currentPosition, partiesAhead, estimatedWaitMinutes, status, canCancel}` |
| POST | `/api/v1/queue/:restaurantId/call-next` | `authMiddleware` + restaurant-match | Call next (auto-pick or a specific `queueId`) and auto-assign a table | `{tableId?, specificQueueId?}` | `UnifiedCallNextResult` |
| POST | `/api/v1/queue/:queueId/seat` | `authMiddleware` + restaurant-match (derived from the entry, not the URL) | Mark seated | — | `{message}` |
| POST | `/api/v1/queue/:queueId/cancel` | none — **phone-number equality check instead of a session/JWT** | Customer self-cancel | `{customerPhone}` | `{message}` |
| GET | `/api/v1/queue/health` | none | Static healthcheck (`backend: "WaitingListService"`) | — | `{status, timestamp, backend}` |

**Waiting List** — mounted at `/api/v1/waiting-list`, **public section**; the route file itself splits into a public block (routes 1–8 below) followed by `app.use("/*", authMiddleware); app.use("/*", moduleGate("reservations"))` before the remaining protected routes:

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/v1/waiting-list` | `optionalCanonicalCustomerAuthMiddleware` (attaches `customerId` if the caller has a canonical customer session, otherwise anonymous) | Join the queue | `JoinWaitingListRequest` | `WaitingListResponse` (includes `alreadyJoined: true` if an active ticket for this phone+restaurant+day already existed — see idempotency note below) |
| GET | `/api/v1/waiting-list/lookup` | none, **but see note** | Recover an active ticket by phone (for a customer who lost their `ticketId`) | query `restaurantId, phone` | active ticket or 404 `NO_ACTIVE_TICKET` |
| GET | `/api/v1/waiting-list/history` | none, `strictRateLimit` middleware | Waiting-list history by phone (explicitly rate-limited "to avoid phone number enumeration") | query `restaurantId, phone, limit?` | `WaitingListResponse[]` |
| GET | `/api/v1/waiting-list/:id` | none | Ticket detail by ID | — | `WaitingListResponse` |
| GET | `/api/v1/waiting-list/queue-status/:restaurantId` | none | Same shape as `queue`'s `/status` | — | `QueueStatus` |
| GET | `/api/v1/waiting-list/estimate-wait/:restaurantId` | none | Wait-time estimate for a hypothetical party size | query `partySize?` | `WaitTimeEstimateResult` |
| DELETE | `/api/v1/waiting-list/:id` | none — phone-equality check in body | Self-cancel | `{customerPhone}` | `WaitingListResponse` |
| POST | `/api/v1/waiting-list/:id/confirm` | none — phone-equality check in body | Customer confirms after being called | `{customerPhone}` | `WaitingListResponse` |
| — | *(auth boundary: `app.use("/*", authMiddleware); app.use("/*", moduleGate("reservations"))`)* | | | | |
| GET | `/api/v1/waiting-list` | roles `[0,1,3,4]` | List/filter (admin can cross-restaurant filter; others forced to own restaurant) | query filters+pagination | `{data, pagination}` |
| POST | `/api/v1/waiting-list/:id/call` | roles `[0,1,3,4]` + entry-restaurant-match | Call a specific ticket, assign table | `{tableId}` | `WaitingListResponse` |
| POST | `/api/v1/waiting-list/:id/seat` | roles `[0,1,3,4]` + entry-restaurant-match | Mark seated | — | `WaitingListResponse` |
| POST | `/api/v1/waiting-list/:id/expire` | roles `[0,1,3,4]` + entry-restaurant-match | Mark expired (timeout) | — | `WaitingListResponse` |
| GET | `/api/v1/waiting-list/stats/:restaurantId` | roles `[0,1]` + restaurant-match | Daily aggregate stats | query `date?` | `WaitingStats` |
| POST | `/api/v1/waiting-list/batch-call` | roles `[0,1,3,4]` | Auto-call+seat-assign N waiting parties in one request | `{restaurantId, count?}` | per-entry results |

Note on `/lookup`: it is registered *before* `GET /:id` specifically so Hono doesn't route the literal segment `/lookup` into the `:id` param handler — the same trap exists for `queue-status/:restaurantId`, `estimate-wait/:restaurantId`, and `stats/:restaurantId`, all of which must stay registered ahead of any bare `:id`-style catch-all in a Rust router too.

### Business logic (`packages/database/src/services/WaitingListService.ts`)

- **Join is idempotent per (restaurant, phone, business-day)**: before creating a new ticket, it checks for an existing `waiting|called|confirmed` entry for the same `restaurantId+customerPhone+queue_date` (queue_date computed via `businessDateSql()`, i.e. a restaurant-defined "business day" boundary, not calendar midnight) and, if found, returns the *existing* ticket annotated `alreadyJoined: true` rather than erroring or creating a duplicate. There's an acknowledged race (comment: "dedup query saw it but full lookup didn't") where a concurrent cancel/expire between the two reads falls through to creating a fresh ticket rather than erroring — accepted as a rare, harmless edge case.
- **Queue numbering**: letter prefix by party size (`A` ≤3, `B` 4–5, `C` ≥6 — inferred from the `>=4`/`>=6` thresholds in `generateQueueNumber`), number = `MAX(queue_number) + 1` scoped to `(restaurant, letter, business-day)` — **not** guarded by a unique constraint or CAS; two simultaneous joins for the same letter could compute the same next-number and both insert (no `queue_number` uniqueness enforced at the DB level in the reviewed schema usage).
- **Every state-changing method uses the same optimistic-concurrency pattern**: a single `UPDATE ... SET status=X ... WHERE id=? AND status=<expected prior state(s)>`, then checks `meta.changes` (via `getMutationChanges`) — zero rows changed throws a Chinese-language `"...狀態已被其他操作更新，請刷新"` (translates to "state already updated by another operation, please refresh") mapped to a generic `Error`, not a typed conflict — the HTTP layer for `waiting-list`/`queue` does **not** special-case this into a 409 the way `orders` does for version conflicts; it will surface as whatever the generic error handler decides (likely 500, since it's a plain `Error`, not an `ApiError`). This is a concrete inconsistency versus the `orders` module's `ORDER_VERSION_CONFLICT` → 409 pattern and worth deciding whether to normalize in the port.
- **`callWaiting`**: validates the target table is unoccupied and (if the `waiting_list_id` column exists — checked dynamically via `PRAGMA table_info` at runtime, see Rust notes) not already reserved by another ticket, and has sufficient `capacity`. On success: flips the ticket to `called` with a `timeoutAt = now + 5min` (`CALL_TIMEOUT_MS`), marks the table `reserved` (linking `waiting_list_id`), sends an SMS (queued as a background task, not awaited inline), sends a **separate** web-push notification via `CustomerWebPushService` (awaited inline, unlike SMS), and broadcasts a `waiting_list_called` realtime event.
- **`confirmWaiting`**: if `now > timeoutAt`, auto-expires the ticket and throws instead of confirming (customer confirmed too late).
- **`markSeated`**: flips to `seated`, marks the table `occupied`, and — this is the cross-module linkage into `orders` — calls `OrderService.confirmWaitingListPreOrders(waitingListId, tableId)`, which bulk-updates any `orders` rows carrying this `waitingListId` from `pending`→`confirmed` and assigns them the now-known `tableId`, then broadcasts a `NEW_ORDER` event for each confirmed pre-order (previously suppressed at creation time — see §1). Also triggers `recalculateWaitTimes` for the rest of the queue.
- **`cancelWaiting`/`expireWaiting`**: release the table (if reserved) and call `OrderService.cancelWaitingListPreOrders(waitingListId)` (bulk `pending`→`cancelled` for any linked pre-orders), then recalculate wait times for everyone still waiting.
- **`estimateWaitTime`**: runs 4 independent queries in parallel (`Promise.all`) — average recent turnover time (from `orders` where `paid_at ?? delivered_at` is set, within the last 2h), count of "suitable" tables (capacity within `[partySize, partySize+2]`), count of other waiting parties within the same capacity band, and count/earliest-availability of currently-occupied suitable tables. Combines these into a **heuristic**, not a model: `estimatedWaitMinutes = (partiesAhead * avgTurnover) / max(suitableTables,1)`, then a peak-hour multiplier (`18:00–20:00 → ×1.2`, `14:00–17:00 → ×0.9`, hardcoded local-clock hours, no restaurant-timezone awareness visible in this file), then a minus-5-minutes adjustment if a table is expected to free up sooner than the current estimate, floored at 10 minutes if there's any queue at all, then rounded to the nearest 5. A parallel `calculateConfidence` produces a 0.3–1.0 confidence score from the same inputs (more parties ahead, zero available tables, or abnormal turnover time all reduce confidence). **This is the single most "product heuristic, not a simple CRUD rule" piece of logic in the ten modules reviewed** — a faithful Rust port needs the exact constants (2h lookback, `+2` capacity band, peak-hour multipliers, 5-minute floor/rounding) reproduced bit-for-bit if wait-time estimates are expected to match historical behavior.
- **Background tasks are collected, not fired-and-forgotten, but only when the caller remembers to drain them**: `queueBackgroundTask` pushes SMS-send promises onto an in-memory `this.backgroundTasks` array; `drainBackgroundTasks()` pops and returns them. The `waiting-list` route file's `waitUntilBackgroundTasks` helper calls `drainBackgroundTasks()` after every mutating call and registers the drained promises with `c.executionCtx.waitUntil` (falling back to a direct `await` if `waitUntil` isn't available, e.g. in tests) — **this is done correctly in `waiting-list`**. **The `queue` feature's `UnifiedQueueService` never calls `drainBackgroundTasks()` at all** (confirmed by grep — zero references outside `waiting-list`'s route file and its own test). Any SMS notification queued by a call that came in through `/api/v1/queue/*` (join, call-next, seat, cancel) is silently discarded — the `Promise` is simply dropped, never awaited, never passed to `waitUntil`. **This is a genuine, silent functional gap in the `queue` HTTP surface versus the `waiting-list` HTTP surface for the exact same underlying service method**, and needs to be either fixed or consciously carried forward (as a documented limitation) in the Rust port.

### Data

- **D1 tables**: `waiting_list` (mixed access — some queries reference the Drizzle `waitingList` schema object's columns, most use raw string column names in hand-written `sql` templates), `tables` (occupancy/reservation flip, with a runtime `PRAGMA table_info` feature-check for optional `waiting_list_id`/`reservation_id` columns — see Rust notes), plus cross-calls into `OrderService` (`orders` table) for pre-order confirm/cancel.
- **KV**: none directly in `WaitingListService`; `queue`'s route layer touches no KV either.
- **Realtime**: `waiting_list_joined|called|confirmed|seated|cancelled|expired` events broadcast to the `admin:{restaurantId}` room (not a dedicated `waiting-list` room) so the existing admin-dashboard WebSocket subscription picks them up without new wiring; plus a `NEW_ORDER` broadcast per confirmed pre-order on seat.
- **SMS**: Twilio, only if `env.TWILIO_ACCOUNT_SID` is configured (silently skipped otherwise) — `confirmed`/`called`/`expired` transitions only, via `NotificationService`'s template map.
- **Push**: `CustomerWebPushService.sendWaitingCalled` on the `called` transition (awaited inline, separate channel from the SMS background task).

### Cross-module dependencies

- `features/orders`'s underlying `OrderService` (`confirmWaitingListPreOrders`, `cancelWaitingListPreOrders`) — the pre-order linkage described above; this is the same `waitingListId` column referenced in `orders`' `CreateOrderData`.
- `packages/database`'s `ReservationService` is instantiated inside `WaitingListService`'s constructor (`this.reservationService = new ReservationService(...)`) but **is never called anywhere in the methods reviewed** — dead field, likely vestigial from when waiting-list and reservations shared more logic.
- `CustomerWebPushService`, `NotificationService`/`TwilioSMSProvider` (lazy-imported only when Twilio env vars are present).
- `middleware/rateLimit` (`strictRateLimit`, only on the `waiting-list` history-by-phone endpoint).

### Rust rewrite notes

- **`queue` vs `waiting-list` is a genuine duplicate-surface hazard for a rewrite**: don't port `queue`'s routes as if they were an independent feature with independent logic — they are a strict (and currently buggier, re: dropped background tasks) subset of `waiting-list`'s. Decide up front whether the Rust API preserves both HTTP surfaces (for client compatibility) while unifying the background-task handling, or deprecates one.
- **Runtime schema introspection**: `tableHasColumn` issues a live `PRAGMA table_info(tables)` on every `callWaiting`/`updateTableStatus` call to check whether optional columns (`waiting_list_id`, `reservation_id`) exist, rather than assuming a fixed schema shape. This reads like a migration-compatibility shim for environments at different migration checkpoints. A Rust port should treat the schema as fixed (both columns exist, per current `packages/database` schema) and drop the runtime check, *unless* the rewrite needs to run against older un-migrated databases too — confirm before dropping it.
- **No DB-level uniqueness backs the (restaurant, letter, business-day) queue-number sequence** — collision is possible under concurrent joins. If the Rust port cares about guaranteeing unique display codes, this needs a real sequence (e.g. `INSERT ... RETURNING` against a per-restaurant/day counter table, or a unique index + retry loop), not a `MAX()+1` read-then-write.
- **Optimistic-concurrency failures throw plain `Error`, not a typed/API error**, unlike `orders`' equivalent (`ORDER_VERSION_CONFLICT` → `conflict()` 409). A Rust port has a clean opportunity to normalize this into a proper 409 without changing correctness — but note that today's clients may not be handling a specific status code for this case anyway (it likely surfaces as a generic 500 today), so verify client expectations before "fixing" the status code.
- **Peak-hour wait-time adjustment uses the Workers isolate's local clock (`new Date().getHours()`)** with no restaurant-timezone parameter visible in this file — if restaurants operate across multiple timezones, this heuristic is silently wrong for any restaurant not in the server's assumed timezone. Worth flagging to product; port the exact (probably-wrong) current behavior unless told to fix it.

---

## 8. Reservations (`apps/api/src/features/reservations/`)

### Purpose

Advance table booking with confirmation codes, capacity-managed time slots, and an automatic table-assignment scoring algorithm. Structurally near-identical to Waiting List (same public/protected route split, same phone-normalization rules, same "release capacity + release table" pattern on cancel/no-show) but models a *future* reservation against pre-defined slot inventory rather than a live walk-in queue.

### Routes

Mounted at `/api/v1/reservations`, **public section**; the route file applies `app.use("/*", authMiddleware); app.use("/*", moduleGate("reservations"))` after 4 public routes.

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/v1/reservations` | none | Create a reservation | `CreateReservationRequest` | `ReservationResponse` (201) |
| GET | `/api/v1/reservations/verify/:code` | none | Look up by 6-digit confirmation code | — | `ReservationResponse` |
| GET | `/api/v1/reservations/availability` | none | Available time slots for a date+party size | query `restaurantId,date,partySize,duration?` | `AvailabilityResponse` |
| DELETE | `/api/v1/reservations/:id/cancel` | none — confirmation-code equality check in body | Cancel (self-service) | `{confirmationCode, reason?}` | `ReservationResponse` |
| — | *(auth boundary)* | | | | |
| GET | `/api/v1/reservations` | roles `[0,1,4]` | List/filter (admin cross-restaurant, others own-restaurant only) | query filters+pagination+sort | `{data, pagination}` |
| GET | `/api/v1/reservations/:id` | roles `[0,1,3,4]` + restaurant-match | Detail | — | `ReservationResponse` |
| PUT | `/api/v1/reservations/:id` | roles `[0,1,4]` + restaurant-match | Update reservation fields | `UpdateReservationRequest` | `ReservationResponse` |
| POST | `/api/v1/reservations/:id/confirm` | roles `[0,1,4]` | Manually (re-)confirm | — | `ReservationResponse` |
| POST | `/api/v1/reservations/:id/arrive` | roles `[0,1,3,4]` | Mark customer arrived (pre-seating) | — | `ReservationResponse` |
| POST | `/api/v1/reservations/:id/seat` | roles `[0,1,3,4]` | Mark seated | — | `ReservationResponse` |
| POST | `/api/v1/reservations/:id/complete` | roles `[0,1,3,4]` | Mark completed, releases table to `cleaning` | — | `ReservationResponse` |
| POST | `/api/v1/reservations/:id/no-show` | roles `[0,1,4]` | Mark no-show, releases slot capacity + table | — | `ReservationResponse` |
| GET | `/api/v1/reservations/stats/:restaurantId` | roles `[0,1]` + restaurant-match | Aggregate stats (no-show rate, avg party size, etc.) | query `date?` | `ReservationStats` |
| POST | `/api/v1/reservations/slots` | roles `[0,1]` | Create one time-slot capacity record | body | `ReservationSlot` |
| POST | `/api/v1/reservations/slots/batch` | roles `[0,1]` | Create slots across a date range × a list of time-of-day slots | `BatchCreateSlotsRequest` | `{created: count}` |

### Business logic (`packages/database/src/services/ReservationService.ts`)

- **Create** runs a five-step pipeline with **no batching/transaction across the steps**: (1) validate input (Taiwan-style `09XXXXXXXX` phone regex, `YYYY-MM-DD`/`HH:MM` format checks, reject past date-times); (2) `checkSlotAvailability` — a **separate read** of the `reservation_slots` row for `(restaurant, date, time)`, checking `is_available`, `remaining_tables = max_tables - current_reservations > 0`, and `remaining_capacity = max_capacity - current_capacity >= partySize`; (3) `assignTable` — scoring algorithm over currently-`available` tables (see below); (4) generate a 6-digit numeric confirmation code (`Math.floor(100000 + Math.random()*900000)` — not cryptographically random, but low-value to guess exhaustively at 900k combinations and rate-limited by "requires knowing the reservation exists"); (5) raw-SQL `INSERT` into `reservations`; (6) `incrementSlotUsage` — a **separate** `UPDATE reservation_slots SET current_reservations = current_reservations + 1, current_capacity = current_capacity + partySize` (own `try/catch`, swallows its own errors to a `console.error` rather than failing the whole reservation — so a slot-capacity increment failure leaves the reservation created but the slot's counters under-counted); (7) sets the table `reserved`; (8) **immediately auto-calls `confirmReservation` on the newly-created reservation** — every reservation is auto-confirmed synchronously as part of creation, there is no separate "pending, awaiting restaurant confirmation" workflow actually exercised end-to-end (the `pending` status exists transiently between steps 5 and 8 but a client can never observe a reservation sitting in `pending` from this flow).
- **Race window**: steps 2 (check) and 6 (increment) are two separate statements with no locking between them — two concurrent reservation requests for the same slot can both pass the availability check before either increments, allowing double-booking past the configured `max_tables`/`max_capacity`. This mirrors the same class of race noted in Waiting List's queue-numbering and Group Orders' join-capacity check — **a recurring pattern across this whole codebase area**: capacity/uniqueness invariants are enforced by check-then-write in application code, never by a DB constraint or a single atomic conditional update. A Rust port should treat "add a real constraint or atomic conditional UPDATE for capacity checks" as a cross-cutting hardening opportunity rather than a per-feature one-off.
- **`assignTable` scoring algorithm**: queries active, available tables with `capacity >= partySize`, computes a weighted score per table — capacity-match (40%, `100 - |capacity-partySize|*10`), space-utilization (30%, `partySize/capacity*100`), special-request feature match (20%, string-matches Chinese-language keywords `靠窗`/`無障礙`/`安靜` — "window seat"/"accessible"/"quiet" — against a `features` JSON column, all-or-nothing: any recognized keyword present sets the sub-score to 100, unmatched keywords contribute 0, there's no partial credit for matching only some requested features), and turnover-balance (10%, penalizes tables used more today, from a same-day-`orders`-count subquery) — then picks the single highest-scoring table. This is a real, if simple, allocation heuristic that must be ported faithfully (weights and formula) if reservation table assignment is expected to match historical behavior.
- **Notifications**: `confirmReservation`/`cancelReservation`/`markNoShow` each call `dispatchReservationNotification` (delegates to `ReservationNotificationService`, injectable via constructor for testing) — failures are caught and logged, never propagated (notification failure never fails the reservation mutation).
- **`markSeated`** has an explicit `// TODO: 自動建立訂單記錄` ("auto-create order record") comment — unlike Waiting List, reservations do **not** currently link to a pre-order or auto-materialize an `orders` row on seating; this is acknowledged-incomplete in the source.
- **`completeReservation`** releases the table to a `cleaning` status (distinct from Waiting List, which releases straight to `available`) — reservations assume a cleaning step between guests, waiting-list does not model one.

### Data

- **D1 tables**: `reservations`, `reservation_slots` (capacity buckets, not modeled as a Drizzle schema import in the reviewed file — accessed entirely via raw `sql` template strings, e.g. `SELECT * FROM reservation_slots WHERE ...`), `tables` (status/reservation_id linkage), and a same-day `orders` COUNT subquery used only for the table-scoring "turnover balance" factor.
- **KV**: none.
- **Realtime**: none — reservations do not broadcast to the realtime Durable Object at all (contrast with Waiting List, which broadcasts every transition to the `admin:{restaurantId}` room). Notifications are exclusively via `ReservationNotificationService` (SMS/other channel, implementation not reviewed in this pass).

### Cross-module dependencies

- `ReservationNotificationService` (`packages/database/src/services/ReservationNotificationService.ts`) — injectable, not reviewed in depth here.
- Reads `tables` schema (shared with Tables/Seats/Waiting List) and `orders` (read-only, for the scoring heuristic) but does **not** write to `orders` at all (unlike Waiting List's pre-order confirm/cancel linkage) — the `markSeated` TODO above confirms this integration was never finished.

### Rust rewrite notes

- **`reservation_slots` capacity bookkeeping is entirely raw-SQL, un-batched, and not atomic** — same class of finding as Waiting List's queue numbering; a Rust port targeting correctness under concurrency should replace the check-then-increment pair with a single conditional `UPDATE ... WHERE current_reservations < max_tables AND current_capacity + ? <= max_capacity RETURNING ...`, treating a zero-row result as "slot no longer available" instead of trusting the earlier read.
- **Auto-confirm on create means the `pending` status is not really a state a Rust port needs to expose an API for** — unless the intent is to add a real approval workflow later, `createReservation` can be modeled as directly producing a `confirmed` reservation.
- **Confirmation code is 6 random decimal digits, not scoped to be unique** — the code does not check for collisions against existing codes before assigning one; two different reservations could in principle receive the same confirmation code (especially once query volume is high), and `getReservationByCode`/`verify/:code` would then return whichever row the query engine returns first. Decide whether the Rust port adds a uniqueness constraint (recommended, since this code is the entire self-service auth mechanism for cancellation).
- **Table-assignment scoring is a pure function of DB state at call time** — good candidate for a well-tested, isolated Rust function; port the exact weights/formula (0.4/0.3/0.2/0.1) and the Chinese-keyword special-request matching verbatim, including its all-or-nothing (not partial-credit) scoring for multiple requested features.

---

## 9. Tables (`apps/api/src/features/tables/`)

### Purpose

Physical table inventory management: CRUD, occupy/release/clean lifecycle, HMAC-signed QR code generation (individual + bulk), availability/statistics queries, and public QR-scan lookup. Also owns the "table mode vs seat mode" switch that determines whether a physical table is ordered-against directly or decomposed into individual per-seat QR codes (see §10).

### Routes

Mounted at `/api/v1/tables`, **no blanket middleware** — every route declares `authMiddleware` itself except the public QR lookup.

| Method | Full path | Auth | Purpose | Request | Response |
|---|---|---|---|---|---|
| GET | `/api/v1/tables` | roles `[0,1,2,3,4]` + `moduleGate("table_management")` | List tables (filtered/paginated), non-admin forced to own restaurant | query filters | `{data, pagination}` |
| GET | `/api/v1/tables/available` | roles `[0,1,3,4]` | Tables currently free (and reservable), optionally by exact capacity | query `restaurantId,capacity?` | `Table[]` |
| GET | `/api/v1/tables/stats` | roles `[0,1]` | Occupancy/floor/section/capacity distribution stats | query `restaurantId` | `TableStats` |
| GET | `/api/v1/tables/:id` | roles `[0,1,2,3,4]` | Table detail (includes `seats[]` if in seat mode) | — | `Table` |
| POST | `/api/v1/tables` | roles `[0,1]` | Create table (optionally auto-creates seats if `qrMode:"seat"`) | `CreateTableInput` | `Table` (201) |
| PUT | `/api/v1/tables/:id` | roles `[0,1]` | Update table fields | `UpdateTableInput` | `Table` |
| DELETE | `/api/v1/tables/:id` | roles `[0,1]` | Soft-delete (`isActive=false`) | — | `{message}` |
| POST | `/api/v1/tables/:id/occupy` | roles `[0,1,3,4]` | Occupy with an order (accepts order UUID, order number, or client-mutation-id via `resolveOrderIdentity`) | `{orderId, occupiedBy?, estimatedMinutes?}` | `{message}` |
| POST | `/api/v1/tables/:id/release` | roles `[0,1,3,4]` | Release, updates rolling average occupancy time | — | `{message}` |
| POST | `/api/v1/tables/:id/clean` | roles `[0,1,3]` | Mark cleaned, store maintenance notes | `{notes?}` | `{message}` |
| POST | `/api/v1/tables/:id/regenerate-qr` | roles `[0,1]` | Bump QR version + re-sign | `{customData?}` | `{qrCode}` |
| POST | `/api/v1/tables/bulk-qr` | roles `[0,1]` | Regenerate QR for a list of table IDs in one call | `{restaurantId, tableIds, options?}` | `qrCodes[]` |
| GET | `/api/v1/tables/qr/:qrCode` | **none — genuinely public** | Scan-to-order lookup; returns only public fields | — | public table subset |

> Note: `moduleGate("table_management")` applies to **all 12 protected rows above** (registered per-route, 12 occurrences in `tables/routes/index.ts`), not just the first row — only the public `GET /qr/:qrCode` omits it.

### Business logic (`packages/database/src/services/table.ts`, wrapped by the thin `TablesService`)

- **QR codes are HMAC-signed URLs** (`buildSignedQRUrl` from `@makanmakan/utils`), keyed by `{type:"table", restaurantId, identifier: tableNumber, version}` and a server-side `QR_SIGNING_KEY` (hard-required to be ≥32 chars — the service throws rather than generating an unsigned/weak QR if the key is missing or too short). Every regenerate bumps `qrCodeVersion`; old QR codes are not tracked/invalidated anywhere except by version number no longer matching (there's no explicit "is this QR version still valid" check visible in this file — that enforcement, if any, must live in whatever consumes the signed URL).
- **Occupy/release** update `isOccupied`, `currentOrderId`, `occupiedAt`/`occupiedBy`, and (occupy only) `estimatedFreeAt = now + estimatedMinutes*60000` if provided. **Release computes a running average occupancy time** (`newAverage = (oldAverage*(totalUsage-1) + thisOccupancyMinutes) / totalUsage`, an incremental mean, not a stored sum/count pair) purely in application code from a read-then-write (no atomic increment for this specific stat, unlike `totalUsage` itself elsewhere which does use `sql\`col + 1\``).
- **`switchQRMode`** (table↔seat mode toggle) is a substantial method — refuses to switch a currently-occupied table to seat mode, refuses to switch a seat-mode table back to table mode if any of its seats are occupied, and on table→seat creates N seats via `SeatService.createSeatsForTable` (updates `tables.qrMode/seatCount/seatNumberingStyle`); on seat→table it **hard-deletes** all seat rows (`SeatService.deleteSeatsForTable`) rather than soft-deleting. **This method is never called from any route in the reviewed codebase (confirmed via grep across `apps/api/src`) — it is dead code from the HTTP surface's perspective**, even though it's fully implemented and reads as a core product feature ("let a store manager freely convert between table mode and seat mode", per its own doc comment). Either there's a caller elsewhere not covered by this review's file list, or this is a shipped-but-unwired feature.
- **`getTableOrderHistory`** exists on the DB-layer `TableService` but is not called from the `TablesService` wrapper or any route in this feature — another apparently-dead method.
- **Statistics** (`getTableStats`) is computed in exactly 2 queries (one conditional-aggregate `SELECT` for counts/occupancy-rate/avg-occupancy-minutes, one flat row-fetch for floor/section/capacity distributions, aggregated client-side into maps) — explicitly called out in a code comment as a deliberate reduction from "7 round trips."

### Data

- **D1 tables**: `tables` (primary), `restaurants` (`leftJoin` for display name), `orders` (read-only, for `getTableOrderHistory` — the dead method above).
- Delegates seat creation/deletion to `SeatService` (§10) during mode switching — the only cross-feature-service call in this file.
- **KV/Realtime**: none. Table state changes are not broadcast anywhere in this feature; any real-time table-occupancy awareness elsewhere in the system must be inferred from order-status broadcasts instead.

### Cross-module dependencies

- `shared/services/order-identity.ts` (`resolveOrderIdentity`) for the occupy route's flexible order-ID acceptance.
- `packages/database`'s `SeatService` (mode-switch only).
- `@makanmakan/utils`'s `buildSignedQRUrl` (shared QR-signing primitive, also used by `seat.ts`).

### Rust rewrite notes

- **Dead code (`switchQRMode`, `getTableOrderHistory`) should not be silently ported as unreachable Rust functions without flagging it** — confirm with the team whether table/seat mode switching is a planned-but-unshipped feature (in which case it needs a route) or truly abandoned (in which case don't carry the complexity forward).
- **QR signing key length/presence is a hard runtime precondition** (`throw` if missing or <32 chars) rather than a startup-time config validation — a Rust port should probably validate this once at boot instead of on every QR-generation call, but must preserve the "refuse to operate without a valid key" behavior.
- **Rolling average occupancy time is a read-modify-write, not atomic** — under concurrent occupy/release on the same table (unlikely in practice, since a table can only be occupied by one order at a time by the domain model, but worth noting) this could compute a slightly wrong average; low practical risk given the domain constraint, but flag if the Rust port changes concurrency assumptions.
- **Public QR lookup (`GET /tables/qr/:qrCode`) intentionally has zero auth requirement at every layer** (no blanket middleware on `/tables/*`, no per-route middleware on this one route) — this is the *reference* pattern for "public read via signed token" in this codebase; contrast directly with Seats below, which gets this wrong.

---

## 10. Seats (`apps/api/src/features/seats/`)

### Purpose

Per-seat QR codes and occupancy for tables in `qrMode:"seat"` (see §9) — lets each individual seat at a table have its own scannable QR code and independent order/occupancy tracking, for venues (e.g. bars, food courts) where "the table" isn't the right ordering unit.

### Routes

Mounted at `/api/v1/seats`. **Blanket `authMiddleware` applied to `/seats/*` in `app-factory.ts`**, in addition to route-level `authMiddleware` on every route except one.

| Method | Full path | Auth (as coded in the route file) | Effective auth (after the blanket middleware) | Purpose | Request | Response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/seats` | roles `[0,1,2,3,4]` + table-ownership check | same | List seats for a table | query `tableId` + filters | `{data, total, pagination}` |
| GET | `/api/v1/seats/stats` | roles `[0,1]` | same | Seat occupancy stats for a table | query `tableId` | `SeatStats` |
| GET | `/api/v1/seats/qr/:qrCode` | **none in this file** (clearly intended to mirror `tables/qr/:qrCode`'s public design) | **requires a valid staff/customer JWT (role ≤ 4), because `apiV1.use("/seats/*", authMiddleware)` runs first** | Scan-to-order lookup by seat QR code | — | public seat subset |
| GET | `/api/v1/seats/:id` | roles `[0,1,2,3,4]` + seat-ownership check | same | Seat detail | — | `Seat` |
| POST | `/api/v1/seats/batch-create` | roles `[0,1]` + table-ownership check | same | Bulk-create N seats for a table | `BatchCreateSeatsInput` | `Seat[]` (201) |
| POST | `/api/v1/seats/batch-regenerate-qr` | roles `[0,1]` + table-ownership check | same | Regenerate QR for every seat on a table | `{tableId}` | `qrCodes[]` |
| PUT | `/api/v1/seats/:id` | roles `[0,1]` + seat-ownership check | same | Update seat fields | `UpdateSeatInput` | `Seat` |
| DELETE | `/api/v1/seats/:id` | roles `[0,1]` + seat-ownership check | same | Soft-delete one seat | — | `{message}` |
| DELETE | `/api/v1/seats/table/:tableId` | roles `[0,1]` + table-ownership check | same | Hard-delete all seats for a table (mode-switch support) | — | `{message}` |
| POST | `/api/v1/seats/:id/occupy` | roles `[0,1,3,4]` + seat-ownership check | same | Occupy a seat with an order | `{orderId, occupiedBy?}` | `{message}` |
| POST | `/api/v1/seats/:id/release` | roles `[0,1,3,4]` + seat-ownership check | same | Release a seat | — | `{message}` |
| POST | `/api/v1/seats/:id/regenerate-qr` | roles `[0,1]` + seat-ownership check | same | Regenerate one seat's QR | — | `{qrCode}` |

**Finding — the seat QR public lookup is not actually public, unlike its table equivalent.** `app-factory.ts` applies `apiV1.use("/seats/*", authMiddleware)` unconditionally before mounting the seats routes (there is no analogous carve-out comment or route-ordering trick the way `/tables/*` deliberately has none). The route file's own `GET /qr/:qrCode` has no `authMiddleware` call, which only makes sense if the author expected it to be reachable without auth (exactly mirroring `tables/qr/:qrCode`, which genuinely is public because `/tables/*` has no blanket middleware) — but because the blanket middleware runs first for `/seats/*`, an anonymous diner scanning a seat QR code and hitting this endpoint directly (no bearer token) gets a 401 today, unlike scanning a table QR code. This looks like an unintentional regression/inconsistency introduced when the blanket `authMiddleware` was added for the *other* eleven seat routes (which do need it) without carving out this one — the same bug shape, and plausibly the same root cause, as the `/orders/*` vs `/orders/group/*` finding in §1/§2 (a prefix-wide `.use()` silently overriding a route file's own, more granular, auth story).

### Business logic (`packages/database/src/services/seat.ts`, wrapped by the thin route file directly — no intermediate `SeatsService` class; routes call `SeatService` methods directly)

- **`createSeatsForTable`**: validates the parent table exists, generates seat numbers per `numberingStyle` (`numeric`: zero-padded `01,02,...`; `alphabetic`: `A,B,...,Z,AA,BB,...` — note the alphabetic scheme *repeats* the letter for wraparound (`AA` not `AA`→`AB`, i.e. seat 27 is `AA` and seat 28 is `BB`, not a base-26 `AA,AB,...` sequence) or accepts caller-supplied `customNumbers` verbatim if the count matches exactly), generates one signed QR code per seat in parallel (`Promise.all`), then inserts all seat rows in a single batched `insert().values([...])` call (unlike most of `orders`, this bulk insert genuinely is one statement, not N).
- **Occupy/release**: same shape as Tables (`isOccupied`, `currentOrderId`, `occupiedAt`/`occupiedBy`, running `totalUsage` increment on release) but **`releaseSeat` computes `totalUsage + 1` via a read-then-write in application code**, whereas Tables' equivalent uses `sql\`col + 1\`` for the analogous `updateTableUsageStats` call — an inconsistent implementation of the same pattern between two structurally-identical services.
- **Dead code**: `updateSeatUsageStats` is a fully-implemented private method (re-reads current `totalUsage`, increments, writes back, swallows its own errors) that is **never called from anywhere in this file** — `occupySeat` does not call it (unlike Tables' `occupyTable`, which does call its usage-stats-update sibling). Likely a copy-paste-and-never-wired-up artifact from the Tables service.
- **QR regeneration** (single and batch) mirrors Tables exactly: bump `qrCodeVersion`, re-sign via the same `buildSignedQRUrl` helper with `type:"seat"`.

### Data

- **D1 tables**: `seats` (primary), `tables` (`leftJoin`, for `tableNumber`/`restaurantId`), `restaurants` (`leftJoin`, for display name) — the exact same three-table join shape as Tables' own `getTableById`.
- **KV/Realtime**: none, same as Tables.

### Cross-module dependencies

- `features/tables/services/TablesService` (`ensureTableAccess` calls `TablesService.getTableById`/`validateRestaurantAccess` to authorize seat operations against the parent table's restaurant, rather than re-implementing that check) — the one place Seats reaches into Tables rather than duplicating logic.
- `@makanmakan/utils`'s `buildSignedQRUrl` (shared with Tables).

### Rust rewrite notes

- **Fix, or deliberately preserve, the seat-QR-lookup auth regression** (see finding above) before porting — a straight 1:1 port of "what the code does today" means `GET /seats/qr/:qrCode` requires auth in the rewrite too, which is almost certainly not the intended product behavior and should be raised with the team rather than assumed to be correct.
- **Alphabetic seat numbering wraps as `AA`/`BB`/`CC`, not a base-26 `AA,AB,AC,...` sequence** — reproduce the exact `letter.repeat(Math.floor(i/26)+1)` formula if seat-numbering output must match existing generated QR codes/labels for tables that already have >26 seats.
- **`updateSeatUsageStats` dead code and the `totalUsage` read-then-write vs `sql\`+1\`` inconsistency with Tables** are both minor, but indicate the two services were forked/copied rather than sharing a common "occupiable entity" abstraction — a Rust port has a natural opportunity to unify Tables' and Seats' occupy/release/usage-stats logic behind one generic implementation, if that refactor is in scope.
- **No `SeatsService`-equivalent thin wrapper class exists** (unlike every other feature in this document) — routes call `SeatService` (the `packages/database` class) directly. Not a problem, just note that "does this feature have a route-layer service wrapper" is not a reliable assumption to carry into the Rust module layout.

---

## Summary of cross-cutting patterns for the Rust rewrite

1. **Money**: integer cents columns (`*_cents`) everywhere, converted to/from decimal-dollar floats only at the API boundary via `packages/database/src/utils/money.ts` (`toCents`/`fromCents`/`toRequiredCents`/`amountFromCents`). Preserve integer-cents as the canonical in-process representation; do not introduce floats into any calculation path.
2. **Timestamps**: `INTEGER … {mode:'timestamp_ms'}` columns (Unix ms) everywhere; wire contract is also Unix-ms integers, and at least one module (`orders`) has an explicit compatibility shim (`serializeOrderForWire`) purely to stop a `Date` object silently serializing as an ISO string. A Rust port serializing directly from an integer column sidesteps this footgun but must still emit the same ms-integer wire shape.
3. **Concurrency control is exclusively "conditional UPDATE + check rows-affected"** (D1/SQLite has no row locking and no interactive multi-statement transactions from Workers — `db.batch()` is the only atomic-commit primitive, and it batches independent statements, it is not a session with intermediate reads). This pattern appears, with varying error-handling maturity, in: `orders` (typed 409 on conflict), `waiting-list` (plain `Error`, likely surfaces as 500), `pos` shift-close (no conflict handling visible), and is *notably absent* (i.e. a real TOCTOU race exists) in: `group-orders`' join-capacity/name-uniqueness checks, `reservations`' slot-capacity checks, and `waiting-list`'s queue-number generation. Treat "replace check-then-write capacity/uniqueness logic with a single conditional UPDATE, everywhere it currently isn't" as one cross-cutting hardening task for the rewrite, not ten separate ones.
4. **Two confirmed routing/auth bugs from a shared root cause** (a prefix-wide `apiV1.use("/X/*", middleware)` in `app-factory.ts` silently overriding a more specific route file's own, more permissive, auth design): `/orders/*` blanket auth defeats `group-orders`' anonymous-join-by-share-code flow (§1/§2) and (independently) makes `orders/guest*` unreachable in favor of the separately-mounted `guest-orders` feature (§1/§3); `/seats/*` blanket auth defeats the one intentionally-public seat-QR-lookup route (§10). Both need a product decision (fix vs. preserve) before the Rust rewrite locks in its auth model — a naive line-by-line port would reproduce both bugs faithfully, which may or may not be desired.
5. **Fire-and-forget `setTimeout` for simulated async completion** (POS refund completion, POS receipt "printing") is not `waitUntil`-wrapped and is very likely non-functional on the Workers runtime today — flag rather than silently port or silently "fix."
6. **`queue` is a lossy compatibility subset of `waiting-list`** over the same underlying service — it drops SMS background-task delivery entirely (never drains/`waitUntil`s them) where `waiting-list`'s own route file does this correctly.
7. **Raw/hand-written SQL bypasses the project's stated "no raw SQL, reference Drizzle schema objects" policy** in several places relevant to this document: `kitchen`'s `getScopedKitchenItem` (the actual authorization gate for item-status writes), and large portions of `WaitingListService`/`ReservationService` (mixed — some queries reference Drizzle schema columns, most use raw string column names in `sql` template literals). A schema rename in `tables`/`orders`/`order_items`/`waiting_list`/`reservations` would fail silently at runtime, not at compile time, in these spots — worth an explicit audit pass before or during the Rust port, since Rust's type system can enforce this far more strongly than TypeScript did here if the port uses a compile-time-checked query layer (e.g. `sqlx` with `query!`/`query_as!` macros) consistently.
8. **Dead code accumulates in pairs across near-duplicate services**: `TableService.switchQRMode`/`getTableOrderHistory` (unreachable from any route) and `SeatService.updateSeatUsageStats` (unreachable, and its absence causes a real behavioral inconsistency — seats never accumulate the same rolling usage stat that tables do). Don't assume "fully implemented service method" implies "reachable from the API" when scoping the Rust port's surface area — grep call sites, not just definitions.
