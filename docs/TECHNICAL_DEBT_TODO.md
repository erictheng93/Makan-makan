# Technical Debt & TODO Backlog

Last reviewed: 2026-05-02

This backlog is based on a repository-wide scan of code, tests, docs, and
Cloudflare configuration. It focuses on unresolved implementation work,
behavioral risk, test debt, and cleanup work that should be handled in small
PRs.

## Review Notes

- 2026-05-02 follow-up scan: current working tree still has 65 unchecked
  backlog items in this document, **35 source files** containing `// TODO`
  comments (172 total `// TODO` lines) under `apps/`, `packages/`, and
  `scripts/`, 16 production `REPLACE_ME__PRODUCTION` Cloudflare placeholders,
  and 14 E2E `test.skip` / `fixme` markers.
  - Counting rule for the TODO scan (reproducible): `grep -rE "//[[:space:]]*TODO"
    apps packages scripts --include="*.ts" --include="*.tsx" --include="*.js"
    --include="*.cjs" --include="*.vue"`, excluding `node_modules`, `*.disabled`,
    `*.old`, and `*.backup` paths. Use `-l` for the file count and the bare form
    for the line count. Earlier "37 active TODO" notes were a file count, not a
    line count — recording both here removes the ambiguity.
- 2026-05-01 follow-up verification: analytics export generation is no longer
  a placeholder after `fix(api): implement analytics export generation`; it now
  builds JSON/CSV export payloads and returns metadata plus a data URL. QR scan
  recent-restaurant storage is also no longer using mocked restaurant name or
  address data after `fix(customer): load restaurant info after QR scan`; it
  calls `menuApi.getRestaurant()` for real restaurant details.
- 2026-05-01 follow-up scan: earlier CI blocker notes are partially stale:
  `.github/workflows/test.yml` now has push / pull request triggers restored,
  `tests/e2e/smoke/` exists, and production smoke probes now use `/info`.
  Production auto-deploy is still intentionally manual-only until the
  environment gate and remaining release checks are resolved.
- 2026-05-01: added money cents field retirement tracking and the
  `0027_money_cents_retirement_audit.sql` pre-retirement audit migration,
  including a legacy REAL precision check.
- 2026-05-01: added physical `restaurant_id` FK rebuild migrations `0028`
  and `0029` plus the D1-safe `0030` coupons and `0031` scheduling rules
  component rebuilds. Added `0032` partnership plans, `0033` leave types,
  `0034` workforce scheduling, `0035` cash registers, and `0036` ordering core
  components, then split users root rebuild across `0037`/`0038`/`0039` to
  stay under D1 local migration payload limits. Migration inventory now has no
  pending physical `restaurant_id` FK tables.
- 2026-04-21: `rtk pnpm typecheck` passed.
- 2026-04-21: `rtk pnpm lint` timed out after 120s, so lint status is unknown.
- Existing untracked file was left untouched:
  `docs/testing/PERSONA_TEST_CHECKLIST_AUDIT.md`.
- Existing `TODOS.md` i18n items are included here so this document can be used
  as the primary working list.

## Priority Legend

- **P0**: Production-blocking or user-facing broken behavior.
- **P1**: High-risk incomplete feature or data correctness issue.
- **P2**: Architecture/test debt that slows future work or hides regressions.
- **P3**: Cleanup, performance polish, or low-risk maintainability work.
- **P4**: Nice-to-have hardening or edge-case cleanup.

## P0 / P1: Product Behavior Gaps

### Payment Audit Trail Is Still Not Persisted

**Priority:** P1

**File:** `apps/api/src/services/PaymentOrchestrator.ts`

**Evidence:**

- `logPaymentAttempt()` still only documents a TODO to record payment attempts
  in a database table or monitoring system.
- `logRefundAttempt()` still only documents a TODO to record refund attempts.
- `docs/deployment/PRE_LAUNCH_CHECKLIST.md` also lists payment audit trail as
  a launch checklist item, though that checklist has encoding damage and should
  not be treated as the canonical source.

