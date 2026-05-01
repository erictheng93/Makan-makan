-- 0030 restaurant fk rebuild core remaining.
-- Adds physical restaurant_id foreign keys through SQLite table rebuilds.
-- Existing orphan rows are audited and asserted before any table swap.

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
  'Preflight for 0030 cash_registers physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `cash_registers`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'categories', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `categories`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 categories physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `categories`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'coupons', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `coupons`
     WHERE `restaurant_id` IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 coupons physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `coupons`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'employee_schedules', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `employee_schedules`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 employee_schedules physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'group_orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `group_orders`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 group_orders physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `group_orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'leave_types', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `leave_types`
     WHERE `restaurant_id` IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 leave_types physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `leave_types`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'menu_items', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `menu_items`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 menu_items physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `menu_items`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `orders`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 orders physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'partnership_plans', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `partnership_plans`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 partnership_plans physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `partnership_plans`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'scheduling_rules', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `scheduling_rules`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 scheduling_rules physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `scheduling_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'shift_templates', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `shift_templates`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 shift_templates physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `shift_templates`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'tables', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `tables`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 tables physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `tables`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'users', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `users`
     WHERE `restaurant_id` IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0030 users physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `users`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_restaurant_fk_0030`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_restaurant_fk_0030` (
  `table_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'cash_registers',
  count(*)
FROM `cash_registers`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'categories',
  count(*)
FROM `categories`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'coupons',
  count(*)
FROM `coupons`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'employee_schedules',
  count(*)
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'group_orders',
  count(*)
FROM `group_orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'leave_types',
  count(*)
FROM `leave_types`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'menu_items',
  count(*)
FROM `menu_items`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'orders',
  count(*)
FROM `orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'partnership_plans',
  count(*)
FROM `partnership_plans`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'scheduling_rules',
  count(*)
FROM `scheduling_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'shift_templates',
  count(*)
FROM `shift_templates`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'tables',
  count(*)
FROM `tables`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0030`
SELECT
  'users',
  count(*)
