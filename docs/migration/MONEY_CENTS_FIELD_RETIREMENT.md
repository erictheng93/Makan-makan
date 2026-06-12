# Money Cents Field Retirement Plan

Last reviewed: 2026-06-12

## Current State

The cents migration is intentionally incomplete. Current Drizzle schema still
keeps legacy `REAL` money columns beside newer integer `*_cents` shadow columns.
The fresh migrations backfill cents values and add sync triggers, but they do
not remove the old `REAL` columns. Migration
`0067_money_cents_retirement_rollout_guard.sql` is a dedicated non-destructive
rollout gate, not the destructive cutover.

This means a follow-up migration must be separate from the original cents
backfill work. Dropping the legacy columns should wait until application reads
and writes have converged on cents and production data has passed an explicit
audit.

## In Scope

These schema surfaces currently have money-like `REAL` columns with cents
counterparts or planned cents counterparts:

- Orders: `orders`, `order_items`
- Menu and discovery: `menu_items`, `dish_search_index`
- Coupons: `coupons`, `coupon_usage`
- Group ordering: `group_orders`, `group_cart_items`, `split_bills`
- POS: `cash_shifts`, `cash_movements`, `refunds`
- Partnerships: `partnerships`, `partnership_plans`,
  `partnership_usage_logs`, `verified_members`
- Secondary money surfaces: `ingredient_definitions.cost_per_unit`,
  `shift_templates.hourly_rate`

Do not treat every `REAL` column as money. Ratios, percentages, ratings,
coordinates, fractional leave days, and other non-currency numeric values should
remain outside this migration unless a separate domain decision says otherwise.
Percentage discount values are also special: when `discount_type` is
`percentage`, the percentage lives in the legacy value column and the cents
column should remain `NULL`.

## Exit Criteria Before Table Rebuild

- Every production write path populates the relevant `*_cents` value directly,
  or is covered by a verified database trigger during the transition window.
- Every production read path treats cents as authoritative. Legacy `REAL`
  values may only be used as compatibility fallback while old rows are still
  being audited.
- Public API contracts are explicit about whether values are decimal currency
  amounts or integer cents.
- `data_integrity_audit` shows zero unresolved mismatches between legacy `REAL`
  values and `*_cents` values for all in-scope tables.
- Null handling is verified for nullable money fields such as refund amounts,
  max discount caps, end-of-shift amounts, and optional costs.
- Percentage discount rows are excluded from fixed-money cents checks.

## Required Data Audit

Migration `0027_money_cents_retirement_audit.sql` writes one row per table or
logical surface, plus an aggregate REAL precision check, into
`data_integrity_audit` using the `money_cents_retirement` scope.

Each audit check counts rows where:

- the cents column is `NULL` while the money value should have cents,
- the cents column is non-`NULL` while the legacy value is `NULL`,
- `*_cents != CAST(round(real_column * 100) AS integer)`, except approved
  percentage fields,
- the legacy value has more than two decimal places and needs business review
  before cents-only retirement.

Representative pattern:

```sql
INSERT OR REPLACE INTO data_integrity_audit
  (scope, table_name, column_name, check_name, severity, violation_count,
   sample_values, details)
SELECT
  'money_cents_retirement',
  'orders',
  'total_amount',
  'real_cents_mismatch',
  'error',
  count(*),
  (SELECT group_concat(id, ',') FROM (
    SELECT id
      FROM orders
     WHERE total_amount_cents IS NULL
        OR total_amount_cents != CAST(round(total_amount * 100) AS integer)
     LIMIT 5
  )),
  'orders.total_amount_cents must match rounded legacy total_amount before REAL column retirement.'
FROM orders
WHERE total_amount_cents IS NULL
   OR total_amount_cents != CAST(round(total_amount * 100) AS integer);
```

## Dedicated Rollout Guard

The first rollout artifact is deliberately separated from FK rebuilds,
timestamp cleanup, product changes, and the eventual destructive table rebuild:

- Fresh track:
  `packages/database/migrations_fresh/0067_money_cents_retirement_rollout_guard.sql`
- Legacy track:
  `packages/database/migrations/0085_money_cents_retirement_rollout_guard.sql`

This guard is executable SQL. It creates an expected
`money_cents_retirement` audit inventory, writes rollout status rows into
`data_integrity_audit` using the `money_cents_retirement_rollout` scope, and
then asserts with `_migration_assert_money_cents_retirement_rollout` that:

- every expected audit row exists,
- every `money_cents_retirement` error row has `violation_count = 0`.

If either assertion fails, the D1 migration fails before any table is rebuilt.
That failure is intentional because the legacy `REAL` columns are still the
only rollback-friendly comparison source.

Run the guard through the normal migration commands:

```bash
rtk pnpm check:migration-dual-track
rtk pnpm db:migrate:staging
rtk pnpm db:migrate:prod
```