**Impact:** Payment and refund events can be processed without a durable
append-only audit trail, weakening incident investigation, reconciliation, and
compliance review.

**TODO:**

- [ ] Define the payment/refund audit log schema, retention policy, and
      redaction rules.
- [ ] Persist every payment attempt, success, failure, refund attempt, and
      provider error with request correlation IDs.
- [ ] Ensure audit writes are append-only and cannot be silently overwritten by
      normal application code.
- [ ] Add tests proving audit rows are written for success, provider failure,
      validation failure, and refund paths.

### Authentication Flows Were Exposed But Partially Stubbed

**Priority:** P0 - completed 2026-04-21

**Files:**

- `apps/api/src/features/authentication/routes/index.ts`
- `apps/api/src/features/authentication/services/AuthService.ts`

**Evidence:**

- Routes for forgot password, reset password, and email verification are marked
  as placeholders.
- `AuthService` returns placeholder profile data, returns `null` for profile
  update, returns `false` for session termination, and logs several methods as
  not implemented.
- 2FA methods throw or return failure with "not yet implemented".
- Auth statistics and account security return zero/default data.
- 2026-04-21 update: password reset, email verification, profile
  read/update, session termination, account security, and auth statistics now
  use database-backed service paths. 2FA remains intentionally unsupported by
  the current API/UI surface.

**Impact:** Frontend flows can appear wired while the backend cannot actually
reset passwords, verify email, terminate sessions, or report account security.

**TODO:**

- [x] Decide which auth capabilities are in scope for the next release.
- [x] Implement password reset token generation, persistence, expiry, and email
      delivery.
- [x] Implement reset password with token validation and password hash update.
- [x] Implement email verification token flow.
- [x] Replace placeholder user profile read/update with database-backed logic.
- [x] Implement session termination or remove exposed route/API if unsupported.
- [x] Either implement 2FA fully or hide/remove 2FA API surface until ready.
- [x] Add integration tests for all public auth routes.

### Backup Restore Was Not A Real Recovery Path

**Priority:** P0 - completed 2026-04-21; remaining metric hardening is tracked
as follow-up work

**Files:**

- `apps/api/src/features/backup/services/BackupService.ts`
- `apps/admin-dashboard/src/components/backup/RestoreBackupModal.vue`
- `apps/admin-dashboard/src/stores/backup.ts`

**Evidence:**

- Restore execution only logs a message.
- Admin restore modal contains commented-out restore logic.
- Backup store realtime subscription methods only log to console.
- Backup compression, compression ratio, storage availability, success rate, and
  alert counts were hardcoded or TODO.
- 2026-04-21 update: restore now fetches backup data, verifies checksum,
  restores table rows, records operation status, and admin restore uses the
  real API. Health metrics now read active configurations and alert counts from
  database state. Provider storage quota is still unavailable.

**Impact:** Backup creation may exist, but restore is not a real recovery path.
Operational dashboards can show misleading health/storage information.

**Completed P0 TODO:**

- [x] Implement restore execution end to end: fetch backup, verify checksum,
      validate schema, apply restore, record operation status.
- [x] Wire admin restore modal to the real API and display progress/errors.
- [x] Add focused tests for backup create, validate, restore, and failed
      restore paths.

**Follow-up TODO:**

- [x] **P1:** Add pre-restore backup creation before destructive overwrite
      restores.
- [ ] **P2:** Add transaction/rollback coverage for multi-table restore
      failures.
- [ ] **P3:** Implement compression or rename metrics so they do not imply
      compression.
- [ ] **P3:** Calculate provider storage quota/usage once quota data is
      available.

### QR Code Downloads Returned Placeholder Buffers

**Priority:** P1 - completed 2026-04-22

**File:** `apps/api/src/features/qr-codes/services/QrCodesService.ts`

