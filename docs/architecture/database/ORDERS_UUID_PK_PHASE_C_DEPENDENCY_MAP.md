# Orders UUID Primary-Key Phase C Dependency Map

Last updated: 2026-06-23

## Objective

Phase C rehearses a future destructive rebuild where `orders.id` moves from the
legacy integer primary key to the UUID-v7 bridge value in `orders.public_id`.
This document is the reviewable dependency map for the drill. It does not
authorize a production destructive migration.

## Commands

- Print review SQL:
  `rtk node scripts/phase-c-orders-pk-dry-run.cjs --print-sql`
- Run local rollback rehearsal:
  `rtk pnpm db:orders-pk-dry-run`
- Save local rehearsal evidence:
  `rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --json-output /tmp/orders-pk-baseline.json`
- Save representative fixture evidence:
  `rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --with-fixture --json-output /tmp/orders-pk-fixture.json`
- Require representative rehearsal data:
  `rtk pnpm db:orders-pk-dry-run:representative`
- Require full dependency-surface fixture coverage:
  `rtk pnpm db:orders-pk-dry-run:fixture-full-surface`
- Validate archived rehearsal evidence before migration drafting:
  `rtk pnpm db:pk-rehearsal:validate -- --phase orders --artifact /tmp/orders-pk-representative.json --role representative`
- Validate local full-surface fixture evidence before migration drafting:
  `rtk pnpm db:pk-rehearsal:validate -- --phase orders --artifact /tmp/orders-pk-fixture-full-surface.json --role fixture`
- Verify the paired evidence manifest before migration drafting:
  `rtk pnpm db:orders-pk-readiness:verify -- --manifest artifacts/pk/orders-phase-c-readiness.json`
- Unit test the rehearsal generator:
  `rtk pnpm exec vitest run tests/unit/phase-c-orders-pk-dry-run.test.ts`

## Local Rehearsal Evidence

Commands run on 2026-06-23:

```sh
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --with-fixture
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --json-output /tmp/orders-pk-baseline.json
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --with-fixture --json-output /tmp/orders-pk-fixture.json
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --require-representative-data --json-output /tmp/orders-pk-baseline-require-representative.json
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --require-representative-data --require-complete-surface-coverage --json-output /tmp/orders-pk-representative.json
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --with-fixture --require-representative-data --json-output /tmp/orders-pk-fixture-gated.json
rtk node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --with-fixture --require-representative-data --require-complete-surface-coverage --json-output /tmp/orders-pk-fixture-full-surface.json
```

Local database:
`apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/2b35d4d42e3c9f6b5ad5b5579a7b1470c66e69f6b33a31e3f5a0095cc6d18656.sqlite`

Baseline result:

- Existing dependency surfaces checked: 12
- Skipped because absent from the local schema:
  `order_status_history.order_id`, `customer_reviews.order_id`
- `orders.public_id` bridge violations: 0 missing, 0 duplicate
- Dependency shadow-copy failures: 0 unmapped order references
- `PRAGMA foreign_key_check`: 0 rows
- Local fixture row counts are currently zero for `orders` and all checked
  dependent surfaces; this proves script safety and schema coverage, not data
  volume behavior.
- With `--require-representative-data`, this same baseline correctly exits 1
  because `orders` has zero rows and no checked dependency has non-null order
  references. This is expected and prevents treating the empty local database
  as conversion-ready evidence.
- `rtk pnpm db:orders-pk-dry-run:representative` intentionally does not use
  `--with-fixture`; it is only valid when the selected database already has real
  representative order data.

Representative fixture result:

- The rehearsal inserted one rollback-only `phase-c-orders-pk-*` fixture order
  and one dependent row for each existing order FK/pointer surface.
- Existing dependency surfaces checked: 12
- Every checked surface had `mapped_order_refs = non_null_order_refs = 1`.
- `orders.public_id` bridge violations: 0 missing, 0 duplicate
- Dependency shadow-copy failures: 0 unmapped order references
- `PRAGMA foreign_key_check`: 0 rows
- Rollback verification after the run found zero persisted
  `phase-c-orders-pk-*` rows in `orders`, `restaurants`, `users`,
  `payment_transactions`, `market_checkout_sessions`, and `partnerships`.
