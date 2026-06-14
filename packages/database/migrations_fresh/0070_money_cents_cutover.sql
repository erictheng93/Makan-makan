-- Final money cents cutover.
--
-- Preconditions are enforced from the rollout and percentage-bps audits before
-- any legacy REAL money / polymorphic discount columns are removed.

PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_money_cents_cutover`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_money_cents_cutover` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

INSERT INTO `_migration_assert_money_cents_cutover`
SELECT
  'money_cents_retirement.percentage_bps_zero_errors',
  count(*)
FROM `data_integrity_audit`
WHERE `scope` = 'money_cents_retirement'
  AND `severity` = 'error'
  AND `check_name` = 'percentage_bps_missing_or_mismatch'
  AND `violation_count` != 0;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_money_cents_cutover_counts`;
--> statement-breakpoint
CREATE TABLE `_migration_money_cents_cutover_counts` (
  `table_name` text PRIMARY KEY NOT NULL,
  `before_count` integer NOT NULL,
  `after_count` integer
);
--> statement-breakpoint

INSERT INTO `_migration_money_cents_cutover_counts`
  (`table_name`, `before_count`)
VALUES
  ('orders', (SELECT count(*) FROM `orders`)),
  ('order_items', (SELECT count(*) FROM `order_items`)),
  ('menu_items', (SELECT count(*) FROM `menu_items`)),
  ('coupons', (SELECT count(*) FROM `coupons`)),
  ('coupon_usage', (SELECT count(*) FROM `coupon_usage`)),
  ('group_orders', (SELECT count(*) FROM `group_orders`)),
  ('group_cart_items', (SELECT count(*) FROM `group_cart_items`)),
  ('split_bills', (SELECT count(*) FROM `split_bills`)),
  ('cash_shifts', (SELECT count(*) FROM `cash_shifts`)),
  ('cash_movements', (SELECT count(*) FROM `cash_movements`)),
  ('refunds', (SELECT count(*) FROM `refunds`)),
  ('dish_search_index', (SELECT count(*) FROM `dish_search_index`)),
  ('ingredient_definitions', (SELECT count(*) FROM `ingredient_definitions`)),
  ('shift_templates', (SELECT count(*) FROM `shift_templates`)),
  ('partnerships', (SELECT count(*) FROM `partnerships`)),
  ('partnership_plans', (SELECT count(*) FROM `partnership_plans`)),
  ('partnership_usage_logs', (SELECT count(*) FROM `partnership_usage_logs`)),
  ('verified_members', (SELECT count(*) FROM `verified_members`));
--> statement-breakpoint

DROP INDEX IF EXISTS `menu_items_price_range_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `dish_search_price_available_idx`;
--> statement-breakpoint

