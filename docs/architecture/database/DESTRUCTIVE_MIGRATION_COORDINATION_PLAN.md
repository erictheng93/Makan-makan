# Destructive Migration Coordination Plan

**Date:** 2026-06-24
**Status:** UUID primary-key bridge/rehearsal track superseded by greenfield
UUID-native reset; no remote D1 destructive migration run

## Objective

Coordinate destructive database work. The previous UUID v7 primary-key bridge
and rehearsal track is superseded by the greenfield UUID reset plan because
there is no representative production data to preserve.

There are two different classes of destructive work:

- Money-cents retirement drops legacy non-key `REAL` columns after cents and
  bps fields are authoritative.
- UUID primary-key reset makes `orders`, `users`, `platform_orders`, and their
  dependent foreign keys UUID-native at schema creation time.

These must not be bundled into one migration. Money-cents cutover touches
business money columns. UUID primary-key work changes identity, foreign keys,
JWT claims, route parameters, cache keys, and realtime payloads.

## Current Decision

Run the UUID primary-key work as a greenfield reset, not as public-id bridge
cutover rehearsals. The active UUID plan is
`docs/architecture/database/GREENFIELD_UUID_PK_RESET_PLAN.md`.

Rationale:

- The money cutover already has paired migration artifacts:
  `packages/database/migrations_fresh/0070_money_cents_cutover.sql` and
  `packages/database/migrations/0087_money_cents_cutover.sql`.
- The approved money cutover method is `ALTER TABLE ... DROP COLUMN`, not a
  create-copy-rename table rebuild.
- Dropping non-key legacy money columns first reduces the surface area that a
  later `orders` rebuild must preserve.
- The UUID work no longer needs bridge columns or table-by-table rebuild
  rehearsal because resettable environments can start in the final shape.

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
6. POS / market checkout: `market_checkout_child_orders`, `cash_movements`,
   `refunds`, `cash_shifts`.

Progress:

- 2026-06-23: Added migration-test coverage that requires each schema cutover
  surface to appear in its owning paired SQL files with before/after row-count
  guards and explicit `ALTER TABLE ... DROP COLUMN` statements.
- 2026-06-23: Confirmed `market_checkout_child_orders.total_amount` belongs to
  its dedicated `0071` / `0088` market-checkout cutover migration, not the main
  `0070` / `0087` money cutover. The test now covers that dedicated pair so a
  future edit cannot silently drop the table from cutover verification.
- 2026-06-23: Repo-level verification passed for the cutover schema test,
  migration dual-track guard, and database package typecheck. Local
  `db:migrate:local` was executable but reported no migrations to apply, so a
  fresh/restored D1 drill remains required before staging or production cutover.

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

Progress:

- 2026-06-23: Added the first non-destructive `orders.public_id` bridge:
  Drizzle schema now has a transitional nullable `public_id` with a runtime
  UUID v7 default and a partial unique index; paired migrations `0072` / `0089`
  add the column, backfill existing rows with UUID-v7-shaped values derived
  from `created_at_ms`, and assert no missing or duplicate backfill values.
- 2026-06-23: Kept the database column nullable during the bridge phase on
  purpose. This avoids breaking raw SQL insert paths that do not yet pass
  `public_id`; later convergence work must audit those paths before a not-null
  rebuild or trigger can be introduced.
- 2026-06-23: Local D1 apply ran successfully for
  `0072_orders_public_id_bridge.sql`; schema bridge tests, money cutover
  regression tests, integer-PK policy tests, migration dual-track guard, and
  database package typecheck passed.
- 2026-06-23: Audited production order insert paths. `OrderService.createOrder`
  and `PlatformOrderService` are the production writers found by repo search;
  both use Drizzle `.insert(orders)` and therefore receive the runtime
  `public_id` default. Direct `INSERT INTO orders` matches are limited to old
  rebuild migrations and tests/benchmark stubs.
- 2026-06-23: Added a shared API `resolveOrderIdentity` helper that resolves
  numeric `orders.id`, `orders.public_id`, `orders.order_number`, and
  `orders.client_mutation_id` to a canonical numeric row under restaurant
  scope.
- 2026-06-23: Wired UUID-compatible order lookup into payments, POS receipt
  printing, POS refund creation, kitchen item-status updates, and table
  occupation while preserving numeric compatibility for existing callers.
  Touched responses now include `orderPublicId` where the route already has a
  resolved order identity.