FROM `users`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_restaurant_fk_0030`;
--> statement-breakpoint

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_restaurant_fk_counts_0030`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_restaurant_fk_counts_0030` (
  `table_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `rebuilt_count` integer NOT NULL,
  CHECK (`source_count` = `rebuilt_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `cash_registers__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `cash_registers__restaurant_fk_rebuild` (
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
	`updated_at_ms` integer NOT NULL
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `cash_registers__restaurant_fk_rebuild` (
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
FROM `cash_registers`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'cash_registers',
  (SELECT count(*) FROM `cash_registers`),
  (SELECT count(*) FROM `cash_registers__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `cash_registers`;
--> statement-breakpoint

ALTER TABLE `cash_registers__restaurant_fk_rebuild` RENAME TO `cash_registers`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'cash_registers', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'cash_registers was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `categories__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `categories__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`image_url` text,
	`icon_url` text,
	`available_hours` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `categories__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `sort_order`,
  `is_active`,
  `is_visible`,
  `image_url`,
  `icon_url`,
  `available_hours`,
  `item_count`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `sort_order`,
  `is_active`,
  `is_visible`,
  `image_url`,
  `icon_url`,
  `available_hours`,
  `item_count`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `categories`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'categories',
  (SELECT count(*) FROM `categories`),
  (SELECT count(*) FROM `categories__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `categories`;
--> statement-breakpoint

ALTER TABLE `categories__restaurant_fk_rebuild` RENAME TO `categories`;
--> statement-breakpoint

CREATE INDEX `categories_restaurant_active_idx` ON `categories` (`restaurant_id`,`is_active`);
--> statement-breakpoint

CREATE INDEX `categories_restaurant_sort_idx` ON `categories` (`restaurant_id`,`sort_order`);
--> statement-breakpoint

CREATE TRIGGER `categories_restaurant_guard_bi`
BEFORE INSERT ON `categories`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'categories.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `categories_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `categories`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'categories.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'categories', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'categories was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `coupons__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `coupons__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`max_discount_amount` real,
	`min_order_amount` real DEFAULT 0,
	`applicable_menu_items` text,
	`applicable_categories` text,
	`usage_limit` integer,
	`usage_limit_per_user` integer,
	`used_count` integer DEFAULT 0,
	`valid_from` text NOT NULL,
	`valid_to` text NOT NULL,
	`is_active` integer DEFAULT true,
	`is_visible` integer DEFAULT true,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
	`created_by` integer,
	"deleted_at_ms" integer, `discount_value_cents` integer, `max_discount_amount_cents` integer, `min_order_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `coupons__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `code`,
  `name`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `usage_limit`,
  `usage_limit_per_user`,
  `used_count`,
  `valid_from`,
  `valid_to`,
  `is_active`,
  `is_visible`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `code`,
  `name`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `usage_limit`,
  `usage_limit_per_user`,
  `used_count`,
  `valid_from`,
  `valid_to`,
  `is_active`,
  `is_visible`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`
FROM `coupons`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'coupons',
  (SELECT count(*) FROM `coupons`),
  (SELECT count(*) FROM `coupons__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `coupons`;
--> statement-breakpoint

ALTER TABLE `coupons__restaurant_fk_rebuild` RENAME TO `coupons`;
--> statement-breakpoint

CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_code` ON `coupons` (`code`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_discount_type` ON `coupons` (`discount_type`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_restaurant_id` ON `coupons` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_status` ON `coupons` (`is_active`,`is_visible`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_valid_period` ON `coupons` (`valid_from`,`valid_to`);
--> statement-breakpoint

CREATE TRIGGER `coupons_cents_sync_ai`
AFTER INSERT ON `coupons`
FOR EACH ROW
BEGIN
  UPDATE `coupons`
     SET `discount_value_cents` = CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` = CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` = CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `coupons_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `max_discount_amount`, `min_order_amount` ON `coupons`
FOR EACH ROW
BEGIN
  UPDATE `coupons`
     SET `discount_value_cents` = CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` = CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` = CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `coupons_restaurant_guard_bi`
BEFORE INSERT ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `coupons_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'coupons', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'coupons was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `employee_schedules__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `employee_schedules__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` integer NOT NULL,
	`shift_template_id` integer,
	`work_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_duration_minutes` integer DEFAULT 0,
	`clock_in_time_ms` integer,
	`clock_out_time_ms` integer,
	`scheduled_hours` real NOT NULL,
	`actual_hours` real DEFAULT 0,
	`overtime_hours` real DEFAULT 0,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`manager_notes` text,
	`confirmed_by` integer,
	`confirmed_at_ms` integer,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, deleted_at_ms INTEGER,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_template_id`) REFERENCES `shift_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `employee_schedules__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `employee_id`,
  `shift_template_id`,
  `work_date`,
  `start_time`,
  `end_time`,
  `break_duration_minutes`,
  `clock_in_time_ms`,
  `clock_out_time_ms`,
  `scheduled_hours`,
  `actual_hours`,
  `overtime_hours`,
  `status`,
  `notes`,
  `manager_notes`,
  `confirmed_by`,
  `confirmed_at_ms`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `employee_id`,
  `shift_template_id`,
  `work_date`,
  `start_time`,
  `end_time`,
  `break_duration_minutes`,
  `clock_in_time_ms`,
  `clock_out_time_ms`,
  `scheduled_hours`,
  `actual_hours`,
  `overtime_hours`,
  `status`,
  `notes`,
  `manager_notes`,
  `confirmed_by`,
  `confirmed_at_ms`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `employee_schedules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'employee_schedules',
  (SELECT count(*) FROM `employee_schedules`),
  (SELECT count(*) FROM `employee_schedules__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `employee_schedules`;
--> statement-breakpoint

ALTER TABLE `employee_schedules__restaurant_fk_rebuild` RENAME TO `employee_schedules`;
--> statement-breakpoint

CREATE INDEX `idx_employee_schedules_employee_date` ON `employee_schedules` (`employee_id`,`work_date`);
--> statement-breakpoint

CREATE INDEX `idx_employee_schedules_restaurant_date` ON `employee_schedules` (`restaurant_id`,`work_date`);
--> statement-breakpoint

CREATE INDEX `idx_employee_schedules_status_date` ON `employee_schedules` (`status`,`work_date`);
--> statement-breakpoint

CREATE TRIGGER `employee_schedules_restaurant_guard_bi`
BEFORE INSERT ON `employee_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `employee_schedules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'employee_schedules', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'employee_schedules was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `group_orders__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `group_orders__restaurant_fk_rebuild` (
	`id` text PRIMARY KEY NOT NULL,
	`share_code` text NOT NULL,
	`master_order_id` integer,
	`created_by` integer NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`split_type` text DEFAULT 'individual' NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`service_charge` real DEFAULT 0 NOT NULL,
	`final_amount` real DEFAULT 0 NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`locked_at_ms` integer,
	`completed_at_ms` integer,
	`settings` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, `total_amount_cents` integer, `tax_amount_cents` integer, `service_charge_cents` integer, `final_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `group_orders__restaurant_fk_rebuild` (
  `id`,
  `share_code`,
  `master_order_id`,
  `created_by`,
  `restaurant_id`,
  `table_id`,
  `status`,
  `split_type`,
  `total_amount`,
  `tax_amount`,
  `service_charge`,
  `final_amount`,
  `expires_at_ms`,
  `locked_at_ms`,
  `completed_at_ms`,
  `settings`,
  `notes`,
  `created_at_ms`,
  `updated_at_ms`,
  `total_amount_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `final_amount_cents`
)
SELECT
  `id`,
  `share_code`,
  `master_order_id`,
  `created_by`,
  `restaurant_id`,
  `table_id`,
  `status`,
  `split_type`,
  `total_amount`,
  `tax_amount`,
  `service_charge`,
  `final_amount`,
  `expires_at_ms`,
  `locked_at_ms`,
  `completed_at_ms`,
  `settings`,
  `notes`,
  `created_at_ms`,
  `updated_at_ms`,
  `total_amount_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `final_amount_cents`
FROM `group_orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'group_orders',
  (SELECT count(*) FROM `group_orders`),
  (SELECT count(*) FROM `group_orders__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `group_orders`;
--> statement-breakpoint

ALTER TABLE `group_orders__restaurant_fk_rebuild` RENAME TO `group_orders`;
--> statement-breakpoint

CREATE UNIQUE INDEX `group_orders_share_code_unique` ON `group_orders` (`share_code`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_expires` ON `group_orders` (`expires_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_restaurant_status` ON `group_orders` (`restaurant_id`,`status`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_status_created` ON `group_orders` (`status`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_table` ON `group_orders` (`table_id`);
--> statement-breakpoint

CREATE TRIGGER `group_orders_cents_sync_ai`
AFTER INSERT ON `group_orders`
FOR EACH ROW
BEGIN
  UPDATE `group_orders`
     SET `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_cents_sync_au`
AFTER UPDATE OF `total_amount`, `tax_amount`, `service_charge`, `final_amount` ON `group_orders`
FOR EACH ROW
BEGIN
  UPDATE `group_orders`
     SET `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_restaurant_guard_bi`
BEFORE INSERT ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'group_orders', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'group_orders was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_types__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `leave_types__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`accrual_type` text DEFAULT 'yearly' NOT NULL,
	`accrual_amount` real DEFAULT 0 NOT NULL,
	`accrual_based_on_seniority` integer DEFAULT false NOT NULL,
	`requires_approval` integer DEFAULT true NOT NULL,
	`required_approval_levels` integer DEFAULT 1 NOT NULL,
	`min_notice_days` integer DEFAULT 0 NOT NULL,
	`max_consecutive_days` integer,
	`can_carryover` integer DEFAULT false NOT NULL,
	`carryover_max_days` real,
	`carryover_expiry_months` integer,
	`requires_documentation` integer DEFAULT false NOT NULL,
	`documentation_required_after_days` integer,
	`is_paid` integer DEFAULT true NOT NULL,
	`payment_rate` real DEFAULT 1 NOT NULL,
	`allow_half_day` integer DEFAULT true NOT NULL,
	`gender` text,
	`applicable_to_roles` text,
	`max_usage_per_year` real,
	`is_system_defined` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`color` text,
	`icon` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `leave_types__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `code`,
  `name`,
  `description`,
  `accrual_type`,
  `accrual_amount`,
  `accrual_based_on_seniority`,
  `requires_approval`,
  `required_approval_levels`,
  `min_notice_days`,
  `max_consecutive_days`,
  `can_carryover`,
  `carryover_max_days`,
  `carryover_expiry_months`,
  `requires_documentation`,
  `documentation_required_after_days`,
  `is_paid`,
  `payment_rate`,
  `allow_half_day`,
  `gender`,
  `applicable_to_roles`,
  `max_usage_per_year`,
  `is_system_defined`,
  `is_active`,
  `sort_order`,
  `color`,
  `icon`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `updated_by`
)
SELECT
  `id`,
  `restaurant_id`,
  `code`,
  `name`,
  `description`,
  `accrual_type`,
  `accrual_amount`,
  `accrual_based_on_seniority`,
  `requires_approval`,
  `required_approval_levels`,
  `min_notice_days`,
  `max_consecutive_days`,
  `can_carryover`,
  `carryover_max_days`,
  `carryover_expiry_months`,
  `requires_documentation`,
  `documentation_required_after_days`,
  `is_paid`,
  `payment_rate`,
  `allow_half_day`,
  `gender`,
  `applicable_to_roles`,
  `max_usage_per_year`,
  `is_system_defined`,
  `is_active`,
  `sort_order`,
  `color`,
  `icon`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `updated_by`
FROM `leave_types`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'leave_types',
  (SELECT count(*) FROM `leave_types`),
  (SELECT count(*) FROM `leave_types__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `leave_types`;
--> statement-breakpoint

ALTER TABLE `leave_types__restaurant_fk_rebuild` RENAME TO `leave_types`;
--> statement-breakpoint

CREATE INDEX `idx_leave_types_restaurant_active` ON `leave_types` (`restaurant_id`,`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_leave_types_restaurant_code` ON `leave_types` (`restaurant_id`,`code`);
--> statement-breakpoint

CREATE TRIGGER `leave_types_restaurant_guard_bi`
BEFORE INSERT ON `leave_types`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_types.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `leave_types_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_types`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_types.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'leave_types', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'leave_types was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `menu_items__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `menu_items__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ingredients` text,
	`price` real NOT NULL,
	`original_price` real,
	`cost_price` real,
	`image_url` text,
	`image_variants` text,
	`is_available` integer DEFAULT true NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_popular` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`inventory_count` integer,
	`min_inventory_alert` integer DEFAULT 5,
	`spice_level` integer DEFAULT 0 NOT NULL,
	`preparation_time` integer DEFAULT 15,
	`calories` integer,
	`dietary_info` text,
	`allergens` text,
	`options` text,
	`available_hours` text,
	`order_count` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`tags` text,
	`keywords` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer, `price_cents` integer, `original_price_cents` integer, `cost_price_cents` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `menu_items__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `category_id`,
  `name`,
  `description`,
  `ingredients`,
  `price`,
  `original_price`,
  `cost_price`,
  `image_url`,
  `image_variants`,
  `is_available`,
  `is_featured`,
  `is_popular`,
  `sort_order`,
  `inventory_count`,
  `min_inventory_alert`,
  `spice_level`,
  `preparation_time`,
  `calories`,
  `dietary_info`,
  `allergens`,
  `options`,
  `available_hours`,
  `order_count`,
  `rating`,
  `review_count`,
  `view_count`,
  `tags`,
  `keywords`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `price_cents`,
  `original_price_cents`,
  `cost_price_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `category_id`,
  `name`,
  `description`,
  `ingredients`,
  `price`,
  `original_price`,
  `cost_price`,
  `image_url`,
  `image_variants`,
  `is_available`,
  `is_featured`,
  `is_popular`,
  `sort_order`,
  `inventory_count`,
  `min_inventory_alert`,
  `spice_level`,
  `preparation_time`,
  `calories`,
  `dietary_info`,
  `allergens`,
  `options`,
  `available_hours`,
  `order_count`,
  `rating`,
  `review_count`,
  `view_count`,
  `tags`,
  `keywords`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `price_cents`,
  `original_price_cents`,
  `cost_price_cents`
FROM `menu_items`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'menu_items',
  (SELECT count(*) FROM `menu_items`),
  (SELECT count(*) FROM `menu_items__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `menu_items`;
--> statement-breakpoint

ALTER TABLE `menu_items__restaurant_fk_rebuild` RENAME TO `menu_items`;
--> statement-breakpoint

CREATE INDEX `menu_items_availability_idx` ON `menu_items` (`is_available`,`inventory_count`);
--> statement-breakpoint

CREATE INDEX `menu_items_price_range_idx` ON `menu_items` (`restaurant_id`,`price`);
--> statement-breakpoint

CREATE INDEX `menu_items_restaurant_category_idx` ON `menu_items` (`restaurant_id`,`category_id`,`is_available`);
--> statement-breakpoint

CREATE INDEX `menu_items_restaurant_featured_idx` ON `menu_items` (`restaurant_id`,`is_featured`,`is_available`);
--> statement-breakpoint

CREATE INDEX `menu_items_restaurant_popular_idx` ON `menu_items` (`restaurant_id`,`is_popular`,`order_count`);
--> statement-breakpoint

CREATE TRIGGER `menu_items_cents_sync_ai`
AFTER INSERT ON `menu_items`
FOR EACH ROW
BEGIN
  UPDATE `menu_items`
     SET `price_cents` = CAST(round(NEW.`price` * 100) AS integer),
         `original_price_cents` = CASE WHEN NEW.`original_price` IS NULL THEN NULL ELSE CAST(round(NEW.`original_price` * 100) AS integer) END,
         `cost_price_cents` = CASE WHEN NEW.`cost_price` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `menu_items_cents_sync_au`
AFTER UPDATE OF `price`, `original_price`, `cost_price` ON `menu_items`
FOR EACH ROW
BEGIN
  UPDATE `menu_items`
     SET `price_cents` = CAST(round(NEW.`price` * 100) AS integer),
         `original_price_cents` = CASE WHEN NEW.`original_price` IS NULL THEN NULL ELSE CAST(round(NEW.`original_price` * 100) AS integer) END,
         `cost_price_cents` = CASE WHEN NEW.`cost_price` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `menu_items_restaurant_guard_bi`
BEFORE INSERT ON `menu_items`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'menu_items.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `menu_items_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `menu_items`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'menu_items.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'menu_items', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'menu_items was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `orders__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `orders__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` integer,
	`customer_id` integer,
	`order_number` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order_type` text DEFAULT 'table',
	`subtotal` real NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`service_charge` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`customer_info` text,
	`estimated_prep_time` integer,
	`actual_prep_time` integer,
	`confirmed_at_ms` integer,
	`preparing_at_ms` integer,
	`ready_at_ms` integer,
	`delivered_at_ms` integer,
	`paid_at_ms` integer,
	`cancelled_at_ms` integer,
	`payment_method` text,
	`payment_status` text DEFAULT 'pending',
	`payment_transaction_id` text,
	`coupon_code` text,
	`promotion_ids` text,
	`rating` integer,
	`review_comment` text,
	`reviewed_at_ms` integer,
	`notes` text,
	`internal_notes` text,
	`cancellation_reason` text,
	`refund_amount` real,
	`delivery_info` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, order_source TEXT DEFAULT 'direct', version INTEGER NOT NULL DEFAULT 0, client_mutation_id TEXT, `subtotal_cents` integer, `tax_amount_cents` integer, `service_charge_cents` integer, `discount_amount_cents` integer, `total_amount_cents` integer, `refund_amount_cents` integer,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `orders__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `table_id`,
  `customer_id`,
  `order_number`,
  `status`,
  `order_type`,
  `subtotal`,
  `tax_amount`,
  `service_charge`,
  `discount_amount`,
  `total_amount`,
  `customer_info`,
  `estimated_prep_time`,
  `actual_prep_time`,
  `confirmed_at_ms`,
  `preparing_at_ms`,
  `ready_at_ms`,
  `delivered_at_ms`,
  `paid_at_ms`,
  `cancelled_at_ms`,
  `payment_method`,
  `payment_status`,
  `payment_transaction_id`,
  `coupon_code`,
  `promotion_ids`,
  `rating`,
  `review_comment`,
  `reviewed_at_ms`,
  `notes`,
  `internal_notes`,
  `cancellation_reason`,
  `refund_amount`,
  `delivery_info`,
  `created_at_ms`,
  `updated_at_ms`,
  `order_source`,
  `version`,
  `client_mutation_id`,
  `subtotal_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `discount_amount_cents`,
  `total_amount_cents`,
  `refund_amount_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `table_id`,
  `customer_id`,
  `order_number`,
  `status`,
  `order_type`,
  `subtotal`,
  `tax_amount`,
  `service_charge`,
  `discount_amount`,
  `total_amount`,
  `customer_info`,
  `estimated_prep_time`,
  `actual_prep_time`,
  `confirmed_at_ms`,
  `preparing_at_ms`,
  `ready_at_ms`,
  `delivered_at_ms`,
  `paid_at_ms`,
  `cancelled_at_ms`,
  `payment_method`,
  `payment_status`,
  `payment_transaction_id`,
  `coupon_code`,
  `promotion_ids`,
  `rating`,
  `review_comment`,
  `reviewed_at_ms`,
  `notes`,
  `internal_notes`,
  `cancellation_reason`,
  `refund_amount`,
  `delivery_info`,
  `created_at_ms`,
  `updated_at_ms`,
  `order_source`,
  `version`,
  `client_mutation_id`,
  `subtotal_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `discount_amount_cents`,
  `total_amount_cents`,
  `refund_amount_cents`
FROM `orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'orders',
  (SELECT count(*) FROM `orders`),
  (SELECT count(*) FROM `orders__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `orders`;
--> statement-breakpoint

ALTER TABLE `orders__restaurant_fk_rebuild` RENAME TO `orders`;
--> statement-breakpoint

CREATE UNIQUE INDEX orders_client_mutation_unique
  ON orders(restaurant_id, client_mutation_id);
--> statement-breakpoint

CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);
--> statement-breakpoint

CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);
--> statement-breakpoint

CREATE INDEX orders_order_source_idx ON orders (restaurant_id, order_source, created_at_ms);
--> statement-breakpoint

CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`,`paid_at_ms`);
--> statement-breakpoint

CREATE UNIQUE INDEX `orders_payment_transaction_unique`
  ON `orders` (`payment_transaction_id`)
  WHERE `payment_transaction_id` IS NOT NULL;
--> statement-breakpoint

CREATE INDEX `orders_restaurant_payment_tx_idx`
  ON `orders` (`restaurant_id`, `payment_transaction_id`);
--> statement-breakpoint

CREATE INDEX `orders_restaurant_status_idx` ON `orders` (`restaurant_id`,`status`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `orders_restaurant_table_idx` ON `orders` (`restaurant_id`,`table_id`,`status`);
--> statement-breakpoint

CREATE INDEX `orders_status_time_idx` ON `orders` (`status`,`created_at_ms`);
--> statement-breakpoint

CREATE TRIGGER `orders_cents_sync_ai`
AFTER INSERT ON `orders`
FOR EACH ROW
BEGIN
  UPDATE `orders`
     SET `subtotal_cents` = CAST(round(NEW.`subtotal` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `refund_amount_cents` = CASE WHEN NEW.`refund_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`refund_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `orders_cents_sync_au`
AFTER UPDATE OF `subtotal`, `tax_amount`, `service_charge`, `discount_amount`, `total_amount`, `refund_amount` ON `orders`
FOR EACH ROW
BEGIN
  UPDATE `orders`
     SET `subtotal_cents` = CAST(round(NEW.`subtotal` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `refund_amount_cents` = CASE WHEN NEW.`refund_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`refund_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `orders_restaurant_guard_bi`
BEFORE INSERT ON `orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'orders', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'orders was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `partnership_plans__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `partnership_plans__restaurant_fk_rebuild` (
	`id` text PRIMARY KEY NOT NULL,
	`partnership_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`plan_code` text NOT NULL,
	`plan_name` text NOT NULL,
	`plan_name_en` text,
	`description` text,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`max_discount_amount` real,
	`min_order_amount` real DEFAULT 0,
	`max_order_amount` real,
	`applicable_menu_items` text DEFAULT '[]',
	`applicable_categories` text DEFAULT '[]',
	`excluded_menu_items` text DEFAULT '[]',
	`excluded_categories` text DEFAULT '[]',
	`applicable_days` text DEFAULT '[]',
	`applicable_time_slots` text DEFAULT '[]',
	`usage_limit_per_member` integer,
	`usage_limit_per_day` integer,
	`daily_usage_count` integer DEFAULT 0,
	`total_usage_count` integer DEFAULT 0,
	"valid_from_ms" integer NOT NULL,
	"valid_to_ms" integer NOT NULL,
	`priority` integer DEFAULT 0,
	`can_combine_with_coupons` integer DEFAULT false,
	`can_combine_with_promotions` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`badge_text` text,
	`badge_color` text,
	`show_on_menu` integer DEFAULT true,
	`total_discount_given` real DEFAULT 0,
	`total_revenue` real DEFAULT 0,
	`terms_and_conditions` text,
	`notes` text,
	`metadata` text DEFAULT '{}',
	"created_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	"updated_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`created_by` integer, deleted_at_ms INTEGER, `discount_value_cents` integer, `max_discount_amount_cents` integer, `min_order_amount_cents` integer, `max_order_amount_cents` integer, `total_discount_given_cents` integer, `total_revenue_cents` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `partnership_plans__restaurant_fk_rebuild` (
  `id`,
  `partnership_id`,
  `restaurant_id`,
  `plan_code`,
  `plan_name`,
  `plan_name_en`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `max_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `excluded_menu_items`,
  `excluded_categories`,
  `applicable_days`,
  `applicable_time_slots`,
  `usage_limit_per_member`,
  `usage_limit_per_day`,
  `daily_usage_count`,
  `total_usage_count`,
  `valid_from_ms`,
  `valid_to_ms`,
  `priority`,
  `can_combine_with_coupons`,
  `can_combine_with_promotions`,
  `is_active`,
  `badge_text`,
  `badge_color`,
  `show_on_menu`,
  `total_discount_given`,
  `total_revenue`,
  `terms_and_conditions`,
  `notes`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`,
  `max_order_amount_cents`,
  `total_discount_given_cents`,
  `total_revenue_cents`
)
SELECT
  `id`,
  `partnership_id`,
  `restaurant_id`,
  `plan_code`,
  `plan_name`,
  `plan_name_en`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `max_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `excluded_menu_items`,
  `excluded_categories`,
  `applicable_days`,
  `applicable_time_slots`,
  `usage_limit_per_member`,
  `usage_limit_per_day`,
  `daily_usage_count`,
  `total_usage_count`,
  `valid_from_ms`,
  `valid_to_ms`,
  `priority`,
  `can_combine_with_coupons`,
  `can_combine_with_promotions`,
  `is_active`,
  `badge_text`,
  `badge_color`,
  `show_on_menu`,
  `total_discount_given`,
  `total_revenue`,
  `terms_and_conditions`,
  `notes`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`,
  `max_order_amount_cents`,
  `total_discount_given_cents`,
  `total_revenue_cents`
FROM `partnership_plans`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'partnership_plans',
  (SELECT count(*) FROM `partnership_plans`),
  (SELECT count(*) FROM `partnership_plans__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `partnership_plans`;
--> statement-breakpoint

ALTER TABLE `partnership_plans__restaurant_fk_rebuild` RENAME TO `partnership_plans`;
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_code` ON `partnership_plans` (`partnership_id`,`restaurant_id`,`plan_code`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_partnership` ON `partnership_plans` (`partnership_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_restaurant` ON `partnership_plans` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_valid_period` ON `partnership_plans` ("valid_from_ms","valid_to_ms");
--> statement-breakpoint

CREATE TRIGGER `partnership_plans_cents_sync_ai`
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

CREATE TRIGGER `partnership_plans_cents_sync_au`
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

CREATE TRIGGER `partnership_plans_restaurant_guard_bi`
BEFORE INSERT ON `partnership_plans`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_plans.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `partnership_plans_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `partnership_plans`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_plans.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'partnership_plans', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'partnership_plans was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `scheduling_rules__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `scheduling_rules__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rule_type` text NOT NULL,
	`rule_config` text NOT NULL,
	`applies_to_roles` text,
	`applies_to_employees` text,
	`priority` integer DEFAULT 0,
	`severity` text DEFAULT 'warning' NOT NULL,
	`is_system_rule` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `scheduling_rules__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `rule_type`,
  `rule_config`,
  `applies_to_roles`,
  `applies_to_employees`,
  `priority`,
  `severity`,
  `is_system_rule`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `rule_type`,
  `rule_config`,
  `applies_to_roles`,
  `applies_to_employees`,
  `priority`,
  `severity`,
  `is_system_rule`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`
FROM `scheduling_rules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'scheduling_rules',
  (SELECT count(*) FROM `scheduling_rules`),
  (SELECT count(*) FROM `scheduling_rules__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `scheduling_rules`;
--> statement-breakpoint

ALTER TABLE `scheduling_rules__restaurant_fk_rebuild` RENAME TO `scheduling_rules`;
--> statement-breakpoint

CREATE INDEX `idx_scheduling_rules_restaurant_type_active` ON `scheduling_rules` (`restaurant_id`,`rule_type`,`is_active`);
--> statement-breakpoint

CREATE TRIGGER `scheduling_rules_restaurant_guard_bi`
BEFORE INSERT ON `scheduling_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `scheduling_rules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `scheduling_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'scheduling_rules', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'scheduling_rules was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `shift_templates__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `shift_templates__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`shift_type` text DEFAULT 'regular' NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`is_split_shift` integer DEFAULT false NOT NULL,
	`break_start_time` text,
	`break_end_time` text,
	`break_duration_minutes` integer DEFAULT 0,
	`applicable_days` text DEFAULT '[]',
	`min_employees` integer DEFAULT 1,
	`max_employees` integer DEFAULT 10,
	`hourly_rate` real,
	`overtime_multiplier` real DEFAULT 1.5,
	`color_code` text DEFAULT '#3B82F6',
	`icon` text,
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, deleted_at_ms INTEGER, `hourly_rate_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `shift_templates__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `shift_type`,
  `start_time`,
  `end_time`,
  `duration_minutes`,
  `is_split_shift`,
  `break_start_time`,
  `break_end_time`,
  `break_duration_minutes`,
  `applicable_days`,
  `min_employees`,
  `max_employees`,
  `hourly_rate`,
  `overtime_multiplier`,
  `color_code`,
  `icon`,
  `sort_order`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `hourly_rate_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `shift_type`,
  `start_time`,
  `end_time`,
  `duration_minutes`,
  `is_split_shift`,
  `break_start_time`,
  `break_end_time`,
  `break_duration_minutes`,
  `applicable_days`,
  `min_employees`,
  `max_employees`,
  `hourly_rate`,
  `overtime_multiplier`,
  `color_code`,
  `icon`,
  `sort_order`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `hourly_rate_cents`
FROM `shift_templates`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'shift_templates',
  (SELECT count(*) FROM `shift_templates`),
  (SELECT count(*) FROM `shift_templates__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `shift_templates`;
--> statement-breakpoint

ALTER TABLE `shift_templates__restaurant_fk_rebuild` RENAME TO `shift_templates`;
--> statement-breakpoint

CREATE INDEX `idx_shift_templates_restaurant_active` ON `shift_templates` (`restaurant_id`,`is_active`);
--> statement-breakpoint

CREATE TRIGGER `shift_templates_hourly_cents_sync_ai`
AFTER INSERT ON `shift_templates`
FOR EACH ROW
BEGIN
  UPDATE `shift_templates`
     SET `hourly_rate_cents` = CASE WHEN NEW.`hourly_rate` IS NULL THEN NULL ELSE CAST(round(NEW.`hourly_rate` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `shift_templates_hourly_cents_sync_au`
AFTER UPDATE OF `hourly_rate` ON `shift_templates`
FOR EACH ROW
BEGIN
  UPDATE `shift_templates`
     SET `hourly_rate_cents` = CASE WHEN NEW.`hourly_rate` IS NULL THEN NULL ELSE CAST(round(NEW.`hourly_rate` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `shift_templates_restaurant_guard_bi`
BEFORE INSERT ON `shift_templates`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shift_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `shift_templates_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `shift_templates`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shift_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'shift_templates', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'shift_templates was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `tables__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `tables__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`number` text NOT NULL,
	`name` text,
	`capacity` integer DEFAULT 4 NOT NULL,
	`location` text,
	`floor` integer DEFAULT 1,
	`section` text,
	`qr_code` text NOT NULL,
	`qr_code_image_url` text,
	`qr_code_version` integer DEFAULT 1 NOT NULL,
	`qr_mode` text DEFAULT 'table',
	`seat_count` integer DEFAULT 0,
	`seat_layout` text,
	`seat_numbering_style` text DEFAULT 'numeric',
	`is_occupied` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_reservable` integer DEFAULT true NOT NULL,
	`features` text,
	`current_order_id` integer,
	`occupied_at_ms` integer,
	`occupied_by` text,
	`estimated_free_at_ms` integer,
	`last_cleaned_at_ms` integer,
	`maintenance_notes` text,
	`total_usage` integer DEFAULT 0 NOT NULL,
	`average_occupancy_minutes` integer DEFAULT 0,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer
,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `tables__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `number`,
  `name`,
  `capacity`,
  `location`,
  `floor`,
  `section`,
  `qr_code`,
  `qr_code_image_url`,
  `qr_code_version`,
  `qr_mode`,
  `seat_count`,
  `seat_layout`,
  `seat_numbering_style`,
  `is_occupied`,
  `is_active`,
  `is_reservable`,
  `features`,
  `current_order_id`,
  `occupied_at_ms`,
  `occupied_by`,
  `estimated_free_at_ms`,
  `last_cleaned_at_ms`,
  `maintenance_notes`,
  `total_usage`,
  `average_occupancy_minutes`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `number`,
  `name`,
  `capacity`,
  `location`,
  `floor`,
  `section`,
  `qr_code`,
  `qr_code_image_url`,
  `qr_code_version`,
  `qr_mode`,
  `seat_count`,
  `seat_layout`,
  `seat_numbering_style`,
  `is_occupied`,
  `is_active`,
  `is_reservable`,
  `features`,
  `current_order_id`,
  `occupied_at_ms`,
  `occupied_by`,
  `estimated_free_at_ms`,
  `last_cleaned_at_ms`,
  `maintenance_notes`,
  `total_usage`,
  `average_occupancy_minutes`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `tables`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'tables',
  (SELECT count(*) FROM `tables`),
  (SELECT count(*) FROM `tables__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `tables`;
--> statement-breakpoint

ALTER TABLE `tables__restaurant_fk_rebuild` RENAME TO `tables`;
--> statement-breakpoint

CREATE INDEX `tables_qr_code_idx` ON `tables` (`qr_code`);
--> statement-breakpoint

CREATE UNIQUE INDEX `tables_qr_code_unique` ON `tables` (`qr_code`);
--> statement-breakpoint

CREATE INDEX `tables_restaurant_number_idx` ON `tables` (`restaurant_id`,`number`);
--> statement-breakpoint

CREATE INDEX `tables_restaurant_status_idx` ON `tables` (`restaurant_id`,`is_occupied`,`is_active`);
--> statement-breakpoint

CREATE TRIGGER `tables_restaurant_guard_bi`
BEFORE INSERT ON `tables`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'tables.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `tables_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `tables`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'tables.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'tables', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'tables was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE IF EXISTS `users__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `users__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`phone` text,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` integer DEFAULT 4 NOT NULL,
	`restaurant_id` text,
	`address` text,
	`date_of_birth` text,
	`profile_image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`preferences` text,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`total_spent` integer DEFAULT 0 NOT NULL,
	`last_login_at_ms` integer,
	`password_changed_at_ms` integer,
	`email_verified_at_ms` integer,
	`phone_verified_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer
, token_version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint

INSERT INTO `users__restaurant_fk_rebuild` (
  `id`,
  `username`,
  `email`,
  `phone`,
  `full_name`,
  `password_hash`,
  `role`,
  `restaurant_id`,
  `address`,
  `date_of_birth`,
  `profile_image_url`,
  `is_active`,
  `is_verified`,
  `preferences`,
  `total_orders`,
  `total_spent`,
  `last_login_at_ms`,
  `password_changed_at_ms`,
  `email_verified_at_ms`,
  `phone_verified_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `token_version`
)
SELECT
  `id`,
  `username`,
  `email`,
  `phone`,
  `full_name`,
  `password_hash`,
  `role`,
  `restaurant_id`,
  `address`,
  `date_of_birth`,
  `profile_image_url`,
  `is_active`,
  `is_verified`,
  `preferences`,
  `total_orders`,
  `total_spent`,
  `last_login_at_ms`,
  `password_changed_at_ms`,
  `email_verified_at_ms`,
  `phone_verified_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `token_version`
FROM `users`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0030`
SELECT
  'users',
  (SELECT count(*) FROM `users`),
  (SELECT count(*) FROM `users__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `users`;
--> statement-breakpoint

ALTER TABLE `users__restaurant_fk_rebuild` RENAME TO `users`;
--> statement-breakpoint

CREATE INDEX `users_restaurant_role_active_idx`
  ON `users` (`restaurant_id`, `role`, `is_active`);
--> statement-breakpoint

CREATE INDEX users_token_version_idx ON users(id, token_version);
--> statement-breakpoint

CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint

CREATE TRIGGER `users_restaurant_guard_bi`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'users.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `users_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `users`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'users.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'users', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'users was rebuilt with a physical restaurant_id FK in 0030.');
--> statement-breakpoint

DROP TABLE `_migration_assert_restaurant_fk_counts_0030`;
--> statement-breakpoint

PRAGMA foreign_keys=ON;
