-- 0035 restaurant FK rebuild for cash registers component.
-- Rebuilds cash_registers with a physical restaurant_id FK together
-- with the cash shift/report/receipt/refund tables that reference it.
-- D1 keeps foreign_keys enabled, so this migration uses no-FK staging
-- tables and does not rely on PRAGMA foreign_keys=OFF.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'cash_registers', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `cash_registers`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`)
     LIMIT 5
  )),
  'cash_registers.restaurant_id must reference restaurants.id before component rebuild.'
FROM `cash_registers`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_cash_registers_component_fk_0035`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_cash_registers_component_fk_0035` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_registers.restaurant_id.orphan_restaurant_id', count(*)
FROM `cash_registers`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_shifts.register_id.orphan_register_id', count(*)
FROM `cash_shifts`
WHERE NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `cash_shifts`.`register_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_shifts.operator_id.orphan_operator_id', count(*)
FROM `cash_shifts`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `cash_shifts`.`operator_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_movements.shift_id.orphan_shift_id', count(*)
FROM `cash_movements`
WHERE NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `cash_movements`.`shift_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_movements.register_id.orphan_register_id', count(*)
FROM `cash_movements`
WHERE NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `cash_movements`.`register_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_movements.recorded_by.orphan_recorded_by', count(*)
FROM `cash_movements`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `cash_movements`.`recorded_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'cash_movements.approved_by.orphan_approved_by', count(*)
FROM `cash_movements`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `cash_movements`.`approved_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'receipts.order_id.orphan_order_id', count(*)
FROM `receipts`
WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `receipts`.`order_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'receipts.register_id.orphan_register_id', count(*)
FROM `receipts`
WHERE NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `receipts`.`register_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'receipts.shift_id.orphan_shift_id', count(*)
FROM `receipts`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `receipts`.`shift_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'refunds.original_order_id.orphan_original_order_id', count(*)
FROM `refunds`
WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `refunds`.`original_order_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'refunds.register_id.orphan_register_id', count(*)
FROM `refunds`
WHERE NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `refunds`.`register_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'refunds.shift_id.orphan_shift_id', count(*)
FROM `refunds`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `refunds`.`shift_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'refunds.processed_by.orphan_processed_by', count(*)
FROM `refunds`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `refunds`.`processed_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'refunds.approved_by.orphan_approved_by', count(*)
FROM `refunds`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `refunds`.`approved_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'shift_reports.shift_id.orphan_shift_id', count(*)
FROM `shift_reports`
WHERE NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `shift_reports`.`shift_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'shift_reports.register_id.orphan_register_id', count(*)
FROM `shift_reports`
WHERE NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `shift_reports`.`register_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_fk_0035`
SELECT 'shift_reports.operator_id.orphan_operator_id', count(*)
FROM `shift_reports`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_reports`.`operator_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_cash_registers_component_fk_0035`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_cash_registers_component_counts_0035`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_cash_registers_component_counts_0035` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `cash_movements__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `cash_movements__component_rebuild_data` AS SELECT * FROM `cash_movements`;
--> statement-breakpoint

DROP TABLE IF EXISTS `receipts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `receipts__component_rebuild_data` AS SELECT * FROM `receipts`;
--> statement-breakpoint

DROP TABLE IF EXISTS `refunds__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `refunds__component_rebuild_data` AS SELECT * FROM `refunds`;
--> statement-breakpoint

DROP TABLE IF EXISTS `shift_reports__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `shift_reports__component_rebuild_data` AS SELECT * FROM `shift_reports`;
--> statement-breakpoint

DROP TABLE IF EXISTS `cash_shifts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `cash_shifts__component_rebuild_data` AS SELECT * FROM `cash_shifts`;
--> statement-breakpoint