- 2026-06-23: Added paired `0073` / `0090` audit guard migrations for
  `orders.public_id` missing, duplicate, and malformed values. These write
  `orders_public_id_bridge` rows into `data_integrity_audit` and fail when
  violations are nonzero.
- 2026-06-23: Updated realtime order paths for UUID compatibility. The
  database realtime status workflow now resolves numeric `orders.id` or
  `orders.public_id`, writes both numeric and UUID `order_status:*` cache
  aliases when available, and emits `orderPublicId` beside the legacy numeric
  `orderId`. Guest realtime token validation and the realtime Durable Object
  now accept scoped `order:<public_id>` customer rooms while preserving legacy
  table-room tokens.

Completion evidence:

- Production order writers have been audited for the bridge phase; the runtime
  writers found by repo search use Drizzle `.insert(orders)` and receive the
  `public_id` default.
- Critical order lookup routes now have focused numeric and UUID coverage:
  payments, POS receipt printing, POS refund creation, kitchen item-status
  updates, table occupation, guest realtime token validation, and realtime
  status cache/event updates.
- Verification gates passed for the Phase B implementation: focused Vitest
  coverage, API/database/realtime typecheck, migration dual-track guard,
  Prettier check, and `git diff --check`.

## Phase C: Orders Primary-Key Rebuild Drill (Superseded)

Superseded on 2026-06-24 by the greenfield UUID reset decision. Do not continue
adding bridge or rehearsal tooling for `orders.public_id`; the target is
`orders.id TEXT PRIMARY KEY` from creation time.

This is destructive and starts only after Phase B is accepted.

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

Next execution queue:

- Produce a dependency map for every `orders.id` foreign key and order pointer,
  including row counts, indexes, triggers, and application write paths.
- Draft a dry-run rebuild script that creates shadow tables, copies data using
  `orders.public_id` as the target key, checks row counts and foreign keys, and
  rolls back without modifying production tables.
- Rehearse the rebuild locally against D1 data after the dry-run script and
  audit queries are reviewable.
- Only convert the rehearsal into paired migrations after the dry-run evidence
  proves row-count parity, `PRAGMA foreign_key_check` success, and application
  compatibility through the UUID bridge.

Progress:

- 2026-06-23: Added
  `docs/architecture/database/ORDERS_UUID_PK_PHASE_C_DEPENDENCY_MAP.md` with
  the current order FK/pointer map, local row-count evidence, indexes, triggers,
  and write paths. The map covers 12 local dependency surfaces and keeps
  `order_status_history.order_id` / `customer_reviews.order_id` as legacy
  migration surfaces to introspect when present.
- 2026-06-23: Added `scripts/phase-c-orders-pk-dry-run.cjs` and
  `rtk pnpm db:orders-pk-dry-run`. The script prints review SQL and runs a
  local SQLite transaction rehearsal using TEMP shadow tables, row-count
  parity checks, `orders.public_id` bridge checks, `PRAGMA foreign_key_check`,
  and rollback.
- 2026-06-23: Local rehearsal passed on the current Miniflare D1 state. The
  baseline run checked 12 existing dependency surfaces and returned 0 missing
  or duplicate `orders.public_id` values, 0 unmapped order references, and 0
  `foreign_key_check` rows. The synthetic `--with-fixture` run inserted one
  rollback-only order and one dependent row per existing surface; every
  checked surface mapped 1 / 1 order references, `foreign_key_check` stayed
  empty, and rollback verification found no persisted `phase-c-orders-pk-*`
  rows. A staging or production-like data rehearsal is still required before
  paired migrations are generated.
- 2026-06-23: Added `--json-output` support to
  `scripts/phase-c-orders-pk-dry-run.cjs` so local, staging, and restored-prod
  drill results can be archived as JSON evidence while preserving stdout.
- 2026-06-23: Added a representative-data gate to the Phase C dry-run. The
  script now records `dataCoverage` and `assessment` in JSON artifacts, and
  `--require-representative-data` fails if the rehearsal has no `orders` rows
  or no non-null checked order dependency references. The current empty local
  baseline still proves safety/schema coverage only; the rollback fixture run
  passes the gate with 1 order, 12 dependency refs, zero unmapped refs, and zero
  foreign-key-check rows.