**Evidence:**

- Single QR download returns `Buffer.from("QR code data placeholder")`.
- Batch QR download returns `Buffer.from("Batch QR codes zip placeholder")`.
- 2026-04-22 update: QR downloads now generate real QR image artifacts and
  batch downloads return ZIP archives containing generated QR SVGs plus a
  manifest.

**Impact:** The API can claim a download succeeded while returning non-QR data.

**TODO:**

- [x] Generate real QR image/ZIP artifacts.
- [x] Set correct content type and filename.
- [x] Add tests that validate file signatures and reject placeholder payloads.
- [ ] **P3:** Add cache headers if product download caching rules are defined.
- [ ] **P3:** Add true PDF/JPEG renderers if those formats are required beyond
      the current SVG fallback.

### Foodpanda Integration Adapter Was Exposed While Not Implemented

**Priority:** P1 - completed 2026-04-22 by disabling the public adapter path

**File:** `apps/api/src/features/integrations/adapters/FoodpandaAdapter.ts`

**Evidence:** Every adapter method throws "Foodpanda integration not yet
implemented".
- 2026-04-22 update: Foodpanda remains explicitly coming soon; admin
  connect/config/menu-sync routes now return 501 before persisting credentials
  or invoking an unimplemented adapter.

**Impact:** If Foodpanda is selectable/configurable, webhook/order/menu flows
will fail at runtime.

**TODO:**

- [x] Hide Foodpanda from product/config UI until implemented, or implement the
      adapter contract.
- [x] Ensure unavailable Foodpanda admin actions return explicit 501 responses
      instead of reaching raw adapter exceptions.
- [ ] **P2:** Add contract tests matching Foodpanda webhook payloads and auth
      behavior before enabling the adapter.

### Queue Modular Path Threw At Runtime

**Priority:** P1 - completed 2026-04-22 for runtime safety; metric accuracy
follow-ups remain

**Files:**

- `apps/api/src/features/queue/services/UnifiedQueueService.ts`
- `packages/queue-service/src/services/QueueService.ts`

**Evidence:**

- `UnifiedQueueService` has a `useModular` branch that throws "Modular queue
  service not yet implemented".
- Queue metrics still hardcode `min_wait`, queue type counts, priority counts,
  and `served_by_name`.
- 2026-04-22 update: requesting modular mode now logs a warning and falls back
  to the legacy implementation instead of throwing.

**Impact:** A feature flag or config switch can route production traffic into
runtime exceptions. Queue dashboards may report incomplete metrics.

**TODO:**

- [x] Remove or lock down `useModular` until repositories are wired.
- [x] Add tests for legacy fallback when modular mode is requested.
- [ ] **P2:** Implement repository-backed modular service construction.
- [ ] **P2:** Calculate queue type counts and priority counts from real queue
      rows.
- [ ] **P2:** Join served-by user data or explicitly remove the field from the
      response.
- [ ] **P2:** Add tests for both legacy and modular branches before enabling
      modular
      mode.

## P2: Cross-Cutting Architecture Debt

### i18n Runtime Is Duplicated Across Apps

**Priority:** P2

**Files:**

- `TODOS.md`
- `packages/shared/src/i18n/`
- app-level `src/i18n/index.ts` files in admin, kitchen, onboarding, and
  management portal apps.

**Impact:** Locale loading, `localStorage` key behavior, deep merge behavior,
and type safety can drift per app.

**TODO:**

- [ ] Extract a shared `createI18n(appMessages)` factory into
      `packages/shared/src/i18n`.
- [ ] Migrate admin-dashboard, kitchen-display, onboarding-app, and
      management-portal to the shared runtime.
- [ ] Standardize the locale storage key.
- [ ] Derive message types from the base locale instead of open recursive maps.

### Stub Locales Fall Back To zh-TW

**Priority:** P2

**Files:** app-level locale files for `zh-CN`, `vi-VN`, `ms-MY`, and `id-ID`.

