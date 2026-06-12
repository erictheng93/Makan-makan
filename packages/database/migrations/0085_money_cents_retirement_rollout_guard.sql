-- Dedicated money cents retirement rollout guard.
--
-- This migration is intentionally non-destructive. It is the production
-- go/no-go gate before a later cents-only table rebuild removes legacy REAL
-- money columns. D1/SQLite table rebuilds are not safe to apply until the
-- money_cents_retirement audit has complete zero-violation coverage.

DROP TABLE IF EXISTS `_migration_expected_money_cents_retirement_rollout`;
--> statement-breakpoint

CREATE TABLE `_migration_expected_money_cents_retirement_rollout` (
  `table_name` text NOT NULL,
  `column_name` text NOT NULL,
  `check_name` text NOT NULL,
  PRIMARY KEY (`table_name`, `column_name`, `check_name`)
);
--> statement-breakpoint

INSERT INTO `_migration_expected_money_cents_retirement_rollout`
  (`table_name`, `column_name`, `check_name`)
VALUES
  ('orders', 'amounts', 'real_cents_mismatch'),
  ('order_items', 'amounts', 'real_cents_mismatch'),
  ('menu_items', 'amounts', 'real_cents_mismatch'),
  ('coupons', 'amounts', 'real_cents_mismatch'),
  ('coupon_usage', 'amounts', 'real_cents_mismatch'),
  ('group_orders', 'amounts', 'real_cents_mismatch'),
  ('group_cart_items', 'amounts', 'real_cents_mismatch'),
  ('split_bills', 'amounts', 'real_cents_mismatch'),
  ('cash_shifts', 'amounts', 'real_cents_mismatch'),
  ('cash_movements', 'amount', 'real_cents_mismatch'),
  ('refunds', 'amounts', 'real_cents_mismatch'),
  ('dish_search_index', 'price', 'real_cents_mismatch'),
  ('ingredient_definitions', 'cost_per_unit', 'real_cents_mismatch'),
  ('shift_templates', 'hourly_rate', 'real_cents_mismatch'),
  ('partnerships', 'amounts', 'real_cents_mismatch'),
  ('partnership_plans', 'amounts', 'real_cents_mismatch'),
  ('partnership_usage_logs', 'amounts', 'real_cents_mismatch'),
  ('verified_members', 'amounts', 'real_cents_mismatch'),
  ('_all_money_tables', 'legacy_real_amounts', 'real_scale_over_two_decimals');
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement_rollout',
  '_rollout',
  'legacy_real_amounts',
  'preflight_zero_errors',
  'error',
  count(*),
  (SELECT group_concat(`table_name` || '.' || `column_name`, ',') FROM (
    SELECT `table_name`, `column_name`
      FROM `data_integrity_audit`
     WHERE `scope` = 'money_cents_retirement'
       AND `severity` = 'error'
       AND `violation_count` != 0
     ORDER BY `table_name`, `column_name`
     LIMIT 5
  )),
  'Money cents table-rebuild rollout may proceed only after all money_cents_retirement error audit rows have violation_count = 0.'
FROM `data_integrity_audit`
WHERE `scope` = 'money_cents_retirement'
  AND `severity` = 'error'
  AND `violation_count` != 0;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement_rollout',
  '_rollout',
  'audit_rows',
  'audit_coverage_present',
  'error',
  count(*),
  (SELECT group_concat(`table_name` || '.' || `column_name`, ',') FROM (
    SELECT `expected`.`table_name`, `expected`.`column_name`
      FROM `_migration_expected_money_cents_retirement_rollout` AS `expected`
      LEFT JOIN `data_integrity_audit` AS `audit`
        ON `audit`.`scope` = 'money_cents_retirement'
       AND `audit`.`severity` = 'error'
       AND `audit`.`table_name` = `expected`.`table_name`
       AND `audit`.`column_name` = `expected`.`column_name`
       AND `audit`.`check_name` = `expected`.`check_name`
     WHERE `audit`.`id` IS NULL
     ORDER BY `expected`.`table_name`, `expected`.`column_name`
     LIMIT 5
  )),
  'Every tracked legacy REAL money surface must have a money_cents_retirement audit row before cents-only table rebuild.'
FROM `_migration_expected_money_cents_retirement_rollout` AS `expected`
LEFT JOIN `data_integrity_audit` AS `audit`
  ON `audit`.`scope` = 'money_cents_retirement'
 AND `audit`.`severity` = 'error'
 AND `audit`.`table_name` = `expected`.`table_name`
 AND `audit`.`column_name` = `expected`.`column_name`
 AND `audit`.`check_name` = `expected`.`check_name`
WHERE `audit`.`id` IS NULL;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_money_cents_retirement_rollout`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_money_cents_retirement_rollout` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_money_cents_retirement_rollout`
SELECT
  'preflight_zero_errors',
  `violation_count`
FROM `data_integrity_audit`
WHERE `scope` = 'money_cents_retirement_rollout'
  AND `table_name` = '_rollout'
  AND `column_name` = 'legacy_real_amounts'
  AND `check_name` = 'preflight_zero_errors';
--> statement-breakpoint

INSERT INTO `_migration_assert_money_cents_retirement_rollout`
SELECT
  'audit_coverage_present',
  `violation_count`
FROM `data_integrity_audit`
WHERE `scope` = 'money_cents_retirement_rollout'
  AND `table_name` = '_rollout'
  AND `column_name` = 'audit_rows'
  AND `check_name` = 'audit_coverage_present';
--> statement-breakpoint

DROP TABLE `_migration_assert_money_cents_retirement_rollout`;
--> statement-breakpoint

DROP TABLE `_migration_expected_money_cents_retirement_rollout`;
