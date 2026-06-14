-- Preserve percentage discount values before retiring polymorphic
-- discount_value REAL columns. Percentage values are not money and must not be
-- represented in *_cents columns.

ALTER TABLE `coupons` ADD COLUMN `discount_percentage_bps` integer;
--> statement-breakpoint
ALTER TABLE `partnerships` ADD COLUMN `default_discount_percentage_bps` integer;
--> statement-breakpoint
ALTER TABLE `partnership_plans` ADD COLUMN `discount_percentage_bps` integer;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` ADD COLUMN `discount_percentage_bps` integer;
--> statement-breakpoint

UPDATE `coupons`
   SET `discount_percentage_bps` =
         CASE WHEN `discount_type` = 'percentage' THEN CAST(round(`discount_value` * 100) AS integer) ELSE NULL END;
--> statement-breakpoint
UPDATE `partnerships`
   SET `default_discount_percentage_bps` =
         CASE WHEN `default_discount_type` = 'percentage' AND `default_discount_value` IS NOT NULL
              THEN CAST(round(`default_discount_value` * 100) AS integer)
              ELSE NULL END;
--> statement-breakpoint
UPDATE `partnership_plans`
   SET `discount_percentage_bps` =
         CASE WHEN `discount_type` = 'percentage' THEN CAST(round(`discount_value` * 100) AS integer) ELSE NULL END;
--> statement-breakpoint
UPDATE `partnership_usage_logs`
   SET `discount_percentage_bps` =
         CASE WHEN `discount_type` = 'percentage' THEN CAST(round(`discount_value` * 100) AS integer) ELSE NULL END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS `coupons_cents_sync_ai`;
--> statement-breakpoint
CREATE TRIGGER `coupons_cents_sync_ai`
AFTER INSERT ON `coupons`
FOR EACH ROW
BEGIN
  UPDATE `coupons`
     SET `discount_percentage_bps` = CASE WHEN NEW.`discount_type` = 'percentage' THEN CAST(round(NEW.`discount_value` * 100) AS integer) ELSE NULL END,
         `discount_value_cents` = CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` = CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` = CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `coupons_cents_sync_au`;
--> statement-breakpoint
CREATE TRIGGER `coupons_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `max_discount_amount`, `min_order_amount` ON `coupons`
FOR EACH ROW
BEGIN
  UPDATE `coupons`
     SET `discount_percentage_bps` = CASE WHEN NEW.`discount_type` = 'percentage' THEN CAST(round(NEW.`discount_value` * 100) AS integer) ELSE NULL END,
         `discount_value_cents` = CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` = CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` = CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS `partnerships_cents_sync_ai`;
--> statement-breakpoint
CREATE TRIGGER `partnerships_cents_sync_ai`
AFTER INSERT ON `partnerships`
FOR EACH ROW
BEGIN
  UPDATE `partnerships`
     SET `default_discount_percentage_bps` =
           CASE WHEN NEW.`default_discount_type` = 'percentage' AND NEW.`default_discount_value` IS NOT NULL
                THEN CAST(round(NEW.`default_discount_value` * 100) AS integer)
                ELSE NULL END,
         `default_discount_value_cents` =
           CASE WHEN NEW.`default_discount_value` IS NULL OR NEW.`default_discount_type` = 'percentage'
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
DROP TRIGGER IF EXISTS `partnerships_cents_sync_au`;
--> statement-breakpoint
CREATE TRIGGER `partnerships_cents_sync_au`
AFTER UPDATE OF `default_discount_type`, `default_discount_value`, `total_discount_given`, `total_revenue` ON `partnerships`
FOR EACH ROW
BEGIN
  UPDATE `partnerships`
     SET `default_discount_percentage_bps` =
           CASE WHEN NEW.`default_discount_type` = 'percentage' AND NEW.`default_discount_value` IS NOT NULL
                THEN CAST(round(NEW.`default_discount_value` * 100) AS integer)
                ELSE NULL END,
         `default_discount_value_cents` =
           CASE WHEN NEW.`default_discount_value` IS NULL OR NEW.`default_discount_type` = 'percentage'
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