After staging and before production, inspect the rollout rows:

```bash
rtk pnpm exec wrangler d1 execute makanmasak-staging \
  --remote \
  --env staging \
  --config=./apps/api/wrangler.toml \
  --command "SELECT scope, table_name, column_name, check_name, violation_count, sample_values FROM data_integrity_audit WHERE scope IN ('money_cents_retirement', 'money_cents_retirement_rollout') AND severity = 'error' ORDER BY scope, table_name, column_name, check_name;"
```

Production must show the same zero-violation rollout rows before a destructive
cutover migration is generated.

## Automated Guard Coverage

`packages/database/src/testing/money-cents-retirement-rollout.test.ts` tracks
the rollout guard inventory. It asserts that both migration tracks contain the
dedicated guard, that the guard fails when an audit row is missing, that it
fails when a tracked audit row has a nonzero violation count, and that it writes
clean `money_cents_retirement_rollout` status rows only after complete clean
audit coverage.

Any new money-like `REAL` field must be added to the inventory, given a cents
counterpart, and covered by the retirement audit before it can be considered
safe for future table rebuild retirement work.

## Current Code Convergence

The service layer is still transitional, but these paths now treat cents as the
authoritative source while preserving decimal API responses:

- analytics, system health, POS reports, POS receipts, payment checks, and
  refund checks,
- coupon validation, available-coupon responses, fixed discount value/cap/minimum
  order formatting, and coupon usage stats,
- database and API group-order cart totals, split bills, payment amount checks,
  and group-order summaries,
- platform integration order ingestion,
- order item/menu snapshot fallbacks and legacy realtime new-order payloads.

Remaining work should keep reducing direct legacy `REAL` reads before any table
rebuild removes those columns.

## Table Rebuild Migration Requirements

SQLite/D1 table rebuilds must be deliberate because columns, constraints,
indexes, triggers, and foreign key behavior are easy to lose. Cloudflare D1
enforces foreign keys during migrations, so any component rebuild that
temporarily violates FK order must begin the relevant migration phase with:

```sql
PRAGMA defer_foreign_keys = ON;
```

For each table:

- create a new table without the retired `REAL` money columns,
- copy data from the old table using the cents columns as source of truth,
- preserve primary keys, foreign keys, unique constraints, defaults, generated
  columns, timestamp columns, soft-delete columns, and indexes,
- re-create only the triggers still needed after legacy columns are gone,
- drop old cents sync triggers that depended on legacy `REAL` writes,
- rename the rebuilt table into place,
- re-run `PRAGMA foreign_key_check` and targeted row-count checks,
- add a migration test that applies all migrations against SQLite/D1-compatible
  test storage and verifies table shape.

The rebuild migration should not be bundled with unrelated FK cleanup,
timestamp cleanup, or product behavior changes.

## Destructive Cutover Runbook

Do not generate or apply the destructive table-rebuild migration until all of
these are true:

- `0067_money_cents_retirement_rollout_guard.sql` has passed in staging and
  production.
- Production `money_cents_retirement_rollout` rows have `violation_count = 0`.
- Drizzle schema and application write paths no longer require the legacy
  `REAL` columns.

When those gates are met, create one dedicated cutover migration, with no FK,
timestamp, or product behavior changes, using this component order:

1. Leaf/search/inventory surfaces: `dish_search_index`,
   `ingredient_definitions`.
2. Scheduling component: stage `employee_schedules`, rebuild
   `shift_templates` without `hourly_rate`, then rebuild `employee_schedules`
   unchanged if D1 FK ordering requires it.
3. Partnership component: stage and rebuild `partnership_usage_logs`,
   `partnership_plans`, `verified_members`, and `partnerships`, retiring only
   the legacy partnership money columns.
4. Group-order component: stage and rebuild `group_cart_items`, `split_bills`,
   and `group_orders`, retiring only legacy group-order money columns.
5. Coupon/order component: stage and rebuild `coupon_usage`, `order_items`,
   `coupons`, and `orders`, plus unchanged direct dependents only if needed for
   D1 FK ordering.
6. POS component: stage and rebuild `cash_movements`, `refunds`, and
   `cash_shifts`, plus unchanged direct dependents only if needed for D1 FK
   ordering.

The final migration must omit only these legacy `REAL` money columns and must
retain the paired cents columns:

