# UUID v7 Primary Key Migration Drill

**Date:** 2026-06-23
**Status (updated 2026-07-05): SHIPPED.** `orders.id` and `users.id` are both
`text("id")` UUID v7 in current schema (`packages/database/src/schema/orders.ts:45`,
`users.ts:22` — landed via commit `43b024ff feat(database): reset users and
orders to uuid primary keys`, with staff UUID auth tokens/sessions issued and
accepted across `apps/api`, `apps/management-api`, and `apps/realtime`). The
"Current State" section below describes the pre-migration snapshot this drill
was written against — kept for historical context, not current fact.

## Objective

Move the highest-risk legacy integer primary keys toward UUID v7 `TEXT`
identities without doing an unsafe all-at-once table rebuild. The first targets
are:

- `orders.id` because order ids are public/workflow identifiers across
  customer, kitchen, payment, POS, realtime, and marketplace flows.
- `users.id` because staff users are security principals embedded in JWTs and
  referenced by staff, scheduling, audit, POS, session, and verification flows.

Success means each target can be migrated through a bridge phase with stable
public UUID identifiers, compatibility for existing numeric references, and a
verified D1 table-rebuild plan before the integer primary key is retired.

## Current State

- New durable domain tables should use UUID v7 `TEXT` primary keys.
- Existing integer primary keys are inventoried in
  `integer-primary-key-policy.json`.
- The inventory currently classifies 27 tables as `legacy_domain` /
  `migrate_to_uuid_v7`.
- `orders.customer_id`, `waiting_list.customer_id`, and
  `reservations.customer_id` already use `TEXT` references to `customers.id`.
- `orders.id` remains `INTEGER AUTOINCREMENT`.
- `users.id` remains `INTEGER AUTOINCREMENT`.
- Staff JWTs still carry numeric `id`; `apps/api/src/middleware/auth.ts` and
  `apps/api/src/features/realtime/services/RealtimeAuthService.ts` still require
  integer ids.

## Commands

- Inventory guard:
  `pnpm exec vitest run tests/unit/database-primary-key-policy.test.ts`
- Database typecheck:
  `pnpm --filter @makanmasak/database run typecheck`
- API typecheck:
  `pnpm --filter @makanmasak/api run typecheck`
- Full migration rehearsal later:
  `pnpm db:migrate:local`

## Project Structure

- Policy:
  `docs/architecture/database/INTEGER_PRIMARY_KEY_POLICY.md`
- Machine-readable inventory:
  `docs/architecture/database/integer-primary-key-policy.json`
- Drill plan:
  `docs/architecture/database/UUID_V7_PK_MIGRATION_DRILL.md`
- Schema:
  `packages/database/src/schema/`
- Auth boundary:
  `apps/api/src/middleware/auth.ts`
- Realtime auth boundary:
  `apps/api/src/features/realtime/services/RealtimeAuthService.ts`
- Tests:
  `tests/unit/database-primary-key-policy.test.ts`

## Phase 1: `orders-public-id-bridge`

Do not rebuild `orders` first. Add a stable UUID v7 public identifier bridge
before changing the primary key.

1. Add `orders.public_id TEXT UNIQUE` or equivalent bridge column.
2. Backfill existing orders with UUID v7 values.
3. Add compatibility lookup helpers so APIs can resolve either numeric
   `orders.id` or UUID `orders.public_id`.
4. Convert public/customer/kitchen/payment/realtime contracts to emit the UUID
   while retaining numeric ids only where internal writes still need them.
5. Add audit coverage for every FK or raw SQL path that still relies on
   `orders.id`.
6. Rehearse a D1 table rebuild that converts FK columns referencing orders from
   `INTEGER` to `TEXT`, preserving indexes, constraints, triggers, row counts,
   and `PRAGMA foreign_key_check`.

Acceptance for phase 1:

- New public API responses and realtime events can carry order UUIDs.
- Existing numeric order routes still work through compatibility lookup.
- No destructive rebuild runs until restored-production drill has backup/restore evidence.

## Phase 2: `staff-principal-id-bridge`

Migrate staff/user identity separately from orders. This should not be bundled
with phase 1 because auth failures have a wider blast radius than order lookup
compatibility.

1. Add `users.public_id TEXT UNIQUE` or equivalent bridge column.
2. Backfill existing staff users with UUID v7 values.
3. Issue new staff JWTs with a string subject while accepting legacy numeric
   `id` during a compatibility window.
4. Update `AuthUser`, auth middleware, realtime auth, session/cache keys, and
   audit actor fields to support the bridge identity.
5. Convert staff-facing FK columns only after all runtime reads can resolve the
   bridge identity.
6. Rehearse a D1 table rebuild for `users` and dependent FK tables with
   row-count and FK assertions.

Acceptance for phase 2:

- New staff JWTs no longer depend on enumerable integer ids.
- Legacy numeric JWTs expire naturally or are deliberately invalidated.
- Realtime auth and admin/API auth agree on the same staff principal identity.

## Boundaries

- Always: add bridge identifiers before destructive table rebuilds.
- Always: preserve numeric compatibility during the rollout window.
- Always: run local D1 migration rehearsal with row-count and FK checks.
- Ask first: dropping integer primary keys, invalidating existing JWTs, or
  changing public route parameter shapes.
- Never: perform a production table rebuild without backup/restore evidence.

## Risks

- `orders.id` is referenced by payment, POS, coupons, order items, partnership
  usage logs, platform orders, seats/tables current order pointers, and realtime
  payloads.
- `users.id` is referenced by JWTs, sessions, audit logs, scheduling, leave,
  POS cashier/approval fields, verification tokens, and staff/customer legacy
  compatibility paths.
- D1 table rebuilds are destructive unless every index, trigger, default,
  unique constraint, and FK is recreated correctly.
- This overlaps with money-cents table rebuild work on `orders`, so final
  destructive migrations should be coordinated.

## Success Criteria

- `integer-primary-key-policy.json` marks `orders` and `users` with explicit
  phase names and ordering.
- The unit guard fails if those phase markers are removed.
- A future implementation can start with phase 1 bridge columns without
  touching `users.id` or staff JWTs.