- With `--require-representative-data`, the fixture run exits 0 and records
  `dataCoverage.isRepresentative = true`, `orderRows = 1`,
  `dependencyRefs = 12`, and `dependenciesWithRefs = 12`.
- With `--require-complete-surface-coverage`, the fixture run also exits 0 only
  when every existing dependency surface has at least one non-null order
  reference and includes `schemaObjects` metadata for the indexes/triggers that
  the paired migration must preserve.
- `rtk pnpm db:orders-pk-dry-run:fixture-full-surface` is the local synthetic
  full-surface coverage command. Its artifact must be validated with
  `--role fixture`, not `--role representative`.
- The fixture artifact records `appCompatibility` bridge checks: one legacy
  `orders.id` lookup row, one matching `orders.public_id` lookup row, zero
  lookup mismatches, 12 shadow-copy public-id rows, zero missing shadow public
  ids, and zero shadow public ids that fail to resolve back to the source order.

## Dependency Map

| Surface | Kind | Local rows | Refs mapped | Indexes / triggers to preserve | Write paths |
| --- | --- | ---: | ---: | --- | --- |
| `order_items.order_id` | FK, not null, cascade | 1 | 1 / 1 | `order_items_order_status_idx`, `order_items_menu_item_idx` | `packages/database/src/services/order.ts` |
| `payment_transactions.order_id` | FK, not null, cascade | 1 | 1 / 1 | `payment_transactions_order_idx`, `payment_transactions_restaurant_status_idx`, `payment_transactions_idempotency_idx`, `payment_transactions_transaction_id_unique` | `apps/api/src/features/payments/services/PaymentService.ts`, `apps/api/src/features/payments/services/refundPayment.ts`, `apps/api/src/features/pos/services/MarketCheckoutPOSPaymentService.ts` |
| `refund_transactions.order_id` | FK, not null, cascade | 1 | 1 / 1 | `refund_transactions_order_idx`, `refund_transactions_payment_idx`, `refund_transactions_refund_id_unique` | `apps/api/src/features/payments/services/refundPayment.ts` |
| `receipts.order_id` | FK, not null, no action | 1 | 1 / 1 | `idx_receipts_order`, `idx_receipts_register`, `idx_receipts_shift`, `idx_receipts_print_status`, `receipts_receipt_number_unique`, `sqlite_autoindex_receipts_1` | `apps/api/src/features/pos/services/ReceiptService.ts`, `packages/database/src/services/POSService.ts` |
| `refunds.original_order_id` | FK, not null, no action | 1 | 1 / 1 | `idx_refunds_order`, `idx_refunds_register`, `idx_refunds_shift`, `idx_refunds_status`, `refunds_refund_number_unique`, `sqlite_autoindex_refunds_1` | `apps/api/src/features/pos/services/RefundService.ts`, `packages/database/src/services/POSService.ts` |
| `platform_orders.order_id` | FK, not null, cascade | 1 | 1 / 1 | `platform_orders_order_idx`, `platform_orders_platform_order_idx`, `platform_orders_restaurant_platform_idx`; triggers `platform_orders_restaurant_guard_bi`, `platform_orders_restaurant_guard_bu` | `apps/api/src/features/integrations/services/PlatformOrderService.ts` |
| `partnership_usage_logs.order_id` | FK, not null, cascade | 1 | 1 / 1 | `idx_partnership_usage_logs_order`, `idx_partnership_usage_logs_member`, `idx_partnership_usage_logs_partnership`, `idx_partnership_usage_logs_plan`, `idx_partnership_usage_logs_restaurant`, `idx_partnership_usage_logs_status`, `idx_partnership_usage_logs_date`, `sqlite_autoindex_partnership_usage_logs_1`; restaurant guard and stats triggers | `packages/database/src/services/PartnershipService.ts` |
| `coupon_usage.order_id` | FK, not null, cascade | 1 | 1 / 1 | `idx_coupon_usage_order_id`, `idx_coupon_usage_unique`, `coupon_usage_coupon_order_active_unique`, `idx_coupon_usage_coupon_id`, `idx_coupon_usage_user_id`, `idx_coupon_usage_used_at`, `idx_coupon_usage_status` | `packages/database/src/services/order.ts`, `packages/database/src/services/coupon.ts`, `apps/api/src/features/market-checkouts/services/MarketCheckoutVoucherService.ts` |
| `market_checkout_child_orders.order_id` | Runtime pointer, not null | 1 | 1 / 1 | `market_checkout_child_orders_checkout_idx`, `market_checkout_child_orders_restaurant_idx`, `market_checkout_child_orders_checkout_order_idx` | `apps/api/src/features/market-checkouts` |
| `group_orders.master_order_id` | Runtime pointer, nullable; legacy migrations had cascade FK | 1 | 1 / 1 | `group_orders_share_code_unique`, `idx_group_orders_restaurant_status`, `idx_group_orders_status_created`, `idx_group_orders_table`, `idx_group_orders_expires`, `sqlite_autoindex_group_orders_1`; restaurant guard triggers | `apps/api/src/features/group-orders/services/GroupOrdersService.ts` |
| `tables.current_order_id` | Runtime pointer, nullable | 1 | 1 / 1 | `tables_restaurant_number_idx`, `tables_restaurant_status_idx`, `tables_qr_code_idx`, `tables_qr_code_unique`; restaurant guard triggers | `packages/database/src/services/table.ts`, `apps/api/src/features/payments/services/PaymentService.ts` |
| `seats.current_order_id` | Runtime pointer, nullable | 1 | 1 / 1 | `seats_table_id_idx`, `seats_table_seat_number_idx`, `seats_qr_code_idx`, `seats_qr_code_unique`, `seats_is_occupied_idx`, `seats_is_active_idx` | `packages/database/src/services/seat.ts` |
| `order_status_history.order_id` | Legacy migration FK, not null, cascade | absent locally | n/a | Must be introspected if present in target data | `packages/database/migrations/0009_additional_tables.sql` |
| `customer_reviews.order_id` | Legacy migration FK, not null, cascade | absent locally | n/a | Must be introspected if present in target data | `packages/database/migrations/0009_additional_tables.sql` |