| Table | Legacy columns to omit | Cents columns to retain |
| --- | --- | --- |
| `orders` | `subtotal`, `tax_amount`, `service_charge`, `discount_amount`, `total_amount`, `refund_amount` | `subtotal_cents`, `tax_amount_cents`, `service_charge_cents`, `discount_amount_cents`, `total_amount_cents`, `refund_amount_cents` |
| `order_items` | `unit_price`, `total_price` | `unit_price_cents`, `total_price_cents` |
| `menu_items` | `price`, `original_price`, `cost_price` | `price_cents`, `original_price_cents`, `cost_price_cents` |
| `coupons` | `discount_value`, `max_discount_amount`, `min_order_amount` | `discount_value_cents`, `max_discount_amount_cents`, `min_order_amount_cents` |
| `coupon_usage` | `discount_amount`, `original_amount`, `final_amount` | `discount_amount_cents`, `original_amount_cents`, `final_amount_cents` |
| `group_orders` | `total_amount`, `tax_amount`, `service_charge`, `final_amount` | `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents` |
| `group_cart_items` | `unit_price`, `total_price` | `unit_price_cents`, `total_price_cents` |
| `split_bills` | `subtotal`, `tax_amount`, `service_charge`, `discount_amount`, `tip_amount`, `total_amount` | `subtotal_cents`, `tax_amount_cents`, `service_charge_cents`, `discount_amount_cents`, `tip_amount_cents`, `total_amount_cents` |
| `cash_shifts` | `start_amount`, `end_amount`, `expected_amount`, `actual_amount`, `difference_amount`, `total_sales`, `total_refunds`, `cash_sales`, `card_sales`, `digital_sales` | `start_amount_cents`, `end_amount_cents`, `expected_amount_cents`, `actual_amount_cents`, `difference_amount_cents`, `total_sales_cents`, `total_refunds_cents`, `cash_sales_cents`, `card_sales_cents`, `digital_sales_cents` |
| `cash_movements` | `amount` | `amount_cents` |
| `refunds` | `original_amount`, `refund_amount` | `original_amount_cents`, `refund_amount_cents` |
| `dish_search_index` | `price` | `price_cents` |
| `ingredient_definitions` | `cost_per_unit` | `cost_per_unit_cents` |
| `shift_templates` | `hourly_rate` | `hourly_rate_cents` |
| `partnerships` | `default_discount_value`, `total_discount_given`, `total_revenue` | `default_discount_value_cents`, `total_discount_given_cents`, `total_revenue_cents` |
| `partnership_plans` | `discount_value`, `max_discount_amount`, `min_order_amount`, `max_order_amount`, `total_discount_given`, `total_revenue` | `discount_value_cents`, `max_discount_amount_cents`, `min_order_amount_cents`, `max_order_amount_cents`, `total_discount_given_cents`, `total_revenue_cents` |
| `partnership_usage_logs` | `discount_value`, `discount_amount`, `original_amount`, `final_amount` | `discount_value_cents`, `discount_amount_cents`, `original_amount_cents`, `final_amount_cents` |
| `verified_members` | `total_discount_received`, `total_spending` | `total_discount_received_cents`, `total_spending_cents` |

The destructive migration should repeat the guard at the top:

```sql
PRAGMA defer_foreign_keys = ON;

DROP TABLE IF EXISTS `_migration_assert_money_cents_cutover`;
CREATE TABLE `_migration_assert_money_cents_cutover` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);

INSERT INTO `_migration_assert_money_cents_cutover`
SELECT
  'money_cents_retirement_rollout.preflight_zero_errors',
  COALESCE((
    SELECT `violation_count`
      FROM `data_integrity_audit`
     WHERE `scope` = 'money_cents_retirement_rollout'
       AND `table_name` = '_rollout'
       AND `column_name` = 'legacy_real_amounts'
       AND `check_name` = 'preflight_zero_errors'
  ), 1);

INSERT INTO `_migration_assert_money_cents_cutover`
SELECT
  'money_cents_retirement_rollout.audit_coverage_present',
  COALESCE((
    SELECT `violation_count`
      FROM `data_integrity_audit`
     WHERE `scope` = 'money_cents_retirement_rollout'
       AND `table_name` = '_rollout'
       AND `column_name` = 'audit_rows'
       AND `check_name` = 'audit_coverage_present'
  ), 1);
```

Then each table rebuild block must use literal, generated column lists from the
current production schema:

1. `DROP TABLE IF EXISTS <table>__money_cents_cutover`.
2. `CREATE TABLE <table>__money_cents_cutover (...)` with all non-money columns,
   constraints, defaults, and foreign keys preserved, the legacy columns above
   omitted, and the paired cents columns retained.
3. `INSERT INTO <table>__money_cents_cutover (...) SELECT ... FROM <table>`
   with the same retained column list.
4. Insert a row-count assertion into `_migration_assert_money_cents_cutover`.
5. Drop the old table, rename the cutover table into place, and recreate
   indexes plus only non-legacy triggers.

Before marking the destructive migration complete, run:

```sql
PRAGMA foreign_key_check;
```

## Verification Commands

Before opening the retirement PR:

```bash
rtk pnpm typecheck
rtk pnpm test -- --run packages/database
rtk pnpm db:migrate:local
```

Run any added migration test directly if the workspace test command supports
targeted execution.