DROP TABLE IF EXISTS `cash_registers__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `cash_registers__component_rebuild_data` AS SELECT * FROM `cash_registers`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'cash_movements.stage', (SELECT count(*) FROM `cash_movements`), (SELECT count(*) FROM `cash_movements__component_rebuild_data`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'receipts.stage', (SELECT count(*) FROM `receipts`), (SELECT count(*) FROM `receipts__component_rebuild_data`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'refunds.stage', (SELECT count(*) FROM `refunds`), (SELECT count(*) FROM `refunds__component_rebuild_data`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'shift_reports.stage', (SELECT count(*) FROM `shift_reports`), (SELECT count(*) FROM `shift_reports__component_rebuild_data`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'cash_shifts.stage', (SELECT count(*) FROM `cash_shifts`), (SELECT count(*) FROM `cash_shifts__component_rebuild_data`);
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'cash_registers.stage', (SELECT count(*) FROM `cash_registers`), (SELECT count(*) FROM `cash_registers__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `cash_movements`;
--> statement-breakpoint

DROP TABLE `receipts`;
--> statement-breakpoint

DROP TABLE `refunds`;
--> statement-breakpoint

DROP TABLE `shift_reports`;
--> statement-breakpoint

DROP TABLE `cash_shifts`;
--> statement-breakpoint

DROP TABLE `cash_registers`;
--> statement-breakpoint