`Refs mapped` is `mapped_order_refs / non_null_order_refs` from the dry-run
shadow copy. Any nonzero unmapped count blocks migration conversion.

## Dry-Run Contract

The rehearsal script must remain non-destructive:

- It creates only `TEMP` tables.
- With `--with-fixture`, it inserts representative rows only inside the rollback
  transaction.
- It maps legacy integer references to `orders.public_id` through shadow copy
  tables.
- It checks row-count parity for every non-null order reference.
- It records bridge compatibility counters proving checked orders resolve by
  both legacy `orders.id` and `orders.public_id`, and that shadow-copy public
  ids resolve back to their source legacy order rows.
- It runs `PRAGMA foreign_key_check`.
- It rolls back at the end.
- With `--json-output`, it writes the same rehearsal result printed to stdout
  to a caller-provided file so staging/prod drill evidence can be archived.
- The JSON artifact includes `dataCoverage` and `assessment` sections. The
  assessment is the canonical exit-code reason list for bridge violations,
  unmapped references, shadow-copy row-count parity failures,
  `foreign_key_check` rows, and optional representative-data failures.
- The JSON artifact includes `rehearsalOptions`. Migration-ready evidence must
  show `requireRepresentativeData = true` and
  `requireCompleteSurfaceCoverage = true`.
- The JSON artifact includes `artifactPhase = "orders"` so validator runs can
  reject mismatched archived evidence.
- The JSON artifact includes `artifactSchemaVersion = 1`; older or future
  artifact contracts must not pass the conversion gate by accident.
- The JSON artifact includes `schemaObjects` per checked dependency surface.
  With `--require-complete-surface-coverage`, the assessment fails if any
  checked dependency has zero non-null order references or is missing that
  schema metadata.
- Under the same strict gate, the assessment also fails if public-id lookup
  returns no rows, legacy/public lookup has mismatches, or shadow-copy public
  ids are missing or cannot resolve back to the source order.

