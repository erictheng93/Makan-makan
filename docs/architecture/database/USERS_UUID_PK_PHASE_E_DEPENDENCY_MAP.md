# Users UUID Primary-Key Phase E Dependency Map

Last updated: 2026-06-23

## Objective

Phase E will rehearse a future destructive rebuild where `users.id` stops being
the staff identity primary key and `users.public_id` becomes the UUID-v7 bridge
used for remapping dependent references.

This document is a dependency map and drill contract only. It does not authorize
a production destructive migration.

## Commands

- Print the current inventory:
  `rtk node scripts/phase-e-users-pk-dry-run.cjs --print-inventory`
- Run local rollback rehearsal:
  `rtk pnpm db:users-pk-dry-run`
- Save local rehearsal evidence:
  `rtk node scripts/phase-e-users-pk-dry-run.cjs --execute-local --json-output /tmp/users-pk-baseline.json`
- Require representative rehearsal data:
  `rtk node scripts/phase-e-users-pk-dry-run.cjs --execute-local --require-representative-data --json-output /tmp/users-pk-representative.json`
- Validate archived rehearsal evidence before migration drafting:
  `rtk pnpm db:pk-rehearsal:validate -- --phase users --artifact /tmp/users-pk-representative.json`
- Unit test the rehearsal verifier:
  `rtk pnpm exec vitest run tests/unit/phase-e-users-pk-dry-run.test.ts`

## Local Rehearsal Evidence

Command run on 2026-06-23:

```sh
rtk node scripts/phase-e-users-pk-dry-run.cjs --execute-local --json-output /tmp/users-pk-baseline.json
rtk node scripts/phase-e-users-pk-dry-run.cjs --execute-local --require-representative-data --json-output /tmp/users-pk-baseline-require-representative.json
```

Local database:
`apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/2b35d4d42e3c9f6b5ad5b5579a7b1470c66e69f6b33a31e3f5a0095cc6d18656.sqlite`

Baseline result:

- Existing dependency surfaces checked: 60
- SQLite `PRAGMA foreign_key_list` discovered 54 actual `users(id)` FK
  surfaces.
- Uninventoried actual `users(id)` FKs: 0
- Skipped legacy surfaces absent from the current local schema:
  `qr_codes.created_by`, `qr_downloads.user_id`, `qr_scans.user_id`,
  `blacklisted_tokens.user_id`, `order_status_history.changed_by`,
  `customer_reviews.user_id`, `survey_responses.user_id`.
- `users.public_id` bridge violations: 0 missing, 0 duplicate, 0 malformed
  values on the current empty local user table.
- Dependency shadow-copy failures: 0 unmapped user references
- `PRAGMA foreign_key_check`: 0 rows
- Local row counts are currently zero for `users` and checked dependent
  surfaces; this proves script safety, schema coverage, and inventory drift
  detection, not production data volume behavior.
- With `--require-representative-data`, this same empty local baseline
  correctly exits 1 because `users` has zero rows and no checked dependency has
  non-null user references. This prevents treating an empty local database as
  conversion-ready evidence.

## Dependency Map

The local verifier owns the executable inventory in
`scripts/phase-e-users-pk-dry-run.cjs`. It covers these domains:

| Domain | Surfaces |
| --- | --- |
| Auth/session | `sessions.user_id`, password/email/phone verification token `user_id`, `password_change_logs.user_id` |
| Audit | `audit_logs.user_id`, `audit_logs.on_behalf_of_user_id` |
| POS | `cash_shifts.operator_id`, `cash_movements.recorded_by`, `cash_movements.approved_by`, `refunds.processed_by`, `refunds.approved_by`, `shift_reports.operator_id` |
| Group ordering | `group_orders.created_by`, `group_members.user_id`, `share_codes.created_by` |
| Partnerships | `partnerships.created_by`, `partnership_plans.created_by`, `verified_members.verified_by`, `partnership_usage_logs.verified_by_user_id` |
| Coupons | `coupons.created_by`, `coupon_usage.user_id`, `coupon_distributions.created_by`, `coupon_templates.created_by` |
| Scheduling | `employee_availability.employee_id`, `employee_schedules.*`, `schedule_swap_requests.*`, `shift_templates.*`, `scheduling_rules.*`, `scheduling_conflicts.resolved_by` |
| Leave | `employee_leave_balances.*`, `leave_requests.*`, `leave_approval_rules.*`, `leave_calendar_events.created_by`, `leave_types.*` |
| Service bookings | `service_bookings.employee_id`, `service_booking_waitlist.employee_id` |
| Feedback/system | `shop_feedback.user_id`, `feedback_responses.user_id`, `error_reports.user_id`, `error_reports.resolved_by` |
| Legacy migration surfaces | QR, blacklisted token, order status, customer review, and survey user references when present |

`*` means multiple columns in that table are listed explicitly in the script.
Any new actual SQLite FK to `users(id)` that is not present in the inventory
causes the rehearsal assessment to fail.

## Dry-Run Contract

The rehearsal script must remain non-destructive:

- It creates only `TEMP` shadow tables.
- It maps legacy integer references to `users.public_id` through shadow copy
  tables.
- It checks row-count parity for every non-null user reference.
- It compares actual SQLite `users(id)` FKs against the explicit inventory.
- It records indexes and triggers to preserve during a future table rebuild.
- It runs `PRAGMA foreign_key_check`.
- It rolls back at the end.
- With `--json-output`, it writes the same rehearsal result printed to stdout
  to a caller-provided file so staging/restored-prod drill evidence can be
  archived.
- The JSON artifact includes `rehearsalOptions`. Migration-ready evidence must
  show `requireRepresentativeData = true`.
- The JSON artifact includes `artifactPhase = "users"` so validator runs can
  reject mismatched archived evidence.
- The JSON artifact includes `artifactSchemaVersion = 1`; older or future
  artifact contracts must not pass the conversion gate by accident.
- With `--require-representative-data`, the assessment fails unless the
  artifact contains at least one `users` row and at least one non-null mapped
  dependency reference.

## Migration Conversion Gate

Do not create paired Phase E users PK migrations until all of these are true:

- `users.public_id` audit guard has passed against staging or restored
  production data.
- A gated users PK rehearsal artifact has non-empty representative user data.
- The archived rehearsal was run with `--require-representative-data`, and the
  JSON artifact has `assessment.exitCode = 0` and
  `assessment.failures = []`, and `dataCoverage.isRepresentative = true`.
- Every dependency has `mapped_user_refs = non_null_user_refs`.
- `users.public_id` has zero missing, duplicate, or malformed values.
- `uninventoriedUserForeignKeys` is empty.
- `PRAGMA foreign_key_check` returns zero rows.
- `rtk pnpm db:pk-rehearsal:validate -- --phase users --artifact <archived-json>`
  returns `exitCode = 0` for the archived staging/restored-production evidence.
  The validator recomputes dependency-surface and non-null reference coverage
  from the artifact and requires `usersBridge.user_rows > 0` instead of
  trusting `dataCoverage` alone. It also verifies the archived artifact records
  `artifactPhase = "users"`, `artifactSchemaVersion = 1`, and the required
  strict `rehearsalOptions`.
- The migration draft preserves all listed indexes and triggers.
- API auth, database auth, realtime auth, management exchange, verification,
  scheduling, leave, POS, partnership, feedback, and audit tests still pass
  with UUID staff principals and legacy numeric compatibility.