**Impact:** Completed 2026-05-26. Users selecting those locales now receive
maintainer-accepted AI-assisted localized copy instead of falling back to
Traditional Chinese.

**TODO:**

- [x] Extract all leaf keys from each app's `zh-TW` locale.
- [x] Capture locale copy in a structured review/import format.
- [x] Import maintainer-accepted AI-assisted locale files from
      `docs/i18n/locale-translator-handoff.csv`.
- [x] Add CI warning/failure when a non-base locale has fewer leaf keys than the
      base locale.

### OrderStatus Unification Still Has Cleanup Work

**Priority:** P2

**Reference:** `docs/investigations/2026-04-09-orderstatus-surface-audit.md`

**Evidence:**

- Existing audit identified 11 `OrderStatus`-shaped definitions, dead code, and
  stale disabled examples.
- Phase 3 cleanup items include local admin-dashboard definitions,
  `OrdersService.checkOrderPermissions`, `OrderPermissions`, and scratch files.

**TODO:**

- [ ] Finish replacing local `OrderStatus` definitions with canonical
      `@makanmakan/shared-types`.
- [ ] Decide whether `OrdersService.checkOrderPermissions()` should be deleted
      or wired to a real production route.
- [ ] Delete stale `.disabled` examples once the payment/order-status migration
      path is settled.
- [ ] Add contract snapshot coverage for enum/status values, not just route
      shape.

### Cloudflare Resource IDs Are Still Placeholders

**Priority:** P2

**Files:**

- `apps/api/wrangler.toml`
- `apps/backup-scheduler/wrangler.toml`
- `apps/image-processor/wrangler.toml`
- `apps/management-api/wrangler.toml`
- `apps/realtime/wrangler.toml`

**Evidence:** Production D1/KV IDs still include 16
`REPLACE_ME__PRODUCTION__...` placeholders across API, realtime,
backup-scheduler, image-processor, and management-api Worker configs.
Realtime staging D1 now has a concrete UUID, but the stale TODO comment above
that value still needs cleanup.

**Impact:** Deployment can succeed against wrong/missing infrastructure or fail
late during release.

**TODO:**

- [ ] Replace placeholder D1/KV IDs with real Cloudflare resource IDs.
- [ ] Add a CI config check that fails on placeholder resource IDs.
- [ ] Document which environment owns each D1/KV/R2/queue binding.
- [ ] Remove stale TODO comments where a real resource ID has already been
      populated.

### Production Deploy Chain Is Manual-Only

**Priority:** P2

**File:** `.github/workflows/deploy-production.yml`

**Evidence:**

- The `workflow_run` trigger that should chain production deploys after the
  main test workflow is still commented out.
- The file notes the manual-only state is intentional until the production
  environment approval gate exists and remaining release checks are resolved.
- The smoke endpoint debt is partially resolved: the production probe now calls
  `/info` instead of the removed `/api/v1/health` route.

**Impact:** Production deploys rely on manual dispatch and can drift from the
test workflow's actual green state.

**TODO:**

- [ ] Configure the GitHub `production` environment with required reviewers and
      a main-only branch restriction.
- [ ] Re-enable the `workflow_run` trigger after the environment gate is in
      place.
- [ ] Add a release checklist step that verifies the deploy workflow is chained
      to the intended test workflow name.
- [ ] Remove stale comments that still mention fixed smoke-test and missing
      `tests/e2e/smoke/` blockers once the auto-deploy gate is restored.

### Core Restaurant FK Rebuilds Covered By D1-Safe Components

**Priority:** P1

**Files:**

