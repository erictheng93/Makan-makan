# Money Cents Field Retirement Plan

Last reviewed: 2026-05-01

## Current State

The cents migration is intentionally incomplete. Current Drizzle schema still
keeps legacy `REAL` money columns beside newer integer `*_cents` shadow columns.
The fresh migrations backfill cents values and add sync triggers, but they do
not remove the old `REAL` columns.

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

## Executable Inventory Guard

`packages/database/src/testing/__tests__/migration-inventory.test.ts` tracks
the transitional money schema inventory. It asserts that every in-scope legacy
`REAL` money column has a paired integer `*_cents` column, that cents-native
payment ledger columns are explicitly allowlisted, and that
`money_cents_retirement` audit rows stay aligned with the tracked tables.

Any new money-like `REAL` field must be added to the inventory, given a cents
counterpart, and covered by the retirement audit before it can be considered
safe for future table rebuild retirement work.

## Table Rebuild Migration Requirements

SQLite/D1 table rebuilds must be deliberate because columns, constraints,
indexes, triggers, and foreign key behavior are easy to lose. For each table:

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

## Verification Commands

Before opening the retirement PR:

```bash
rtk pnpm typecheck
rtk pnpm test -- --run packages/database
rtk pnpm db:migrate:local
```

Run any added migration test directly if the workspace test command supports
targeted execution.