DROP TRIGGER IF EXISTS `partnership_plans_cents_sync_ai`;
--> statement-breakpoint
CREATE TRIGGER `partnership_plans_cents_sync_ai`
AFTER INSERT ON `partnership_plans`
FOR EACH ROW
BEGIN
  UPDATE `partnership_plans`
     SET `discount_percentage_bps` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN CAST(round(NEW.`discount_value` * 100) AS integer) ELSE NULL END,
         `discount_value_cents` =
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
DROP TRIGGER IF EXISTS `partnership_plans_cents_sync_au`;
--> statement-breakpoint
CREATE TRIGGER `partnership_plans_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `max_discount_amount`, `min_order_amount`, `max_order_amount`, `total_discount_given`, `total_revenue` ON `partnership_plans`
FOR EACH ROW
BEGIN
  UPDATE `partnership_plans`
     SET `discount_percentage_bps` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN CAST(round(NEW.`discount_value` * 100) AS integer) ELSE NULL END,
         `discount_value_cents` =
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

DROP TRIGGER IF EXISTS `partnership_usage_logs_cents_sync_ai`;
--> statement-breakpoint
CREATE TRIGGER `partnership_usage_logs_cents_sync_ai`
AFTER INSERT ON `partnership_usage_logs`
FOR EACH ROW
BEGIN
  UPDATE `partnership_usage_logs`
     SET `discount_percentage_bps` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN CAST(round(NEW.`discount_value` * 100) AS integer) ELSE NULL END,
         `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `partnership_usage_logs_cents_sync_au`;
--> statement-breakpoint
CREATE TRIGGER `partnership_usage_logs_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `discount_amount`, `original_amount`, `final_amount` ON `partnership_usage_logs`
FOR EACH ROW
BEGIN
  UPDATE `partnership_usage_logs`
     SET `discount_percentage_bps` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN CAST(round(NEW.`discount_value` * 100) AS integer) ELSE NULL END,
         `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_expected_discount_percentage_bps`;
--> statement-breakpoint
CREATE TABLE `_migration_expected_discount_percentage_bps` (
  `table_name` text NOT NULL,
  `column_name` text NOT NULL,
  `check_name` text NOT NULL,
  PRIMARY KEY (`table_name`, `column_name`, `check_name`)
);
--> statement-breakpoint
INSERT INTO `_migration_expected_discount_percentage_bps`
  (`table_name`, `column_name`, `check_name`)
VALUES
  ('coupons', 'discount_percentage_bps', 'percentage_bps_missing_or_mismatch'),
  ('partnerships', 'default_discount_percentage_bps', 'percentage_bps_missing_or_mismatch'),
  ('partnership_plans', 'discount_percentage_bps', 'percentage_bps_missing_or_mismatch'),
  ('partnership_usage_logs', 'discount_percentage_bps', 'percentage_bps_missing_or_mismatch');
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT 'money_cents_retirement', 'coupons', 'discount_percentage_bps', 'percentage_bps_missing_or_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id` FROM `coupons`
     WHERE (`discount_type` = 'percentage' AND (`discount_percentage_bps` IS NULL OR `discount_percentage_bps` != CAST(round(`discount_value` * 100) AS integer)))
        OR (`discount_type` != 'percentage' AND `discount_percentage_bps` IS NOT NULL)
     LIMIT 5
  )),
  'Percentage coupon values must be preserved in discount_percentage_bps before discount_value cutover; non-percentage rows must keep it NULL.'
FROM `coupons`
WHERE (`discount_type` = 'percentage' AND (`discount_percentage_bps` IS NULL OR `discount_percentage_bps` != CAST(round(`discount_value` * 100) AS integer)))
   OR (`discount_type` != 'percentage' AND `discount_percentage_bps` IS NOT NULL);