- `packages/database/migrations_fresh/0028_restaurant_fk_rebuild_operational_support.sql`
- `packages/database/migrations_fresh/0029_restaurant_fk_rebuild_leaf_dependents.sql`
- `packages/database/migrations_fresh/0030_restaurant_fk_rebuild_coupons_component.sql`
- `packages/database/migrations_fresh/0031_restaurant_fk_rebuild_scheduling_rules_component.sql`
- `packages/database/migrations_fresh/0032_restaurant_fk_rebuild_partnership_plans_component.sql`
- `packages/database/migrations_fresh/0033_restaurant_fk_rebuild_leave_types_component.sql`
- `packages/database/migrations_fresh/0034_restaurant_fk_rebuild_workforce_scheduling_component.sql`
- `packages/database/migrations_fresh/0035_restaurant_fk_rebuild_cash_registers_component.sql`
- `packages/database/migrations_fresh/0036_restaurant_fk_rebuild_ordering_core_component.sql`
- `packages/database/migrations_fresh/0037_restaurant_fk_rebuild_users_root_stage.sql`
- `packages/database/migrations_fresh/0038_restaurant_fk_rebuild_users_root_apply.sql`
- `packages/database/migrations_fresh/0039_restaurant_fk_rebuild_users_root_finalize.sql`
- `packages/database/src/testing/__tests__/migration-inventory.test.ts`

**Evidence:**

- Migration inventory now confirms physical `restaurant_id` FKs for the
  operational support, leaf dependent, waiting list, payment, subscription, and
  coupons, scheduling rules, partnership plans, leave types, and workforce
  scheduling, cash registers, ordering core, and users root component tables.
- The remaining `restaurant_id` table list is empty; all 49 `restaurant_id`
  tables now have physical SQLite/D1 FK metadata.
- The users root rebuild is split into stage/apply/finalize files because the
  original 204KB migration file exceeded wrangler local D1 payload limits.

**Impact:** Remote rollout still needs a staging data audit and backup window
because the users root apply phase rebuilds many dependent tables. Inventory
tests now guard against losing physical FK metadata, temp table cleanup, or
`foreign_key_check` cleanliness.

**TODO:**

- [x] Add migration inventory coverage for current physical FK coverage,
      remaining pending tables, temp-table cleanup, and `foreign_key_check`.
- [x] Split the remaining core tables into D1-safe rebuild components based on
      inbound FK graph.
- [ ] Run staging data audits before remote rollout and require zero orphan
      rows.
- [x] Update `migration-inventory.test.ts` as each pending table receives a
      physical FK.

### Money REAL Columns Still Need Cents Retirement

**Priority:** P2

**Reference:** `docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md`

**Files:**

- `packages/database/src/schema/orders.ts`
- `packages/database/src/schema/order-items.ts`
- `packages/database/src/schema/menu-items.ts`
- `packages/database/src/schema/discovery.ts`
- `packages/database/src/schema/coupons.ts`
- `packages/database/src/schema/group-orders.ts`
- `packages/database/src/schema/pos.ts`
- `packages/database/src/schema/partnerships/*.ts`
- `packages/database/src/schema/forecast.ts`
- `packages/database/src/schema/scheduling/shift-templates.ts`
- `packages/database/src/utils/money-sql.ts`
- `packages/database/src/testing/__tests__/migration-inventory.test.ts`
- `packages/database/src/services/analytics.ts`
- `packages/database/src/services/POSService.ts`
- `packages/database/src/services/coupon.ts`
- `packages/database/src/services/GroupOrderService.ts`
- `packages/database/src/services/order.ts`
- `apps/api/src/features/system/routes/index.ts`
- `apps/api/src/features/payments/services/PaymentService.ts`
- `apps/api/src/features/payments/routes/index.ts`
- `apps/api/src/features/coupons/routes/index.ts`
- `apps/api/src/features/coupons/services/CouponsService.ts`
- `apps/api/src/features/group-orders/services/GroupOrdersService.ts`
- `apps/api/src/features/integrations/services/PlatformOrderService.ts`
- `apps/api/src/features/pos/services/RefundService.ts`
- `apps/api/src/features/pos/services/ReportService.ts`
- `apps/api/src/features/pos/services/ReceiptService.ts`
- `packages/database/src/services/realtime.ts`
- `packages/database/migrations_fresh/0023_integrity_audit_and_money_cents.sql`
- `packages/database/migrations_fresh/0025_partnership_money_and_fk_audit.sql`
- `packages/database/migrations_fresh/0027_money_cents_retirement_audit.sql`