DROP TRIGGER IF EXISTS `orders_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `orders_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `order_items_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `order_items_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `menu_items_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `menu_items_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `coupons_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `coupons_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `coupon_usage_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `coupon_usage_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `group_orders_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `group_orders_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `group_cart_items_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `group_cart_items_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `split_bills_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `split_bills_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `cash_shifts_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `cash_shifts_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `cash_movements_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `cash_movements_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `refunds_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `refunds_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `dish_search_index_price_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `dish_search_index_price_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `ingredient_definitions_cost_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `ingredient_definitions_cost_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `shift_templates_hourly_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `shift_templates_hourly_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnerships_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnerships_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnership_plans_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnership_plans_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnership_usage_logs_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnership_usage_logs_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `verified_members_cents_sync_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `verified_members_cents_sync_au`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_partnership_usage_update_member_stats`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_partnership_usage_update_plan_stats`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_partnership_usage_update_partnership_stats`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_reset_daily_usage_count`;
--> statement-breakpoint

ALTER TABLE `orders` DROP COLUMN `subtotal`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `tax_amount`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `service_charge`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `discount_amount`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `total_amount`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `refund_amount`;
--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `unit_price`;
--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `total_price`;
--> statement-breakpoint
ALTER TABLE `menu_items` DROP COLUMN `price`;
--> statement-breakpoint
ALTER TABLE `menu_items` DROP COLUMN `original_price`;
--> statement-breakpoint
ALTER TABLE `menu_items` DROP COLUMN `cost_price`;
--> statement-breakpoint
ALTER TABLE `coupons` DROP COLUMN `discount_value`;
--> statement-breakpoint
ALTER TABLE `coupons` DROP COLUMN `max_discount_amount`;
--> statement-breakpoint
ALTER TABLE `coupons` DROP COLUMN `min_order_amount`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` DROP COLUMN `discount_amount`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` DROP COLUMN `original_amount`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` DROP COLUMN `final_amount`;
--> statement-breakpoint
ALTER TABLE `group_orders` DROP COLUMN `total_amount`;
--> statement-breakpoint
ALTER TABLE `group_orders` DROP COLUMN `tax_amount`;
--> statement-breakpoint
ALTER TABLE `group_orders` DROP COLUMN `service_charge`;
--> statement-breakpoint
ALTER TABLE `group_orders` DROP COLUMN `final_amount`;
--> statement-breakpoint
ALTER TABLE `group_cart_items` DROP COLUMN `unit_price`;
--> statement-breakpoint
ALTER TABLE `group_cart_items` DROP COLUMN `total_price`;
--> statement-breakpoint
ALTER TABLE `split_bills` DROP COLUMN `subtotal`;
--> statement-breakpoint
ALTER TABLE `split_bills` DROP COLUMN `tax_amount`;
--> statement-breakpoint
ALTER TABLE `split_bills` DROP COLUMN `service_charge`;
--> statement-breakpoint
ALTER TABLE `split_bills` DROP COLUMN `discount_amount`;
--> statement-breakpoint
ALTER TABLE `split_bills` DROP COLUMN `tip_amount`;
--> statement-breakpoint
ALTER TABLE `split_bills` DROP COLUMN `total_amount`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `start_amount`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `end_amount`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `expected_amount`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `actual_amount`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `difference_amount`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `total_sales`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `total_refunds`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `cash_sales`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `card_sales`;
--> statement-breakpoint
ALTER TABLE `cash_shifts` DROP COLUMN `digital_sales`;
--> statement-breakpoint
ALTER TABLE `cash_movements` DROP COLUMN `amount`;
--> statement-breakpoint
ALTER TABLE `refunds` DROP COLUMN `original_amount`;
--> statement-breakpoint
ALTER TABLE `refunds` DROP COLUMN `refund_amount`;
--> statement-breakpoint
ALTER TABLE `dish_search_index` DROP COLUMN `price`;
--> statement-breakpoint
ALTER TABLE `ingredient_definitions` DROP COLUMN `cost_per_unit`;
--> statement-breakpoint
ALTER TABLE `shift_templates` DROP COLUMN `hourly_rate`;
--> statement-breakpoint
ALTER TABLE `partnerships` DROP COLUMN `default_discount_value`;
--> statement-breakpoint
ALTER TABLE `partnerships` DROP COLUMN `total_discount_given`;
--> statement-breakpoint
ALTER TABLE `partnerships` DROP COLUMN `total_revenue`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` DROP COLUMN `discount_value`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` DROP COLUMN `max_discount_amount`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` DROP COLUMN `min_order_amount`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` DROP COLUMN `max_order_amount`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` DROP COLUMN `total_discount_given`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` DROP COLUMN `total_revenue`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` DROP COLUMN `discount_value`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` DROP COLUMN `discount_amount`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` DROP COLUMN `original_amount`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` DROP COLUMN `final_amount`;
--> statement-breakpoint
ALTER TABLE `verified_members` DROP COLUMN `total_discount_received`;
--> statement-breakpoint
ALTER TABLE `verified_members` DROP COLUMN `total_spending`;
--> statement-breakpoint

CREATE INDEX `menu_items_price_range_idx`
  ON `menu_items` (`restaurant_id`, `price_cents`);
