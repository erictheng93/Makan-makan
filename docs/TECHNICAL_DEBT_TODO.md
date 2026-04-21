# Technical Debt & TODO Backlog

Last reviewed: 2026-04-21

This backlog is based on a repository-wide scan of code, tests, docs, and
Cloudflare configuration. It focuses on unresolved implementation work,
behavioral risk, test debt, and cleanup work that should be handled in small
PRs.

## Review Notes

- `rtk pnpm typecheck` passed.
- `rtk pnpm lint` timed out after 120s, so lint status is unknown.
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

- [ ] **P1:** Add pre-restore backup creation before destructive overwrite
      restores.
- [ ] **P2:** Add transaction/rollback coverage for multi-table restore
      failures.
- [ ] **P3:** Implement compression or rename metrics so they do not imply
      compression.
- [ ] **P3:** Calculate provider storage quota/usage once quota data is
      available.

### QR Code Downloads Return Placeholder Buffers

**Priority:** P1

**File:** `apps/api/src/features/qr-codes/services/QrCodesService.ts`

**Evidence:**

- Single QR download returns `Buffer.from("QR code data placeholder")`.
- Batch QR download returns `Buffer.from("Batch QR codes zip placeholder")`.

**Impact:** The API can claim a download succeeded while returning non-QR data.

**TODO:**

- [ ] Generate real QR image/PDF/ZIP artifacts.
- [ ] Set correct content type, filename, and cache headers.
- [ ] Add tests that validate file signature and included QR payload.

### Foodpanda Integration Adapter Is Not Implemented

**Priority:** P1

**File:** `apps/api/src/features/integrations/adapters/FoodpandaAdapter.ts`

**Evidence:** Every adapter method throws "Foodpanda integration not yet
implemented".

**Impact:** If Foodpanda is selectable/configurable, webhook/order/menu flows
will fail at runtime.

**TODO:**

- [ ] Hide Foodpanda from product/config UI until implemented, or implement the
      adapter contract.
- [ ] Add contract tests matching Foodpanda webhook payloads and auth behavior.
- [ ] Ensure platform errors are surfaced as typed integration errors, not raw
      generic exceptions.

### Queue Modular Path Throws At Runtime

**Priority:** P1

**Files:**

- `apps/api/src/features/queue/services/UnifiedQueueService.ts`
- `packages/queue-service/src/services/QueueService.ts`

**Evidence:**

- `UnifiedQueueService` has a `useModular` branch that throws "Modular queue
  service not yet implemented".
- Queue metrics still hardcode `min_wait`, queue type counts, priority counts,
  and `served_by_name`.

**Impact:** A feature flag or config switch can route production traffic into
runtime exceptions. Queue dashboards may report incomplete metrics.

**TODO:**

- [ ] Remove or lock down `useModular` until repositories are wired.
- [ ] Implement repository-backed modular service construction.
- [ ] Calculate queue type counts and priority counts from real queue rows.
- [ ] Join served-by user data or explicitly remove the field from the response.
- [ ] Add tests for both legacy and modular branches before enabling modular
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

**Impact:** Users selecting those locales may still see Traditional Chinese.

**TODO:**

- [ ] Extract all leaf keys from each app's `zh-TW` locale.
- [ ] Send untranslated keys to translators in a structured format.
- [ ] Fill translated locale files.
- [ ] Add CI warning/failure when a non-base locale has fewer leaf keys than the
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

**Evidence:** Staging/production D1/KV IDs include values such as
`staging-db-id`, `production-db-id`, `STAGING_DB_ID_TO_BE_REPLACED`, and
`PRODUCTION_DB_ID_TO_BE_REPLACED`.

**Impact:** Deployment can succeed against wrong/missing infrastructure or fail
late during release.

**TODO:**

- [ ] Replace placeholder D1/KV IDs with real Cloudflare resource IDs.
- [ ] Add a CI config check that fails on placeholder resource IDs.
- [ ] Document which environment owns each D1/KV/R2/queue binding.

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
or setup data are missing.

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

### Analytics Export Is A Placeholder

**Priority:** P3

**File:** `apps/api/src/features/analytics/services/AnalyticsService.ts`

**TODO:**

- [ ] Implement export generation and storage.
- [ ] Define export formats, retention, permissions, and download endpoint.
- [ ] Add tests for export lifecycle and permission boundaries.

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
4. Cloudflare resource ID validation.
5. Queue modular branch guard or implementation.
6. E2E skip cleanup for coupon/QR/admin workflows.
7. OrderStatus cleanup and disabled file deletion.
8. i18n shared runtime and locale completion.
9. Remaining admin polish and metrics TODOs.
10. Low-risk hardening items.