**Evidence:**

- Current schema still defines legacy `REAL` money columns beside integer
  `*_cents` columns, for example `orders.total_amount` /
  `orders.total_amount_cents`, `menu_items.price` / `menu_items.price_cents`,
  and POS/partnership amount fields.
- Fresh migrations `0023` and `0025` add/backfill cents columns and cents sync
  triggers. They do not remove the legacy `REAL` columns.
- Fresh migration `0027` records `money_cents_retirement` mismatches and
  over-precision legacy REAL values in `data_integrity_audit`; destructive
  column retirement is still gated on zero production/staging audit violations.
- Revenue analytics, POS reports, payment total checks, and refund limit checks
  now use shared cents-first SQL helpers before falling back to legacy `REAL`
  values.
- Migration inventory tests now assert that every tracked transitional money
  `REAL` column has an integer cents counterpart and matching
  `money_cents_retirement` audit coverage.
- System health average order value and POS receipt content now use cents-first
  reads.
- Coupon services and routes now normalize fixed-value coupon money fields from
  cents first, while preserving percentage discount values as percentages.
- Group ordering services now write cents columns on new group/cart/split rows
  and use cents-first reads for cart totals, split totals, payment checks, and
  group-order summaries.
- Order item snapshot fallback and database POS receipt content now resolve
  order/item amounts from cents before falling back to legacy `REAL` fields.
- Platform integration order ingestion now writes order and order-item cents
  fields directly instead of relying only on compatibility sync triggers.
- Legacy realtime new-order payloads accept optional cents totals and normalize
  the broadcast amount through cents-first fallback.
- Service reads have not fully converged: several paths still use cents-first
  compatibility fallbacks such as `amountFromCents(cents, legacyReal)` while
  public API surfaces continue returning decimal money values.

**Impact:** Keeping both representations is a transitional state. Removing the
legacy columns too early can break reads/writes, but leaving the dual
representation indefinitely keeps precision drift and migration risk alive.

**TODO:**

- [ ] Finish the code-path inventory for every in-scope money field and mark
      cents as the authoritative read source.
- [x] Normalize coupon and group-order service/API money reads to prefer cents
      while preserving decimal API response contracts.
- [x] Add executable migration inventory coverage for tracked money
      `REAL`/`*_cents` pairs and audit-table alignment.
- [ ] Keep percentage/rate/non-money `REAL` fields out of this migration
      (`discount_type = 'percentage'`, leave days, ratings, coordinates, etc.).
- [x] Add a dedicated `data_integrity_audit` pass that compares each legacy
      money `REAL` value with its `*_cents` value and records sample row IDs.
- [ ] Require zero unresolved `money_cents_retirement` audit violations before
      any destructive schema change.
- [ ] Land a separate D1/SQLite table-rebuild migration to remove retired
      legacy `REAL` money columns, preserve constraints/indexes, and drop
      obsolete cents sync triggers.
- [ ] Add migration tests that verify rebuilt table shape, row counts, null
      handling, percentage discount exceptions, and FK/index preservation.

## P2: Test Debt

### E2E Tests Skip Missing Product UI

**Priority:** P2

**Files:**

- `tests/e2e/journeys/customer/coupon-checkout.spec.ts`
- `tests/e2e/admin/restaurant-switching.spec.ts`
- `tests/e2e/admin/coupon-management.spec.ts`
- `tests/e2e/admin/bulk-qr-progress.spec.ts`
- `tests/e2e/admin/menu-management.spec.ts`
- `tests/e2e/integration/qr-generation.spec.ts`

