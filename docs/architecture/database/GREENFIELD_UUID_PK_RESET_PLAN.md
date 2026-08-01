# Greenfield UUID Primary-Key Reset Plan

Last updated: 2026-06-24

Status: implementation complete in the working tree and ready for commit.
Schema, service, focused API cleanup, local D1 reset/seed verification,
typecheck, lint, and focused tests have passed.

## Decision

Treat the current database as greenfield for staff/order identity primary keys.
There is no representative production data to preserve, so the public-id bridge
and destructive rebuild rehearsal tracks are superseded by a reset to native
UUID-v7 `TEXT` primary keys.

This replaces the previous Phase C orders and Phase E users destructive rebuild
planning. Those plans existed to move live integer primary-key data safely into
UUID identifiers; with resettable empty environments, the simpler target is to
create the final shape directly.

## Scope

Make these tables UUID-native from creation:

- `orders.id`
- `users.id`
- `platform_orders.id`

Convert all dependent references to matching `TEXT` columns. At minimum this
includes order pointers such as `platform_orders.order_id`,
`order_items.order_id`, and `group_orders.master_order_id`, plus staff-user
pointers such as `group_orders.created_by`, `group_members.user_id`, session,
audit, POS, feedback, scheduling, leave, coupon, partnership, and verification
references.

Remove transitional identity surfaces:

- `orders.public_id`
- `users.public_id`
- partial unique indexes for those bridge columns
- order/staff identity dual lookup helpers that exist only to support
  integer/UUID coexistence
- package scripts and validators for orders/users PK rebuild rehearsals
- bridge migrations `0072`-`0075` in `migrations_fresh` and `0089`-`0092` in
  `migrations`

## Migration Policy

- Do not run `db:generate`; the generated state is known to be stale and
  interactive.
- Hand-edit both migration tracks in lockstep:
  `packages/database/migrations_fresh` and `packages/database/migrations`.
- Because environments are resettable, fold the UUID-native shape into the
  active create/rebuild SQL instead of adding bridge/backfill phases.
- Keep `migration-dual-track.json` aligned with the files that still exist.

## Verification

Required before committing:

- UUID-native schema tests for `orders`, `users`, and `platform_orders` pass.
- Bridge migration tests prove the bridge files and package aliases are gone.
- `pnpm db:reset:local` succeeds against a clean local D1 state.
- `pnpm db:seed:local` succeeds or any seed failure is fixed for UUID ids.
- Focused API/database tests for auth, order identity, staff principal,
  realtime order rooms, and money/order FK paths pass.
- `pnpm typecheck` passes or remaining failures are documented as
  pre-existing and unrelated.

## Progress Log

### 2026-06-24

Completed in the working tree:

- Changed Drizzle schema definitions so `orders.id`, `users.id`, and
  `platform_orders.id` are UUID-v7 `TEXT` primary keys from creation.
- Converted dependent order/user FK columns in database schema and active SQL
  migrations from integer to `TEXT`.
- Removed `orders.public_id` / `users.public_id` bridge columns and partial
  bridge indexes from schema.
- Deleted bridge/audit migrations:
  `migrations_fresh/0072`-`0075` and `migrations/0089`-`0092`.
- Removed orders/users PK rehearsal package aliases, dry-run scripts, artifact
  validators, and their tests.
- Updated order/staff identity helpers, auth middleware, database auth service,
  payments, realtime auth, and database realtime service to use UUID-native
  identifiers. Temporary response aliases such as `publicId`,
  `publicUserId`, and `orderPublicId` now resolve to the UUID primary key.
- Updated focused tests away from numeric order/user compatibility and
  `public_id` SQL expectations.
- Added `scripts/seed-local.sql` with UUID-native local demo restaurant and
  known local admin/owner accounts, replacing the missing root seed target.

Verified so far:

- `pnpm db:reset:local`
- `pnpm db:seed:local`
- `pnpm --filter @makanmakan/database run typecheck`
- `pnpm typecheck`
- `pnpm check:migration-dual-track`
- `pnpm exec vitest run tests/unit/orders-pk-package-scripts.test.ts tests/unit/uuid-native-migration-sql.test.ts packages/database/src/schema/orders-public-id-bridge.test.ts packages/database/src/schema/users-public-id-bridge.test.ts`
- `pnpm exec vitest run apps/api/src/shared/services/order-identity.test.ts apps/api/src/shared/services/staff-principal.test.ts packages/database/src/services/auth.test.ts`
- `pnpm exec vitest run apps/api/src/features/payments/routes/index.test.ts apps/api/src/features/realtime/services/RealtimeAuthService.test.ts packages/database/src/services/realtime.test.ts`
- `pnpm exec vitest run tests/unit/orders-pk-package-scripts.test.ts tests/unit/uuid-native-migration-sql.test.ts packages/database/src/schema/orders-public-id-bridge.test.ts packages/database/src/schema/users-public-id-bridge.test.ts apps/api/src/shared/services/order-identity.test.ts apps/api/src/shared/services/staff-principal.test.ts packages/database/src/services/auth.test.ts apps/api/src/features/payments/services/PaymentService.test.ts apps/api/src/features/payments/services/refundPayment.test.ts`
- `pnpm exec vitest run tests/unit/orders-pk-package-scripts.test.ts tests/unit/uuid-native-migration-sql.test.ts packages/database/src/schema/orders-public-id-bridge.test.ts packages/database/src/schema/users-public-id-bridge.test.ts apps/api/src/shared/services/order-identity.test.ts apps/api/src/shared/services/staff-principal.test.ts packages/database/src/services/auth.test.ts apps/api/src/features/payments/routes/index.test.ts apps/api/src/features/payments/services/PaymentService.test.ts apps/api/src/features/payments/services/refundPayment.test.ts apps/api/src/features/realtime/services/RealtimeAuthService.test.ts packages/database/src/services/realtime.test.ts`
- `pnpm lint`
- `git diff --check`

Pending:

- Commit and push the greenfield UUID reset changes.