--> statement-breakpoint
CREATE INDEX `dish_search_price_available_idx`
  ON `dish_search_index` (`price_cents`, `is_available`);
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `trg_partnership_usage_update_member_stats`
AFTER INSERT ON `partnership_usage_logs`
FOR EACH ROW
WHEN NEW.`status` = 'completed'
BEGIN
  UPDATE `verified_members`
     SET `total_usage_count` = COALESCE(`total_usage_count`, 0) + 1,
         `total_discount_received_cents` = COALESCE(`total_discount_received_cents`, 0) + COALESCE(NEW.`discount_amount_cents`, 0),
         `total_spending_cents` = COALESCE(`total_spending_cents`, 0) + COALESCE(NEW.`final_amount_cents`, 0),
         `last_used_at_ms` = NEW.`used_at_ms`,
         `updated_at_ms` = unixepoch('now') * 1000
   WHERE `id` = NEW.`member_id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `trg_partnership_usage_update_plan_stats`
AFTER INSERT ON `partnership_usage_logs`
FOR EACH ROW
WHEN NEW.`status` = 'completed'
BEGIN
  UPDATE `partnership_plans`
     SET `total_usage_count` = COALESCE(`total_usage_count`, 0) + 1,
         `total_discount_given_cents` = COALESCE(`total_discount_given_cents`, 0) + COALESCE(NEW.`discount_amount_cents`, 0),
         `total_revenue_cents` = COALESCE(`total_revenue_cents`, 0) + COALESCE(NEW.`final_amount_cents`, 0),
         `updated_at_ms` = unixepoch('now') * 1000
   WHERE `id` = NEW.`plan_id`;

  UPDATE `partnership_plans`
     SET `daily_usage_count` = COALESCE(`daily_usage_count`, 0) + 1
   WHERE `id` = NEW.`plan_id`
     AND date(NEW.`used_at_ms` / 1000, 'unixepoch') = date('now');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `trg_partnership_usage_update_partnership_stats`
AFTER INSERT ON `partnership_usage_logs`
FOR EACH ROW
WHEN NEW.`status` = 'completed'
BEGIN
  UPDATE `partnerships`
     SET `total_usage_count` = COALESCE(`total_usage_count`, 0) + 1,
         `total_discount_given_cents` = COALESCE(`total_discount_given_cents`, 0) + COALESCE(NEW.`discount_amount_cents`, 0),
         `total_revenue_cents` = COALESCE(`total_revenue_cents`, 0) + COALESCE(NEW.`final_amount_cents`, 0),
         `updated_at_ms` = unixepoch('now') * 1000
   WHERE `id` = NEW.`partnership_id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `trg_reset_daily_usage_count`
AFTER UPDATE ON `partnership_plans`
FOR EACH ROW
WHEN date(NEW.`updated_at_ms` / 1000, 'unixepoch') > date(OLD.`updated_at_ms` / 1000, 'unixepoch')
BEGIN
  UPDATE `partnership_plans`
     SET `daily_usage_count` = 0
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

UPDATE `_migration_money_cents_cutover_counts`
   SET `after_count` = CASE `table_name`
     WHEN 'orders' THEN (SELECT count(*) FROM `orders`)
     WHEN 'order_items' THEN (SELECT count(*) FROM `order_items`)
     WHEN 'menu_items' THEN (SELECT count(*) FROM `menu_items`)
     WHEN 'coupons' THEN (SELECT count(*) FROM `coupons`)
     WHEN 'coupon_usage' THEN (SELECT count(*) FROM `coupon_usage`)
     WHEN 'group_orders' THEN (SELECT count(*) FROM `group_orders`)
     WHEN 'group_cart_items' THEN (SELECT count(*) FROM `group_cart_items`)
     WHEN 'split_bills' THEN (SELECT count(*) FROM `split_bills`)
     WHEN 'cash_shifts' THEN (SELECT count(*) FROM `cash_shifts`)
     WHEN 'cash_movements' THEN (SELECT count(*) FROM `cash_movements`)
     WHEN 'refunds' THEN (SELECT count(*) FROM `refunds`)
     WHEN 'dish_search_index' THEN (SELECT count(*) FROM `dish_search_index`)
     WHEN 'ingredient_definitions' THEN (SELECT count(*) FROM `ingredient_definitions`)
     WHEN 'shift_templates' THEN (SELECT count(*) FROM `shift_templates`)
     WHEN 'partnerships' THEN (SELECT count(*) FROM `partnerships`)
     WHEN 'partnership_plans' THEN (SELECT count(*) FROM `partnership_plans`)
     WHEN 'partnership_usage_logs' THEN (SELECT count(*) FROM `partnership_usage_logs`)
     WHEN 'verified_members' THEN (SELECT count(*) FROM `verified_members`)
   END;
--> statement-breakpoint

INSERT INTO `_migration_assert_money_cents_cutover`
SELECT
  'money_cents_cutover.row_counts_unchanged',
  count(*)
FROM `_migration_money_cents_cutover_counts`
WHERE `before_count` != `after_count`
   OR `after_count` IS NULL;
--> statement-breakpoint

INSERT INTO `_migration_assert_money_cents_cutover`
SELECT
  'money_cents_cutover.foreign_key_check',
  count(*)
FROM pragma_foreign_key_check;
--> statement-breakpoint

PRAGMA foreign_key_check;
--> statement-breakpoint

DROP TABLE `_migration_money_cents_cutover_counts`;
--> statement-breakpoint
DROP TABLE `_migration_assert_money_cents_cutover`;