**Evidence:** Multiple tests call `test.skip(true, ...)` or unconditional
`test.skip()` when coupon input, coupon discount UI, remove buttons, file input,
or setup data are missing. The current scan found 14 E2E skip/fixme markers;
`tests/e2e/smoke/` now exists, so the old missing-directory blocker should be
retired from older reports.

**Impact:** Important user journeys can silently disappear from E2E coverage.

**TODO:**

- [ ] Replace unconditional skips with explicit feature flags or test fixtures.
- [ ] Track each skip as a ticket with owner and expected unblock condition.
- [ ] Add a CI report that fails when new unconditional skips are introduced.
- [ ] Prioritize customer coupon checkout and admin bulk QR progress because
      they touch payment/discount and operations workflows.

### Integration Tests Still Rely Heavily On Mocks

**Priority:** P2

**Evidence:** Many API feature tests mock database, middleware, services, or
external adapters. There are newer real-integration configs, but legacy
mock-drizzle coverage remains.

**Impact:** Route/service contracts can pass tests while failing with real D1,
Drizzle queries, middleware order, or cross-service behavior.

**TODO:**

- [ ] Identify top 10 highest-risk mocked API feature tests.
- [ ] Convert them to real integration tests using the database test utilities.
- [ ] Keep unit mocks for pure business rules, but require at least one real
      route test per externally exposed feature.

### Lint Verification Is Too Slow Or Hanging

**Priority:** P2

**Evidence:** `rtk pnpm lint` did not finish within 120 seconds.

**Impact:** Developers may skip lint locally, and CI feedback can be slow.

**TODO:**

- [ ] Run lint with a longer timeout once to capture actual failures.
- [ ] Split lint commands by workspace (`api`, `admin`, `customer`, etc.).
- [ ] Cache ESLint where possible and ensure generated/archive files are
      excluded.

## P3: Feature Completeness And Polish

### Admin Dashboard TODOs In Scheduling, POS, Backup, And Queue

**Priority:** P3

**Files:**

- `apps/admin-dashboard/src/components/scheduling/SchedulingConflicts.vue`
- `apps/admin-dashboard/src/views/scheduling/SchedulingView.vue`
- `apps/admin-dashboard/src/views/POSManagementView.vue`
- `apps/admin-dashboard/src/services/queueService.ts`
- `apps/admin-dashboard/src/components/backup/CreateBackupModal.vue`
- `apps/admin-dashboard/src/components/backup/BackupListItem.vue`

**TODO:**

- [ ] Implement scheduling conflict ignore/details behavior.
- [ ] Wire schedule date filtering or create modal behavior.
- [ ] Implement promotion edit dialog.
- [ ] Display shift report in a real dialog.
- [ ] Replace backup component local types with shared types after workspace
      imports are ready.
- [ ] Implement queue capacity forecast once the API exists.

### Analytics Export Placeholder Was Replaced

**Priority:** P3 - completed 2026-05-01 for inline export generation; durable
artifact storage remains a product decision

**File:** `apps/api/src/features/analytics/services/AnalyticsService.ts`

**Evidence:**

- `generateExport()` now fetches real analytics data for dashboard, revenue,
  products, customers, and performance exports.
- JSON exports include metadata and data. CSV exports are generated from the
  selected analytics data.
- The response includes filename, content type, size, period, expiry metadata,
  and a `data:` download URL.

**TODO:**

- [x] Implement export generation for JSON/CSV payloads.
- [x] Define basic export formats and response metadata.
- [ ] Decide whether exports should remain inline `data:` URLs or move to
      durable object/R2-backed file storage.
- [ ] Add tests for export lifecycle, permission boundaries, and large payload
      behavior.

### AI Analytics Repeat Customer Rate Is Hardcoded

**Priority:** P3

**File:** `packages/ai-analytics/src/services/AIInsightsService.ts`

**TODO:**