- 2026-06-23: Added `--require-complete-surface-coverage` to the Phase C
  dry-run and exposed the synthetic full-surface command as
  `rtk pnpm db:orders-pk-dry-run:fixture-full-surface`. The rollback fixture
  now fails unless every existing dependency surface has at least one non-null
  order reference and emits `schemaObjects` metadata for preserving
  indexes/triggers in the paired migration draft.
- 2026-06-23: Extended the Phase C artifact with `appCompatibility` counters.
  The strict rollback fixture now proves checked orders can be resolved through
  both legacy `orders.id` and `orders.public_id`, and that every shadow-copy
  `order_public_id` resolves back to the source order row before migration
  drafting starts.
- 2026-06-23: Added `scripts/validate-pk-rehearsal-artifact.cjs` and
  `rtk pnpm db:pk-rehearsal:validate` so archived Phase C rehearsal evidence is
  machine-gated before paired migrations are drafted.
- 2026-06-23: Hardened the shared artifact validator so it recomputes
  root-table row counts, dependency-surface coverage, and non-null reference
  coverage from the artifact instead of trusting `dataCoverage.isRepresentative`
  alone.
- 2026-06-23: Phase C and Phase E artifacts now record `rehearsalOptions`, and
  the shared validator rejects archived evidence that was not produced with the
  required strict gate flags.
- 2026-06-23: Phase C and Phase E artifacts now also record `artifactPhase`, and
  the shared validator rejects missing or mismatched artifact phases.
- 2026-06-23: Phase C and Phase E artifacts now record
  `artifactSchemaVersion = 1`; the shared validator rejects archived evidence
  with missing or unsupported artifact schema versions.
- 2026-06-23: Added artifact role validation to the shared validator. Phase C
  migration reviewers can now require `--role representative` for
  staging/restored-production evidence and `--role fixture` for the local
  rollback full-surface artifact, preventing synthetic fixture data from being
  substituted for representative data.
- 2026-06-24: Added `scripts/verify-phase-c-orders-pk-readiness-manifest.cjs`
  and `rtk pnpm db:orders-pk-readiness:verify`. The verifier reads one
  manifest, validates the representative and full-surface fixture artifacts via
  their role gates, and blocks Phase C migration drafting if dependency
  surfaces or schema metadata drift between the two evidence files.
- 2026-06-24: Corrected Phase C package-script naming so
  `rtk pnpm db:orders-pk-dry-run:representative` no longer generates fixture
  data. The synthetic local full-surface run is now explicitly named
  `rtk pnpm db:orders-pk-dry-run:fixture-full-surface`.

Current blocker before paired Phase C migrations:

- Run the same gated dry-run against restored production or staging data with
  non-empty representative order volume.
- Archive the JSON artifact and confirm `assessment.exitCode = 0`,
  `assessment.failures = []`, `dataCoverage.isRepresentative = true`, zero
  bridge violations, zero unmapped refs, zero `appCompatibility` mismatches,
  and zero `foreignKeyCheck` rows.
- Run
  `rtk pnpm db:pk-rehearsal:validate -- --phase orders --artifact <archived-json> --role representative`
  and require validator `exitCode = 0`.
- Keep the full-surface rollback fixture artifact alongside the staging or
  restored-production artifact so migration reviewers can verify every checked
  dependency surface has copy coverage and schema preservation metadata.
- Run
  `rtk pnpm db:pk-rehearsal:validate -- --phase orders --artifact <fixture-json> --role fixture`
  against that local full-surface fixture artifact.
- Create the Phase C readiness manifest and run
  `rtk pnpm db:orders-pk-readiness:verify -- --manifest <manifest-json>`;
  require validator `exitCode = 0`.
- Only then draft paired Phase C rebuild migrations from the dry-run plan.

## Phase D: Users UUID Bridge

This phase is not destructive. It prepares auth and staff identity for a later
`users` primary-key rebuild.

Detailed plan:
`docs/architecture/database/USERS_UUID_AUTH_PHASE_D_PLAN.md`.

Scope:

- Add `users.public_id TEXT UNIQUE`.
- Backfill existing user rows with UUID v7 values.
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

Progress:

- 2026-06-23: Added
  `docs/architecture/database/USERS_UUID_AUTH_PHASE_D_PLAN.md` with the
  current integer-id auth blockers, bridge identity contract, implementation
  slices, and destructive Phase E gates. The plan keeps this phase
  non-destructive and explicitly preserves legacy numeric JWT compatibility
  until tests and token issuance are migrated.
