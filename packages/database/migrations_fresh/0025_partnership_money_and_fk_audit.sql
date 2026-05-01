-- Extend integer-cent money handling to partnership/discovery/inventory/scheduling
-- surfaces and expose a reusable restaurant FK orphan audit view for the
-- remaining trigger-guard-only tables.

ALTER TABLE `partnerships` ADD COLUMN `default_discount_value_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnerships` ADD COLUMN `total_discount_given_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnerships` ADD COLUMN `total_revenue_cents` integer;
--> statement-breakpoint
UPDATE `partnerships`
   SET `default_discount_value_cents` =
         CASE
           WHEN `default_discount_value` IS NULL OR `default_discount_type` = 'percentage'
             THEN NULL
           ELSE CAST(round(`default_discount_value` * 100) AS integer)
         END,
       `total_discount_given_cents` =
         CASE WHEN `total_discount_given` IS NULL THEN NULL ELSE CAST(round(`total_discount_given` * 100) AS integer) END,
       `total_revenue_cents` =
         CASE WHEN `total_revenue` IS NULL THEN NULL ELSE CAST(round(`total_revenue` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `partnership_plans` ADD COLUMN `discount_value_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_plans` ADD COLUMN `max_discount_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_plans` ADD COLUMN `min_order_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_plans` ADD COLUMN `max_order_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_plans` ADD COLUMN `total_discount_given_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_plans` ADD COLUMN `total_revenue_cents` integer;
--> statement-breakpoint
UPDATE `partnership_plans`
   SET `discount_value_cents` =
         CASE
           WHEN `discount_type` = 'percentage' THEN NULL
           ELSE CAST(round(`discount_value` * 100) AS integer)
         END,
       `max_discount_amount_cents` =
         CASE WHEN `max_discount_amount` IS NULL THEN NULL ELSE CAST(round(`max_discount_amount` * 100) AS integer) END,
       `min_order_amount_cents` =
         CASE WHEN `min_order_amount` IS NULL THEN NULL ELSE CAST(round(`min_order_amount` * 100) AS integer) END,
       `max_order_amount_cents` =
         CASE WHEN `max_order_amount` IS NULL THEN NULL ELSE CAST(round(`max_order_amount` * 100) AS integer) END,
       `total_discount_given_cents` =
         CASE WHEN `total_discount_given` IS NULL THEN NULL ELSE CAST(round(`total_discount_given` * 100) AS integer) END,
       `total_revenue_cents` =
         CASE WHEN `total_revenue` IS NULL THEN NULL ELSE CAST(round(`total_revenue` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `partnership_usage_logs` ADD COLUMN `discount_value_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` ADD COLUMN `discount_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` ADD COLUMN `original_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` ADD COLUMN `final_amount_cents` integer;
--> statement-breakpoint
UPDATE `partnership_usage_logs`
   SET `discount_value_cents` =
         CASE
           WHEN `discount_type` = 'percentage' THEN NULL
           ELSE CAST(round(`discount_value` * 100) AS integer)
         END,
       `discount_amount_cents` = CAST(round(`discount_amount` * 100) AS integer),
       `original_amount_cents` = CAST(round(`original_amount` * 100) AS integer),
       `final_amount_cents` = CAST(round(`final_amount` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `verified_members` ADD COLUMN `total_discount_received_cents` integer;
--> statement-breakpoint
ALTER TABLE `verified_members` ADD COLUMN `total_spending_cents` integer;
--> statement-breakpoint
UPDATE `verified_members`
   SET `total_discount_received_cents` =
         CASE WHEN `total_discount_received` IS NULL THEN NULL ELSE CAST(round(`total_discount_received` * 100) AS integer) END,
       `total_spending_cents` =
         CASE WHEN `total_spending` IS NULL THEN NULL ELSE CAST(round(`total_spending` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `dish_search_index` ADD COLUMN `price_cents` integer;
--> statement-breakpoint
UPDATE `dish_search_index`
   SET `price_cents` = CASE WHEN `price` IS NULL THEN NULL ELSE CAST(round(`price` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `ingredient_definitions` ADD COLUMN `cost_per_unit_cents` integer;
--> statement-breakpoint
UPDATE `ingredient_definitions`
   SET `cost_per_unit_cents` = CASE WHEN `cost_per_unit` IS NULL THEN NULL ELSE CAST(round(`cost_per_unit` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `shift_templates` ADD COLUMN `hourly_rate_cents` integer;
--> statement-breakpoint
UPDATE `shift_templates`
   SET `hourly_rate_cents` = CASE WHEN `hourly_rate` IS NULL THEN NULL ELSE CAST(round(`hourly_rate` * 100) AS integer) END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'partnerships', 'amounts', 'non_cent_real_value', 'warning',
  count(*), NULL,
  'REAL money values with more than two decimal places in partnership aggregate fields.'
FROM `partnerships`
WHERE (`default_discount_type` != 'percentage' AND `default_discount_value` IS NOT NULL AND abs(round(`default_discount_value` * 100) - (`default_discount_value` * 100)) > 0.000001)
   OR (`total_discount_given` IS NOT NULL AND abs(round(`total_discount_given` * 100) - (`total_discount_given` * 100)) > 0.000001)
   OR (`total_revenue` IS NOT NULL AND abs(round(`total_revenue` * 100) - (`total_revenue` * 100)) > 0.000001);
--> statement-breakpoint
INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'partnership_plans', 'amounts', 'non_cent_real_value', 'warning',
  count(*), NULL,
  'REAL money values with more than two decimal places in partnership plan fields.'
FROM `partnership_plans`
WHERE (`discount_type` != 'percentage' AND abs(round(`discount_value` * 100) - (`discount_value` * 100)) > 0.000001)
   OR (`max_discount_amount` IS NOT NULL AND abs(round(`max_discount_amount` * 100) - (`max_discount_amount` * 100)) > 0.000001)
   OR (`min_order_amount` IS NOT NULL AND abs(round(`min_order_amount` * 100) - (`min_order_amount` * 100)) > 0.000001)
   OR (`max_order_amount` IS NOT NULL AND abs(round(`max_order_amount` * 100) - (`max_order_amount` * 100)) > 0.000001)
   OR (`total_discount_given` IS NOT NULL AND abs(round(`total_discount_given` * 100) - (`total_discount_given` * 100)) > 0.000001)
   OR (`total_revenue` IS NOT NULL AND abs(round(`total_revenue` * 100) - (`total_revenue` * 100)) > 0.000001);
--> statement-breakpoint
INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'partnership_usage_logs', 'amounts', 'non_cent_real_value', 'warning',
  count(*), NULL,
  'REAL money values with more than two decimal places in partnership usage logs.'
FROM `partnership_usage_logs`
WHERE (`discount_type` != 'percentage' AND abs(round(`discount_value` * 100) - (`discount_value` * 100)) > 0.000001)
   OR abs(round(`discount_amount` * 100) - (`discount_amount` * 100)) > 0.000001
   OR abs(round(`original_amount` * 100) - (`original_amount` * 100)) > 0.000001
   OR abs(round(`final_amount` * 100) - (`final_amount` * 100)) > 0.000001;
--> statement-breakpoint
INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'secondary_money_fields', 'amounts', 'non_cent_real_value', 'warning',
  (
    (SELECT count(*) FROM `dish_search_index` WHERE `price` IS NOT NULL AND abs(round(`price` * 100) - (`price` * 100)) > 0.000001)
    +
    (SELECT count(*) FROM `ingredient_definitions` WHERE `cost_per_unit` IS NOT NULL AND abs(round(`cost_per_unit` * 100) - (`cost_per_unit` * 100)) > 0.000001)
    +
    (SELECT count(*) FROM `shift_templates` WHERE `hourly_rate` IS NOT NULL AND abs(round(`hourly_rate` * 100) - (`hourly_rate` * 100)) > 0.000001)
    +
    (SELECT count(*) FROM `verified_members`
      WHERE (`total_discount_received` IS NOT NULL AND abs(round(`total_discount_received` * 100) - (`total_discount_received` * 100)) > 0.000001)
         OR (`total_spending` IS NOT NULL AND abs(round(`total_spending` * 100) - (`total_spending` * 100)) > 0.000001))
  ),
  NULL,
  'REAL money values with more than two decimal places in secondary money fields.';
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `partnerships_cents_sync_ai`
AFTER INSERT ON `partnerships`
FOR EACH ROW
BEGIN
  UPDATE `partnerships`
     SET `default_discount_value_cents` =
           CASE
             WHEN NEW.`default_discount_value` IS NULL OR NEW.`default_discount_type` = 'percentage'
               THEN NULL
             ELSE CAST(round(NEW.`default_discount_value` * 100) AS integer)
           END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `partnerships_cents_sync_au`
AFTER UPDATE OF `default_discount_type`, `default_discount_value`, `total_discount_given`, `total_revenue` ON `partnerships`
FOR EACH ROW
BEGIN
  UPDATE `partnerships`
     SET `default_discount_value_cents` =
           CASE
             WHEN NEW.`default_discount_value` IS NULL OR NEW.`default_discount_type` = 'percentage'
               THEN NULL
             ELSE CAST(round(NEW.`default_discount_value` * 100) AS integer)
           END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `partnership_plans_cents_sync_ai`
AFTER INSERT ON `partnership_plans`
FOR EACH ROW
BEGIN
  UPDATE `partnership_plans`
     SET `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` =
           CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` =
           CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END,
         `max_order_amount_cents` =
           CASE WHEN NEW.`max_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_order_amount` * 100) AS integer) END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `partnership_plans_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `max_discount_amount`, `min_order_amount`, `max_order_amount`, `total_discount_given`, `total_revenue` ON `partnership_plans`
FOR EACH ROW
BEGIN
  UPDATE `partnership_plans`
     SET `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` =
           CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` =
           CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END,
         `max_order_amount_cents` =
           CASE WHEN NEW.`max_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_order_amount` * 100) AS integer) END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `partnership_usage_logs_cents_sync_ai`
AFTER INSERT ON `partnership_usage_logs`
FOR EACH ROW
BEGIN
  UPDATE `partnership_usage_logs`
     SET `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `partnership_usage_logs_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `discount_amount`, `original_amount`, `final_amount` ON `partnership_usage_logs`
FOR EACH ROW
BEGIN
  UPDATE `partnership_usage_logs`
     SET `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `verified_members_cents_sync_ai`
AFTER INSERT ON `verified_members`
FOR EACH ROW
BEGIN
  UPDATE `verified_members`
     SET `total_discount_received_cents` =
           CASE WHEN NEW.`total_discount_received` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_received` * 100) AS integer) END,
         `total_spending_cents` =
           CASE WHEN NEW.`total_spending` IS NULL THEN NULL ELSE CAST(round(NEW.`total_spending` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `verified_members_cents_sync_au`
AFTER UPDATE OF `total_discount_received`, `total_spending` ON `verified_members`
FOR EACH ROW
BEGIN
  UPDATE `verified_members`
     SET `total_discount_received_cents` =
           CASE WHEN NEW.`total_discount_received` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_received` * 100) AS integer) END,
         `total_spending_cents` =
           CASE WHEN NEW.`total_spending` IS NULL THEN NULL ELSE CAST(round(NEW.`total_spending` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `dish_search_index_price_cents_sync_ai`
AFTER INSERT ON `dish_search_index`
FOR EACH ROW
BEGIN
  UPDATE `dish_search_index`
     SET `price_cents` = CASE WHEN NEW.`price` IS NULL THEN NULL ELSE CAST(round(NEW.`price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `dish_search_index_price_cents_sync_au`
AFTER UPDATE OF `price` ON `dish_search_index`
FOR EACH ROW
BEGIN
  UPDATE `dish_search_index`
     SET `price_cents` = CASE WHEN NEW.`price` IS NULL THEN NULL ELSE CAST(round(NEW.`price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `ingredient_definitions_cost_cents_sync_ai`
AFTER INSERT ON `ingredient_definitions`
FOR EACH ROW
BEGIN
  UPDATE `ingredient_definitions`
     SET `cost_per_unit_cents` = CASE WHEN NEW.`cost_per_unit` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_per_unit` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `ingredient_definitions_cost_cents_sync_au`
AFTER UPDATE OF `cost_per_unit` ON `ingredient_definitions`
FOR EACH ROW
BEGIN
  UPDATE `ingredient_definitions`
     SET `cost_per_unit_cents` = CASE WHEN NEW.`cost_per_unit` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_per_unit` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `shift_templates_hourly_cents_sync_ai`
AFTER INSERT ON `shift_templates`
FOR EACH ROW
BEGIN
  UPDATE `shift_templates`
     SET `hourly_rate_cents` = CASE WHEN NEW.`hourly_rate` IS NULL THEN NULL ELSE CAST(round(NEW.`hourly_rate` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `shift_templates_hourly_cents_sync_au`
AFTER UPDATE OF `hourly_rate` ON `shift_templates`
FOR EACH ROW
BEGIN
  UPDATE `shift_templates`
     SET `hourly_rate_cents` = CASE WHEN NEW.`hourly_rate` IS NULL THEN NULL ELSE CAST(round(NEW.`hourly_rate` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE VIEW IF NOT EXISTS `vw_restaurant_fk_orphan_counts` AS
SELECT 'audit_logs' AS `table_name`, count(*) AS `violation_count` FROM `audit_logs` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `audit_logs`.`restaurant_id`)
UNION ALL SELECT 'backup_alerts', count(*) FROM `backup_alerts` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_alerts`.`restaurant_id`)
UNION ALL SELECT 'backup_audit_logs', count(*) FROM `backup_audit_logs` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_audit_logs`.`restaurant_id`)
UNION ALL SELECT 'backup_configurations', count(*) FROM `backup_configurations` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_configurations`.`restaurant_id`)
UNION ALL SELECT 'backup_records', count(*) FROM `backup_records` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_records`.`restaurant_id`)
UNION ALL SELECT 'backup_schedules', count(*) FROM `backup_schedules` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_schedules`.`restaurant_id`)
UNION ALL SELECT 'cash_registers', count(*) FROM `cash_registers` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`)
UNION ALL SELECT 'categories', count(*) FROM `categories` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`)
UNION ALL SELECT 'coupon_templates', count(*) FROM `coupon_templates` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`)
UNION ALL SELECT 'coupons', count(*) FROM `coupons` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`)
UNION ALL SELECT 'dish_search_index', count(*) FROM `dish_search_index` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `dish_search_index`.`restaurant_id`)
UNION ALL SELECT 'employee_availability', count(*) FROM `employee_availability` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_availability`.`restaurant_id`)
UNION ALL SELECT 'employee_leave_balances', count(*) FROM `employee_leave_balances` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_leave_balances`.`restaurant_id`)
UNION ALL SELECT 'employee_schedules', count(*) FROM `employee_schedules` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`)
UNION ALL SELECT 'error_reports', count(*) FROM `error_reports` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `error_reports`.`restaurant_id`)
UNION ALL SELECT 'forecast_cache', count(*) FROM `forecast_cache` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `forecast_cache`.`restaurant_id`)
UNION ALL SELECT 'group_orders', count(*) FROM `group_orders` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`)
UNION ALL SELECT 'images', count(*) FROM `images` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `images`.`restaurant_id`)
UNION ALL SELECT 'ingredient_definitions', count(*) FROM `ingredient_definitions` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `ingredient_definitions`.`restaurant_id`)
UNION ALL SELECT 'leave_approval_rules', count(*) FROM `leave_approval_rules` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`)
UNION ALL SELECT 'leave_calendar_events', count(*) FROM `leave_calendar_events` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_calendar_events`.`restaurant_id`)
UNION ALL SELECT 'leave_requests', count(*) FROM `leave_requests` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`)
UNION ALL SELECT 'leave_types', count(*) FROM `leave_types` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`)
UNION ALL SELECT 'menu_items', count(*) FROM `menu_items` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`)
UNION ALL SELECT 'orders', count(*) FROM `orders` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`)
UNION ALL SELECT 'partnership_plans', count(*) FROM `partnership_plans` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`)
UNION ALL SELECT 'partnership_usage_logs', count(*) FROM `partnership_usage_logs` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`)
UNION ALL SELECT 'platform_integrations', count(*) FROM `platform_integrations` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_integrations`.`restaurant_id`)
UNION ALL SELECT 'platform_menu_mappings', count(*) FROM `platform_menu_mappings` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_menu_mappings`.`restaurant_id`)
UNION ALL SELECT 'platform_orders', count(*) FROM `platform_orders` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_orders`.`restaurant_id`)
UNION ALL SELECT 'platform_webhook_logs', count(*) FROM `platform_webhook_logs` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_webhook_logs`.`restaurant_id`)
UNION ALL SELECT 'qr_batches', count(*) FROM `qr_batches` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `qr_batches`.`restaurant_id`)
UNION ALL SELECT 'reservation_slots', count(*) FROM `reservation_slots` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservation_slots`.`restaurant_id`)
UNION ALL SELECT 'reservations', count(*) FROM `reservations` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`)
UNION ALL SELECT 'restore_operations', count(*) FROM `restore_operations` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `restore_operations`.`restaurant_id`)
UNION ALL SELECT 'schedule_swap_requests', count(*) FROM `schedule_swap_requests` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`)
UNION ALL SELECT 'scheduling_conflicts', count(*) FROM `scheduling_conflicts` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`)
UNION ALL SELECT 'scheduling_rules', count(*) FROM `scheduling_rules` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`)
UNION ALL SELECT 'shift_templates', count(*) FROM `shift_templates` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`)
UNION ALL SELECT 'shop_feedback', count(*) FROM `shop_feedback` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shop_feedback`.`restaurant_id`)
UNION ALL SELECT 'system_alerts', count(*) FROM `system_alerts` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `system_alerts`.`restaurant_id`)
UNION ALL SELECT 'tables', count(*) FROM `tables` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`)
UNION ALL SELECT 'users', count(*) FROM `users` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`)
UNION ALL SELECT 'waiting_list', count(*) FROM `waiting_list` WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk',
  `table_name`,
  'restaurant_id',
  'orphan_restaurant_id',
  'error',
  `violation_count`,
  NULL,
  'Current orphan count for restaurant_id; physical FK table rebuild is safe only when this count is zero.'
FROM `vw_restaurant_fk_orphan_counts`;
