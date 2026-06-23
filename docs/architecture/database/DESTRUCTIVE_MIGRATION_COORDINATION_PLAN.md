# Destructive Migration Coordination Plan

**Date:** 2026-06-23
**Status:** Planning only; no new destructive SQL generated

## Objective

Coordinate the in-flight money-cents retirement with the upcoming UUID v7
primary-key migration so destructive database work is sequenced, rehearsed, and
auditable.

There are two different classes of destructive work:

- Money-cents retirement drops legacy non-key `REAL` columns after cents and
  bps fields are authoritative.
- UUID primary-key migration rebuilds `orders`, `users`, and dependent foreign
  key tables after bridge identifiers have been shipped and runtime contracts
  no longer depend on integer ids.

These must not be bundled into one migration. Money-cents cutover touches
business money columns. UUID primary-key work changes identity, foreign keys,
JWT claims, route parameters, cache keys, and realtime payloads.

## Current Decision

Run the money-cents destructive cutover before any UUID primary-key table
rebuild.

Rationale:

- The money cutover already has paired migration artifacts:
  `packages/database/migrations_fresh/0070_money_cents_cutover.sql` and
  `packages/database/migrations/0087_money_cents_cutover.sql`.
- The approved money cutover method is `ALTER TABLE ... DROP COLUMN`, not a
  create-copy-rename table rebuild.
- Dropping non-key legacy money columns first reduces the surface area that a
  later `orders` rebuild must preserve.
- The UUID work still needs bridge columns, application compatibility, and
  table-by-table rebuild rehearsal before integer primary keys can be retired.

If a later discovery shows an application path still requires a legacy `REAL`
money column, stop the money cutover and fix that path. Do not use the UUID
rebuild as a workaround for money-field cleanup.

## Global Gates

Before any destructive migration reaches production:

- Capture a current D1 backup or export for the target environment.
- Prove the backup can be restored into a drill database.
- Run the migration against a restored drill database or staging database.
- Capture before/after row counts for every touched table.
- Run `PRAGMA foreign_key_check` after the migration.
- Run schema-shape checks that verify removed columns are absent and retained
  columns, indexes, constraints, and triggers still exist.
- Keep the migration isolated to one domain: money cutover, order-id rebuild,
  or user-id rebuild.
- Keep rollback instructions tied to restore evidence, not hand-written inverse
  SQL for destructive drops or rebuilds.

## Phase A: Money-Cents Drop-Column Cutover

Source runbook:
`docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md`.

Scope:

- Drop only retired legacy `REAL` money and polymorphic discount columns.
- Retain integer cents and basis-point fields.
- Drop obsolete sync triggers and legacy money indexes.
- Recreate required indexes and triggers against cents / bps columns.
- Assert row counts and foreign-key integrity.

Required prechecks:

- `0067_money_cents_retirement_rollout_guard.sql` has passed staging and
  production.
- `0069_discount_percentage_bps.sql` / `0086_discount_percentage_bps.sql` have
  passed staging and production.
- Production `money_cents_retirement_rollout` rows have
  `violation_count = 0`.
- Production percentage-bps mismatch rows have `violation_count = 0`.
- Drizzle schema and production write paths no longer require retired legacy
  `REAL` columns.

Execution order:

1. Leaf/search/inventory: `dish_search_index`, `ingredient_definitions`.
2. Scheduling: `shift_templates`.
3. Partnerships: `partnership_usage_logs`, `partnership_plans`,
   `verified_members`, `partnerships`.
4. Group ordering: `group_cart_items`, `split_bills`, `group_orders`.
5. Coupon/order: `coupon_usage`, `order_items`, `coupons`, `orders`.
6. POS: `cash_movements`, `refunds`, `cash_shifts`.

Verification commands:

```bash
rtk pnpm check:migration-dual-track
rtk pnpm exec vitest run packages/database/src/schema/money-cents-cutover.test.ts
rtk pnpm db:migrate:local
```

Production requires the remote audit queries from
`MONEY_CENTS_FIELD_RETIREMENT.md` before applying the cutover migration.

## Phase B: Orders UUID Bridge

This phase is not destructive. It prepares the runtime for a later `orders`
primary-key rebuild.

Scope:

- Add a stable `orders.public_id TEXT UNIQUE` bridge identifier.
- Backfill existing rows with UUID v7 values.
- Add lookup helpers that accept either numeric `orders.id` or
  `orders.public_id`.