- 2026-06-23: Started D1 schema bridge implementation. Drizzle now exposes a
  nullable `users.public_id` with UUID-v7 runtime default and partial unique
  index; paired migrations `0074` / `0091` add and backfill the column, and
  paired audit guards `0075` / `0092` fail on missing, duplicate, or malformed
  bridge identifiers. Auth/JWT compatibility code is still pending.
- 2026-06-23: Added the first D2 staff principal resolver at
  `apps/api/src/shared/services/staff-principal.ts`. It accepts legacy numeric
  ids or UUID-v7-shaped `users.public_id`, returns both legacy and public
  identities, and now backs the existing API auth numeric user loader without
  changing JWT claim parsing. UUID-principal JWT parsing and token issuance
  remain pending.
- 2026-06-23: Started D3 API auth compatibility. Staff JWT parsing now accepts
  either legacy numeric `id` or UUID-v7-shaped `sub`; UUID tokens resolve
  through `users.public_id` and still attach legacy numeric `AuthUser.id` for
  downstream FK-backed services. Login/refresh token issuance remains legacy
  numeric until D4.
- 2026-06-23: Started D4 token issuance. `AuthService` login and refresh
  rotation now emit UUID-principal access/refresh tokens when `users.public_id`
  exists, while legacy numeric refresh tokens still rotate successfully through
  the existing integer `sessions.user_id` bridge. `validateToken` now accepts
  UUID-principal access tokens.
- 2026-06-23: Started D5 realtime compatibility. `RealtimeAuthService` now
  accepts UUID-principal session JWTs, resolves them through `users.public_id`,
  and emits `publicUserId` beside legacy numeric `userId` in websocket auth
  tokens. Management API token exchange now accepts new UUID-principal API
  admin tokens and still emits management JWTs accepted by the management
  middleware.
- 2026-06-23: Started Phase E dependency-map tooling while keeping Phase D
  non-destructive. `scripts/phase-e-users-pk-dry-run.cjs` now inventories 60
  local `users.id` FK / actor pointer surfaces, auto-discovers the 54 actual
  SQLite FKs to `users(id)`, fails on inventory drift, checks
  `users.public_id` bridge health, creates TEMP shadow copies through
  `users.public_id`, records indexes/triggers, runs `PRAGMA foreign_key_check`,
  and rolls back. Local empty-data rehearsal passed as schema/inventory
  coverage only; staging or restored-production representative data is still
  required before paired Phase E migrations.
- 2026-06-23: Added a users PK representative-data gate matching the Phase C
  orders gate. `--require-representative-data` now fails if the users rehearsal
  artifact has no `users` rows or no non-null checked user dependency
  references. The current empty local baseline correctly fails this gate, so
  only a restored-production or staging artifact with
  `assessment.exitCode = 0` and `dataCoverage.isRepresentative = true` can
  unblock paired Phase E migration drafting.
- 2026-06-24: Added `rtk pnpm db:users-pk-dry-run:representative` and taught
  the users PK parser to ignore pnpm-forwarded `--`, matching the Phase C
  orders rehearsal CLI behavior.

## Phase E: Users Primary-Key Rebuild Drill (Superseded)

Superseded on 2026-06-24 by the greenfield UUID reset decision. Do not continue
adding bridge or rehearsal tooling for `users.public_id`; the target is
`users.id TEXT PRIMARY KEY` from creation time.

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

Progress:

- 2026-06-23: Added
  `docs/architecture/database/USERS_UUID_PK_PHASE_E_DEPENDENCY_MAP.md` and a
  rollback-only users PK verifier. The current local artifact checks 60
  existing user dependency surfaces, detects no missing actual SQLite
  `users(id)` FKs from the inventory, reports zero bridge/mapping/FK failures,
  and documents that the local database is empty so it cannot authorize paired
  destructive migrations.
- 2026-06-23: Added `--require-representative-data` to the users PK verifier so
  conversion rehearsal evidence must prove non-empty user rows and dependent
  references before paired destructive migrations are drafted.
- 2026-06-23: The shared PK rehearsal artifact validator now supports Phase E
  users artifacts, including representative data, bridge health, mapping parity,
  uninventoried FK drift, schema metadata, and `foreign_key_check` gates.

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