- [ ] Calculate repeat customer rate from user/order history.
- [ ] Define behavior for guest orders and anonymous customers.

### Printer Metrics Are Incomplete

**Priority:** P3

**File:** `packages/queue-core/src/print/services/PrinterService.ts`

**TODO:**

- [ ] Track device uptime.
- [ ] Track busy hours from print job history.
- [ ] Add tests for printer health metrics.

### Migration Helper Generates TODO Route Skeletons

**Priority:** P3

**File:** `scripts/migration/migrate-routes.js`

**TODO:**

- [ ] Update the generated skeleton to fail loudly until route logic is filled.
- [ ] Add a checklist to generated files so migrated routes do not remain as
      TODO comments.

## P3: Repository Cleanup

### Disabled And Old Files Need Disposition

**Priority:** P3

**Files found:**

- `apps/api/src/__tests__/payment-system-integration.test.ts.disabled`
- `apps/api/src/routes/__tests__/coupons.test.ts.disabled`
- `apps/api/src/services/providers/__tests__/StripeProvider.test.ts.disabled`
- `apps/api/src/examples/StripeIntegrationExample.ts.disabled`
- `apps/api/src/examples/PaymentSystemUsage.ts.disabled`
- `packages/database/migrations/0010_index_optimization.sql.disabled`
- `packages/database/migrations/0039_9_cleanup_new_tables.sql.disabled`
- `packages/database/migrations/0040_comprehensive_restaurant_id_migration.sql.disabled`
- `packages/database/migrations/0041_remaining_tables_structure.sql.disabled`
- `packages/database/migrations/0042_migrate_data_part1.sql.disabled`
- `packages/database/migrations/0043_migrate_data_part2.sql.disabled`
- `packages/database/migrations/0044_cleanup_and_rename.sql.old`
- `apps/admin-dashboard/src/views/ReservationView.vue.old`
- `apps/admin-dashboard/src/views/WaitingListView.vue.old`
- `apps/kitchen-display/priority3-analysis.txt`
- `apps/kitchen-display/priority3-final-status.txt`
- `apps/kitchen-display/priority3-progress1.txt`
- `apps/kitchen-display/order-workflow-errors.txt`

**TODO:**

- [ ] Decide keep/delete/restore for each `.disabled` and `.old` file.
- [ ] Move retained historical notes into `docs/archive/` or delete them.
- [ ] Delete scratch `.txt` files after confirming no active investigation
      depends on them.
- [ ] Add a CI check that blocks new `.old`, `.disabled`, or scratch `.txt`
      files outside approved directories.

## P4: Hardening And Edge Cases

### i18n Deep Merge Prototype Pollution Hardening

**Priority:** P4

**Files:** duplicated app-level i18n runtimes.

**Context:** Current locale data is static, but if remote locale loading is
added later, deep merge logic should reject `__proto__`, `constructor`, and
`prototype`.

**TODO:**

- [ ] Harden `deepMerge`, or remove deep merge if static locale assignment is
      sufficient.

### Kitchen Display Locale Formatting

**Priority:** P4

**Files:** see `TODOS.md`.

**TODO:**

- [ ] Replace hardcoded `"zh-TW"` in date/time formatting with active locale.
- [ ] Convert `HistoryView` status/type label maps to computed maps.
- [ ] Tighten `OrderCard.displayTableName` prefix stripping regex and extend it
      once Vietnamese/Malay translations exist.

## Suggested Execution Order

1. Auth placeholder flows.
2. Backup restore and backup metrics.
3. QR code real artifact generation.
4. Payment audit trail persistence.
5. Cloudflare resource ID validation.
6. Production deploy environment gate and auto-deploy chain.
7. Queue modular branch guard or implementation.
8. E2E skip cleanup for coupon/QR/admin workflows.
9. OrderStatus cleanup and disabled file deletion.
10. i18n shared runtime and locale completion.
11. Remaining admin polish and metrics TODOs.
12. Low-risk hardening items.