- Start emitting UUID order identifiers from public/customer/kitchen/payment/POS
  and realtime contracts where feasible.
- Keep numeric ids available internally during the compatibility window.

High-risk runtime paths to audit:

- order creation and item insertion,
- kitchen order status updates,
- payment authorization, refund, and reconciliation,
- POS receipts and market-checkout child order settlement,
- coupon usage,
- table/seat current-order pointers,
- group-order finalization,
- platform order links,
- realtime order cache keys and payloads.

Acceptance:

- New outward-facing order contracts can carry UUIDs.
- Existing numeric order inputs still resolve through compatibility lookup.
- Tests cover both numeric and UUID order identifiers on critical routes.
- No table rebuild is generated in this phase.

## Phase C: Orders Primary-Key Rebuild Drill

This is destructive and must wait until Phase B is accepted.

Tables known to reference `orders.id` or carry order pointers include:

- `order_items.order_id`
- `payment_transactions.order_id`
- `refund_transactions.order_id`
- `receipts.order_id`
- `refunds.original_order_id`
- `platform_orders.order_id`
- `partnership_usage_logs.order_id`
- `coupon_usage.order_id`
- `market_checkout_child_orders.order_id`
- `group_orders.master_order_id`
- `tables.current_order_id`
- `seats.current_order_id`

Drill requirements:

- Rebuild `orders` with UUID v7 `TEXT` primary key only after all dependent
  tables have a deterministic mapping from old integer ids to UUIDs.
- Rebuild dependent FK tables in an order that preserves referential integrity.
- Preserve indexes, unique constraints, defaults, generated columns, triggers,
  soft-delete columns, and timestamp columns.
- Snapshot row counts before and after each table rebuild.
- Run `PRAGMA foreign_key_check` after each component and at the end.
- Validate application reads against UUID ids while numeric compatibility is
  still available through the bridge.

## Phase D: Users UUID Bridge

This phase is not destructive. It prepares auth and staff identity for a later
`users` primary-key rebuild.

Scope:

- Add `users.public_id TEXT UNIQUE`.
- Backfill existing staff users with UUID v7 values.
- Issue new staff JWTs with string principal identity while accepting legacy
  numeric ids during a bounded compatibility window.
- Update `AuthUser`, auth middleware, realtime auth, session keys, cache keys,
  audit actor fields, and test helpers.
- Keep the customer identity fork out of this phase unless a path still
  incorrectly treats `users.role = 5` as customer identity.

Acceptance:

- Auth middleware accepts the new staff principal identity.
- Legacy numeric JWT compatibility is deliberate and covered by tests.
- New sessions and refresh-token flows no longer require numeric `users.id`.
- No staff FK table rebuild is generated in this phase.

## Phase E: Users Primary-Key Rebuild Drill

This is destructive and must wait until Phase D is accepted.

Tables and columns to audit include:

- `sessions.user_id`
- password, email, phone, and password-change verification token user ids
- POS approval fields such as `cash_movements.approved_by` and
  `refunds.approved_by`
- `group_members.user_id`
- `partnership_usage_logs.verified_by_user_id`
- feedback and error-report user ids
- coupon usage / route-layer user ids that still bind to staff users
- scheduling, leave, and audit actor fields that store staff principals

Drill requirements:

- Rebuild `users` and dependent tables only after runtime code resolves staff
  principals through the UUID bridge.
- Preserve compatibility for legacy numeric JWTs until they expire naturally or
  a planned invalidation window is approved.
- Separate customer identity cleanup from staff-user PK retirement unless an
  audited FK forces a shared migration.
- Verify auth, management API auth, realtime auth, and session cleanup against
  restored data.

## Required Tracking Updates

- Keep `integer-primary-key-policy.json` phase markers for `orders` and
  `users` until the bridge phases are complete.
- Add future phase markers for destructive rebuild drills only when those
  migrations are ready to be rehearsed.
- Keep `MONEY_CENTS_FIELD_RETIREMENT.md` as the money cutover source of truth.
- Keep this coordination plan as the cross-epic sequencing document.

## Non-Goals

- No production destructive migration is run from this plan.
- No integer primary key is dropped yet.
- No JWT compatibility policy is changed yet.
- No customer identity migration is folded into staff `users.id` work without a
  separate approved plan.