CREATE TABLE "cash_registers" (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`restaurant_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`current_shift_id` text,
	`hardware_config` text DEFAULT '{}' NOT NULL,
	`peripherals` text DEFAULT '{}' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`last_maintenance_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `cash_registers` (
  `id`,
  `name`,
  `location`,
  `restaurant_id`,
  `is_active`,
  `current_shift_id`,
  `hardware_config`,
  `peripherals`,
  `settings`,
  `last_maintenance_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `name`,
  `location`,
  `restaurant_id`,
  `is_active`,
  `current_shift_id`,
  `hardware_config`,
  `peripherals`,
  `settings`,
  `last_maintenance_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
FROM `cash_registers__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'cash_registers.final', (SELECT count(*) FROM `cash_registers__component_rebuild_data`), (SELECT count(*) FROM `cash_registers`);
--> statement-breakpoint

CREATE INDEX `idx_cash_registers_active` ON `cash_registers` (`restaurant_id`,`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_cash_registers_restaurant` ON `cash_registers` (`restaurant_id`);
--> statement-breakpoint

CREATE TRIGGER `cash_registers_restaurant_guard_bi`
BEFORE INSERT ON `cash_registers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'cash_registers.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `cash_registers_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `cash_registers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'cash_registers.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "cash_shifts" (
	`id` text PRIMARY KEY NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` integer NOT NULL,
	`start_amount` real NOT NULL,
	`end_amount` real,
	`expected_amount` real NOT NULL,
	`actual_amount` real,
	`difference_amount` real DEFAULT 0 NOT NULL,
	`total_sales` real DEFAULT 0 NOT NULL,
	`total_refunds` real DEFAULT 0 NOT NULL,
	`cash_sales` real DEFAULT 0 NOT NULL,
	`card_sales` real DEFAULT 0 NOT NULL,
	`digital_sales` real DEFAULT 0 NOT NULL,
	`total_transactions` integer DEFAULT 0 NOT NULL,
	`started_at_ms` integer NOT NULL,
	`ended_at_ms` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`closing_notes` text,
	`start_amount_cents` integer,
	`end_amount_cents` integer,
	`expected_amount_cents` integer,
	`actual_amount_cents` integer,
	`difference_amount_cents` integer,
	`total_sales_cents` integer,
	`total_refunds_cents` integer,
	`cash_sales_cents` integer,
	`card_sales_cents` integer,
	`digital_sales_cents` integer,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `cash_shifts` (
  `id`,
  `register_id`,
  `operator_id`,
  `start_amount`,
  `end_amount`,
  `expected_amount`,
  `actual_amount`,
  `difference_amount`,
  `total_sales`,
  `total_refunds`,
  `cash_sales`,
  `card_sales`,
  `digital_sales`,
  `total_transactions`,
  `started_at_ms`,
  `ended_at_ms`,
  `status`,
  `notes`,
  `closing_notes`,
  `start_amount_cents`,
  `end_amount_cents`,
  `expected_amount_cents`,
  `actual_amount_cents`,
  `difference_amount_cents`,
  `total_sales_cents`,
  `total_refunds_cents`,
  `cash_sales_cents`,
  `card_sales_cents`,
  `digital_sales_cents`
)
SELECT
  `id`,
  `register_id`,
  `operator_id`,
  `start_amount`,
  `end_amount`,
  `expected_amount`,
  `actual_amount`,
  `difference_amount`,
  `total_sales`,
  `total_refunds`,
  `cash_sales`,
  `card_sales`,
  `digital_sales`,
  `total_transactions`,
  `started_at_ms`,
  `ended_at_ms`,
  `status`,
  `notes`,
  `closing_notes`,
  `start_amount_cents`,
  `end_amount_cents`,
  `expected_amount_cents`,
  `actual_amount_cents`,
  `difference_amount_cents`,
  `total_sales_cents`,
  `total_refunds_cents`,
  `cash_sales_cents`,
  `card_sales_cents`,
  `digital_sales_cents`
FROM `cash_shifts__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'cash_shifts.final', (SELECT count(*) FROM `cash_shifts__component_rebuild_data`), (SELECT count(*) FROM `cash_shifts`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_operator` ON `cash_shifts` (`operator_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_register` ON `cash_shifts` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_started` ON `cash_shifts` (`started_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_status` ON `cash_shifts` (`register_id`,`status`);
--> statement-breakpoint

CREATE TRIGGER `cash_shifts_cents_sync_ai`
AFTER INSERT ON `cash_shifts`
FOR EACH ROW
BEGIN
  UPDATE `cash_shifts`
     SET `start_amount_cents` = CAST(round(NEW.`start_amount` * 100) AS integer),
         `end_amount_cents` = CASE WHEN NEW.`end_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`end_amount` * 100) AS integer) END,
         `expected_amount_cents` = CAST(round(NEW.`expected_amount` * 100) AS integer),
         `actual_amount_cents` = CASE WHEN NEW.`actual_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`actual_amount` * 100) AS integer) END,
         `difference_amount_cents` = CAST(round(NEW.`difference_amount` * 100) AS integer),
         `total_sales_cents` = CAST(round(NEW.`total_sales` * 100) AS integer),
         `total_refunds_cents` = CAST(round(NEW.`total_refunds` * 100) AS integer),
         `cash_sales_cents` = CAST(round(NEW.`cash_sales` * 100) AS integer),
         `card_sales_cents` = CAST(round(NEW.`card_sales` * 100) AS integer),
         `digital_sales_cents` = CAST(round(NEW.`digital_sales` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `cash_shifts_cents_sync_au`
AFTER UPDATE OF `start_amount`, `end_amount`, `expected_amount`, `actual_amount`, `difference_amount`, `total_sales`, `total_refunds`, `cash_sales`, `card_sales`, `digital_sales` ON `cash_shifts`
FOR EACH ROW
BEGIN
  UPDATE `cash_shifts`
     SET `start_amount_cents` = CAST(round(NEW.`start_amount` * 100) AS integer),
         `end_amount_cents` = CASE WHEN NEW.`end_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`end_amount` * 100) AS integer) END,
         `expected_amount_cents` = CAST(round(NEW.`expected_amount` * 100) AS integer),
         `actual_amount_cents` = CASE WHEN NEW.`actual_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`actual_amount` * 100) AS integer) END,
         `difference_amount_cents` = CAST(round(NEW.`difference_amount` * 100) AS integer),
         `total_sales_cents` = CAST(round(NEW.`total_sales` * 100) AS integer),
         `total_refunds_cents` = CAST(round(NEW.`total_refunds` * 100) AS integer),
         `cash_sales_cents` = CAST(round(NEW.`cash_sales` * 100) AS integer),
         `card_sales_cents` = CAST(round(NEW.`card_sales` * 100) AS integer),
         `digital_sales_cents` = CAST(round(NEW.`digital_sales` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE "cash_movements" (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`register_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`reference_id` integer,
	`reference_type` text,
	`payment_method` text,
	`denomination_breakdown` text DEFAULT '{}' NOT NULL,
	`recorded_by` integer NOT NULL,
	`approved_by` integer,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`receipt_number` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`amount_cents` integer,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `cash_movements` (
  `id`,
  `shift_id`,
  `register_id`,
  `type`,
  `amount`,
  `description`,
  `reference_id`,
  `reference_type`,
  `payment_method`,
  `denomination_breakdown`,
  `recorded_by`,
  `approved_by`,
  `approval_status`,
  `receipt_number`,
  `metadata`,
  `created_at_ms`,
  `amount_cents`
)
SELECT
  `id`,
  `shift_id`,
  `register_id`,
  `type`,
  `amount`,
  `description`,
  `reference_id`,
  `reference_type`,
  `payment_method`,
  `denomination_breakdown`,
  `recorded_by`,
  `approved_by`,
  `approval_status`,
  `receipt_number`,
  `metadata`,
  `created_at_ms`,
  `amount_cents`
FROM `cash_movements__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'cash_movements.final', (SELECT count(*) FROM `cash_movements__component_rebuild_data`), (SELECT count(*) FROM `cash_movements`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_created` ON `cash_movements` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_register` ON `cash_movements` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_shift` ON `cash_movements` (`shift_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_type` ON `cash_movements` (`shift_id`,`type`);
--> statement-breakpoint

CREATE TRIGGER `cash_movements_cents_sync_ai`
AFTER INSERT ON `cash_movements`
FOR EACH ROW
BEGIN
  UPDATE `cash_movements`
     SET `amount_cents` = CAST(round(NEW.`amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `cash_movements_cents_sync_au`
AFTER UPDATE OF `amount` ON `cash_movements`
FOR EACH ROW
BEGIN
  UPDATE `cash_movements`
     SET `amount_cents` = CAST(round(NEW.`amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE "receipts" (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` integer NOT NULL,
	`register_id` text NOT NULL,
	`shift_id` text,
	`receipt_number` text NOT NULL,
	`receipt_type` text NOT NULL,
	`template_name` text DEFAULT 'standard' NOT NULL,
	`content` text NOT NULL,
	`raw_content` text,
	`print_status` text DEFAULT 'pending' NOT NULL,
	`print_attempts` integer DEFAULT 0 NOT NULL,
	`printer_name` text,
	`printer_response` text,
	`printed_at_ms` integer,
	`reprinted_count` integer DEFAULT 0 NOT NULL,
	`last_reprint_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `receipts` (
  `id`,
  `order_id`,
  `register_id`,
  `shift_id`,
  `receipt_number`,
  `receipt_type`,
  `template_name`,
  `content`,
  `raw_content`,
  `print_status`,
  `print_attempts`,
  `printer_name`,
  `printer_response`,
  `printed_at_ms`,
  `reprinted_count`,
  `last_reprint_at_ms`,
  `created_at_ms`
)
SELECT
  `id`,
  `order_id`,
  `register_id`,
  `shift_id`,
  `receipt_number`,
  `receipt_type`,
  `template_name`,
  `content`,
  `raw_content`,
  `print_status`,
  `print_attempts`,
  `printer_name`,
  `printer_response`,
  `printed_at_ms`,
  `reprinted_count`,
  `last_reprint_at_ms`,
  `created_at_ms`
FROM `receipts__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'receipts.final', (SELECT count(*) FROM `receipts__component_rebuild_data`), (SELECT count(*) FROM `receipts`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_order` ON `receipts` (`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_print_status` ON `receipts` (`print_status`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_register` ON `receipts` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_shift` ON `receipts` (`shift_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `receipts` (`receipt_number`);
--> statement-breakpoint

CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`original_order_id` integer NOT NULL,
	`register_id` text NOT NULL,
	`shift_id` text,
	`refund_number` text NOT NULL,
	`refund_type` text NOT NULL,
	`original_amount` real NOT NULL,
	`refund_amount` real NOT NULL,
	`refund_method` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_description` text,
	`items_refunded` text DEFAULT '[]' NOT NULL,
	`processed_by` integer NOT NULL,
	`approved_by` integer,
	`customer_signature` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`processed_at_ms` integer,
	`completed_at_ms` integer,
	`original_amount_cents` integer,
	`refund_amount_cents` integer,
	FOREIGN KEY (`original_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `refunds` (
  `id`,
  `original_order_id`,
  `register_id`,
  `shift_id`,
  `refund_number`,
  `refund_type`,
  `original_amount`,
  `refund_amount`,
  `refund_method`,
  `reason_code`,
  `reason_description`,
  `items_refunded`,
  `processed_by`,
  `approved_by`,
  `customer_signature`,
  `status`,
  `metadata`,
  `processed_at_ms`,
  `completed_at_ms`,
  `original_amount_cents`,
  `refund_amount_cents`
)
SELECT
  `id`,
  `original_order_id`,
  `register_id`,
  `shift_id`,
  `refund_number`,
  `refund_type`,
  `original_amount`,
  `refund_amount`,
  `refund_method`,
  `reason_code`,
  `reason_description`,
  `items_refunded`,
  `processed_by`,
  `approved_by`,
  `customer_signature`,
  `status`,
  `metadata`,
  `processed_at_ms`,
  `completed_at_ms`,
  `original_amount_cents`,
  `refund_amount_cents`
FROM `refunds__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'refunds.final', (SELECT count(*) FROM `refunds__component_rebuild_data`), (SELECT count(*) FROM `refunds`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_order` ON `refunds` (`original_order_id`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_register` ON `refunds` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_shift` ON `refunds` (`shift_id`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_status` ON `refunds` (`status`);
--> statement-breakpoint

CREATE UNIQUE INDEX `refunds_refund_number_unique` ON `refunds` (`refund_number`);
--> statement-breakpoint

CREATE TRIGGER `refunds_cents_sync_ai`
AFTER INSERT ON `refunds`
FOR EACH ROW
BEGIN
  UPDATE `refunds`
     SET `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `refund_amount_cents` = CAST(round(NEW.`refund_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `refunds_cents_sync_au`
AFTER UPDATE OF `original_amount`, `refund_amount` ON `refunds`
FOR EACH ROW
BEGIN
  UPDATE `refunds`
     SET `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `refund_amount_cents` = CAST(round(NEW.`refund_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE "shift_reports" (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` integer NOT NULL,
	`report_data` text NOT NULL,
	`summary_data` text NOT NULL,
	`generated_at_ms` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `shift_reports` (
  `id`,
  `shift_id`,
  `register_id`,
  `operator_id`,
  `report_data`,
  `summary_data`,
  `generated_at_ms`
)
SELECT
  `id`,
  `shift_id`,
  `register_id`,
  `operator_id`,
  `report_data`,
  `summary_data`,
  `generated_at_ms`
FROM `shift_reports__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_cash_registers_component_counts_0035`
SELECT 'shift_reports.final', (SELECT count(*) FROM `shift_reports__component_rebuild_data`), (SELECT count(*) FROM `shift_reports`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_generated` ON `shift_reports` (`generated_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_operator` ON `shift_reports` (`operator_id`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_register` ON `shift_reports` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_shift` ON `shift_reports` (`shift_id`);
--> statement-breakpoint

DROP TABLE `cash_movements__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `receipts__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `refunds__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `shift_reports__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `cash_shifts__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `cash_registers__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_cash_registers_component_counts_0035`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'cash_registers', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'cash_registers was rebuilt with a physical restaurant_id FK in 0035 using a D1-safe component rebuild.');
--> statement-breakpoint