The unit test `tests/unit/phase-c-orders-pk-dry-run.test.ts` guards that the
generated SQL contains `BEGIN` / `ROLLBACK`, creates temp shadow tables, and
does not contain `ALTER TABLE`, `DROP TABLE`, or `DELETE FROM`. It also guards
the local execution option parser, including `--json-output`.

## Readiness Manifest

Before paired Phase C migrations are drafted, create a manifest that points to
both required artifacts:

```json
{
  "manifestSchemaVersion": 1,
  "readinessPhase": "phase-c-orders-pk",
  "target": {
    "artifactPhase": "orders",
    "artifactSchemaVersion": 1
  },
  "artifacts": {
    "representative": {
      "path": "artifacts/pk/orders-restored-prod-representative.json",
      "role": "representative",
      "source": {
        "kind": "restored-production",
        "label": "prod-restore-YYYY-MM-DD"
      }
    },
    "rollbackFixture": {
      "path": "artifacts/pk/orders-local-full-surface-fixture.json",
      "role": "fixture",
      "source": {
        "kind": "local",
        "label": "miniflare-d1"
      }
    }
  }
}
```

`rtk pnpm db:orders-pk-readiness:verify -- --manifest <manifest-json>` is the
single Phase C conversion gate. It imports the single-artifact validator,
requires the representative artifact to be staging/restored-production evidence
without fixture data, requires the rollback fixture artifact to use
`--with-fixture`, and then compares dependency surfaces plus schema metadata
between both artifacts.

## Migration Conversion Gate

Do not create paired Phase C migrations until all of these are true:

- A local or staging rehearsal contains non-empty representative order data.
- The archived rehearsal was run with `--require-representative-data`, and the
  JSON artifact has `assessment.exitCode = 0` and
  `assessment.failures = []`, and `dataCoverage.isRepresentative = true`.
- The rollback fixture rehearsal was also run with
  `--require-complete-surface-coverage`, proving every existing dependency
  surface can be copied and emits schema metadata for migration preservation.
- Every dependency has `mapped_order_refs = non_null_order_refs`.
- `orders.public_id` has zero missing or duplicate values.
- `appCompatibility` has nonzero public lookup coverage and zero legacy/public
  lookup mismatches, missing shadow public ids, and shadow public-id resolution
  mismatches.
- `PRAGMA foreign_key_check` returns zero rows.
- `rtk pnpm db:pk-rehearsal:validate -- --phase orders --artifact <archived-json> --role representative`
  returns `exitCode = 0` for the archived staging/restored-production evidence.
  This role gate rejects rollback fixture artifacts so synthetic local data
  cannot be substituted for real representative data.
- `rtk pnpm db:pk-rehearsal:validate -- --phase orders --artifact <fixture-json> --role fixture`
  returns `exitCode = 0` for the local full-surface rollback fixture artifact.
  The validator recomputes dependency-surface and non-null reference coverage
  from the artifact and requires `ordersBridge.order_rows > 0` instead of
  trusting `dataCoverage` alone. It also verifies the archived artifact records
  `artifactPhase = "orders"`, `artifactSchemaVersion = 1`, and the required
  strict `rehearsalOptions`.
- `rtk pnpm db:orders-pk-readiness:verify -- --manifest <manifest-json>`
  returns `exitCode = 0`, proving the representative and fixture artifacts
  both pass their role gates and have matching dependency surfaces and schema
  metadata.
- The migration draft preserves all listed indexes and triggers.
- API/realtime/POS/payment compatibility tests still pass with UUID bridge
  identifiers.

## Phase D Parallel Prep

The next non-destructive prep work for users should mirror the orders bridge:

- Add `users.public_id TEXT UNIQUE` behind a compatibility bridge.
- Backfill existing user rows with UUID-v7 values.
- Add an auth principal resolver that accepts legacy numeric `users.id` and new
  `users.public_id`.
- Issue new staff JWTs with string principal identity only after auth middleware,
  realtime auth, management API auth, session storage, and token revocation have
  compatibility tests.