--> statement-breakpoint
INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT 'money_cents_retirement', 'partnerships', 'default_discount_percentage_bps', 'percentage_bps_missing_or_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id` FROM `partnerships`
     WHERE (`default_discount_type` = 'percentage' AND `default_discount_value` IS NOT NULL AND (`default_discount_percentage_bps` IS NULL OR `default_discount_percentage_bps` != CAST(round(`default_discount_value` * 100) AS integer)))
        OR (coalesce(`default_discount_type`, '') != 'percentage' AND `default_discount_percentage_bps` IS NOT NULL)
     LIMIT 5
  )),
  'Percentage partnership defaults must be preserved in default_discount_percentage_bps before default_discount_value cutover; non-percentage rows must keep it NULL.'
FROM `partnerships`
WHERE (`default_discount_type` = 'percentage' AND `default_discount_value` IS NOT NULL AND (`default_discount_percentage_bps` IS NULL OR `default_discount_percentage_bps` != CAST(round(`default_discount_value` * 100) AS integer)))
   OR (coalesce(`default_discount_type`, '') != 'percentage' AND `default_discount_percentage_bps` IS NOT NULL);
--> statement-breakpoint
INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT 'money_cents_retirement', 'partnership_plans', 'discount_percentage_bps', 'percentage_bps_missing_or_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id` FROM `partnership_plans`
     WHERE (`discount_type` = 'percentage' AND (`discount_percentage_bps` IS NULL OR `discount_percentage_bps` != CAST(round(`discount_value` * 100) AS integer)))
        OR (`discount_type` != 'percentage' AND `discount_percentage_bps` IS NOT NULL)
     LIMIT 5
  )),
  'Percentage partnership plan values must be preserved in discount_percentage_bps before discount_value cutover; non-percentage rows must keep it NULL.'
FROM `partnership_plans`
WHERE (`discount_type` = 'percentage' AND (`discount_percentage_bps` IS NULL OR `discount_percentage_bps` != CAST(round(`discount_value` * 100) AS integer)))
   OR (`discount_type` != 'percentage' AND `discount_percentage_bps` IS NOT NULL);
--> statement-breakpoint
INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT 'money_cents_retirement', 'partnership_usage_logs', 'discount_percentage_bps', 'percentage_bps_missing_or_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id` FROM `partnership_usage_logs`
     WHERE (`discount_type` = 'percentage' AND (`discount_percentage_bps` IS NULL OR `discount_percentage_bps` != CAST(round(`discount_value` * 100) AS integer)))
        OR (`discount_type` != 'percentage' AND `discount_percentage_bps` IS NOT NULL)
     LIMIT 5
  )),
  'Percentage partnership usage values must be preserved in discount_percentage_bps before discount_value cutover; non-percentage rows must keep it NULL.'
FROM `partnership_usage_logs`
WHERE (`discount_type` = 'percentage' AND (`discount_percentage_bps` IS NULL OR `discount_percentage_bps` != CAST(round(`discount_value` * 100) AS integer)))
   OR (`discount_type` != 'percentage' AND `discount_percentage_bps` IS NOT NULL);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_discount_percentage_bps`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_discount_percentage_bps` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint
INSERT INTO `_migration_assert_discount_percentage_bps`
SELECT 'percentage_bps_audit_coverage', count(*)
FROM `_migration_expected_discount_percentage_bps` AS `expected`
LEFT JOIN `data_integrity_audit` AS `audit`
  ON `audit`.`scope` = 'money_cents_retirement'
 AND `audit`.`severity` = 'error'
 AND `audit`.`table_name` = `expected`.`table_name`
 AND `audit`.`column_name` = `expected`.`column_name`
 AND `audit`.`check_name` = `expected`.`check_name`
WHERE `audit`.`id` IS NULL;
--> statement-breakpoint
INSERT INTO `_migration_assert_discount_percentage_bps`
SELECT 'percentage_bps_zero_errors', count(*)
FROM `data_integrity_audit`
WHERE `scope` = 'money_cents_retirement'
  AND `severity` = 'error'
  AND `check_name` = 'percentage_bps_missing_or_mismatch'
  AND `violation_count` != 0;
