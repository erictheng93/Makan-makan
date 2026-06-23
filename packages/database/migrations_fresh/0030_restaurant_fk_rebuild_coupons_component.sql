-- 0030 restaurant FK rebuild for coupons component.
-- D1 keeps foreign_keys enabled, so this migration rebuilds the coupons
-- parent table together with its direct coupon child tables using no-FK
-- staging tables. It does not rely on PRAGMA foreign_keys=OFF.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'coupons', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `coupons`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`)
     LIMIT 5
  )),
  'coupons.restaurant_id must reference restaurants.id before component rebuild.'
FROM `coupons`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'coupons', 'created_by', 'orphan_created_by', 'error',
  count(*),
  (SELECT group_concat(`created_by`, ',') FROM (
    SELECT DISTINCT `created_by`
      FROM `coupons`
     WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupons`.`created_by`)
     LIMIT 5
  )),
  'coupons.created_by must reference users.id before component rebuild.'
FROM `coupons`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupons`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'coupon_usage', 'coupon_id', 'orphan_coupon_id', 'error',
  count(*),
  (SELECT group_concat(`coupon_id`, ',') FROM (
    SELECT DISTINCT `coupon_id`
      FROM `coupon_usage`
     WHERE NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_usage`.`coupon_id`)
     LIMIT 5
  )),
  'coupon_usage.coupon_id must reference coupons.id before component rebuild.'
FROM `coupon_usage`
WHERE NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_usage`.`coupon_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'coupon_usage', 'order_id', 'orphan_order_id', 'error',
  count(*),
  (SELECT group_concat(`order_id`, ',') FROM (
    SELECT DISTINCT `order_id`
      FROM `coupon_usage`
     WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `coupon_usage`.`order_id`)
     LIMIT 5
  )),
  'coupon_usage.order_id must reference orders.id before component rebuild.'
FROM `coupon_usage`
WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `coupon_usage`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'coupon_usage', 'user_id', 'orphan_user_id', 'error',
  count(*),
  (SELECT group_concat(`user_id`, ',') FROM (
    SELECT DISTINCT `user_id`
      FROM `coupon_usage`
     WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_usage`.`user_id`)
     LIMIT 5
  )),
  'coupon_usage.user_id must reference users.id before component rebuild.'
FROM `coupon_usage`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_usage`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'coupon_distributions', 'coupon_id', 'orphan_coupon_id', 'error',
  count(*),
  (SELECT group_concat(`coupon_id`, ',') FROM (
    SELECT DISTINCT `coupon_id`
      FROM `coupon_distributions`
     WHERE NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_distributions`.`coupon_id`)
     LIMIT 5
  )),
  'coupon_distributions.coupon_id must reference coupons.id before component rebuild.'
FROM `coupon_distributions`
WHERE NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_distributions`.`coupon_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'coupon_distributions', 'created_by', 'orphan_created_by', 'error',
  count(*),
  (SELECT group_concat(`created_by`, ',') FROM (
    SELECT DISTINCT `created_by`
      FROM `coupon_distributions`
     WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_distributions`.`created_by`)
     LIMIT 5
  )),
  'coupon_distributions.created_by must reference users.id before component rebuild.'
FROM `coupon_distributions`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_distributions`.`created_by`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_coupons_component_fk_0030`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_coupons_component_fk_0030` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupons.restaurant_id.orphan_restaurant_id',
  count(*)
FROM `coupons`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupons.created_by.orphan_created_by',
  count(*)
FROM `coupons`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupons`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupon_usage.coupon_id.orphan_coupon_id',
  count(*)
FROM `coupon_usage`
WHERE NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_usage`.`coupon_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupon_usage.order_id.orphan_order_id',
  count(*)
FROM `coupon_usage`
WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `coupon_usage`.`order_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupon_usage.user_id.orphan_user_id',
  count(*)
FROM `coupon_usage`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_usage`.`user_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupon_distributions.coupon_id.orphan_coupon_id',
  count(*)
FROM `coupon_distributions`
WHERE NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_distributions`.`coupon_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_fk_0030`
SELECT
  'coupon_distributions.created_by.orphan_created_by',
  count(*)
FROM `coupon_distributions`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_distributions`.`created_by`);
--> statement-breakpoint

DROP TABLE `_migration_assert_coupons_component_fk_0030`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_coupons_component_counts_0030`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_coupons_component_counts_0030` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupon_usage__component_rebuild_data` AS SELECT * FROM `coupon_usage`;
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_counts_0030`
SELECT
  'coupon_usage.stage',
  (SELECT count(*) FROM `coupon_usage`),
  (SELECT count(*) FROM `coupon_usage__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupon_distributions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupon_distributions__component_rebuild_data` AS SELECT * FROM `coupon_distributions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_counts_0030`
SELECT
  'coupon_distributions.stage',
  (SELECT count(*) FROM `coupon_distributions`),
  (SELECT count(*) FROM `coupon_distributions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupons__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupons__component_rebuild_data` AS SELECT * FROM `coupons`;
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_counts_0030`
SELECT
  'coupons.stage',
  (SELECT count(*) FROM `coupons`),
  (SELECT count(*) FROM `coupons__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `coupon_usage`;
--> statement-breakpoint

DROP TABLE `coupon_distributions`;
--> statement-breakpoint

DROP TABLE `coupons`;
--> statement-breakpoint

CREATE TABLE `coupons` (
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
	`created_by` TEXT,
	"deleted_at_ms" integer, `discount_value_cents` integer, `max_discount_amount_cents` integer, `min_order_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `coupons` (
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
FROM `coupons__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_counts_0030`
SELECT
  'coupons.final',
  (SELECT count(*) FROM `coupons__component_rebuild_data`),
  (SELECT count(*) FROM `coupons`);
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

CREATE TABLE `coupon_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`order_id` TEXT NOT NULL,
	`user_id` TEXT,
	`discount_amount` real NOT NULL,
	`original_amount` real NOT NULL,
	`final_amount` real NOT NULL,
	`status` text DEFAULT 'active',
	"used_at_ms" integer NOT NULL,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL, `discount_amount_cents` integer, `original_amount_cents` integer, `final_amount_cents` integer,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `coupon_usage` (
  `id`,
  `coupon_id`,
  `order_id`,
  `user_id`,
  `discount_amount`,
  `original_amount`,
  `final_amount`,
  `status`,
  `used_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `discount_amount_cents`,
  `original_amount_cents`,
  `final_amount_cents`
)
SELECT
  `id`,
  `coupon_id`,
  `order_id`,
  `user_id`,
  `discount_amount`,
  `original_amount`,
  `final_amount`,
  `status`,
  `used_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `discount_amount_cents`,
  `original_amount_cents`,
  `final_amount_cents`
FROM `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_counts_0030`
SELECT
  'coupon_usage.final',
  (SELECT count(*) FROM `coupon_usage__component_rebuild_data`),
  (SELECT count(*) FROM `coupon_usage`);
--> statement-breakpoint

CREATE UNIQUE INDEX `coupon_usage_coupon_order_active_unique`
  ON `coupon_usage` (`coupon_id`, `order_id`)
  WHERE `status` IS NULL OR `status` != 'cancelled';
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_coupon_id` ON `coupon_usage` (`coupon_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_order_id` ON `coupon_usage` (`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_status` ON `coupon_usage` (`status`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_unique` ON `coupon_usage` (`coupon_id`,`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_used_at` ON `coupon_usage` ("used_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_user_id` ON `coupon_usage` (`user_id`);
--> statement-breakpoint

CREATE TRIGGER `coupon_usage_cents_sync_ai`
AFTER INSERT ON `coupon_usage`
FOR EACH ROW
BEGIN
  UPDATE `coupon_usage`
     SET `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `coupon_usage_cents_sync_au`
AFTER UPDATE OF `discount_amount`, `original_amount`, `final_amount` ON `coupon_usage`
FOR EACH ROW
BEGIN
  UPDATE `coupon_usage`
     SET `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE `coupon_distributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`distribution_type` text NOT NULL,
	`target_type` text,
	`target_criteria` text,
	`total_distributed` integer DEFAULT 0,
	`total_used` integer DEFAULT 0,
	"distributed_at_ms" integer NOT NULL,
	"expires_at_ms" integer,
	"created_at_ms" integer NOT NULL,
	`created_by` TEXT,
	`notes` text,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `coupon_distributions` (
  `id`,
  `coupon_id`,
  `distribution_type`,
  `target_type`,
  `target_criteria`,
  `total_distributed`,
  `total_used`,
  `distributed_at_ms`,
  `expires_at_ms`,
  `created_at_ms`,
  `created_by`,
  `notes`
)
SELECT
  `id`,
  `coupon_id`,
  `distribution_type`,
  `target_type`,
  `target_criteria`,
  `total_distributed`,
  `total_used`,
  `distributed_at_ms`,
  `expires_at_ms`,
  `created_at_ms`,
  `created_by`,
  `notes`
FROM `coupon_distributions__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_coupons_component_counts_0030`
SELECT
  'coupon_distributions.final',
  (SELECT count(*) FROM `coupon_distributions__component_rebuild_data`),
  (SELECT count(*) FROM `coupon_distributions`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_distributions_coupon_id` ON `coupon_distributions` (`coupon_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_distributions_distributed_at` ON `coupon_distributions` ("distributed_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_coupon_distributions_type` ON `coupon_distributions` (`distribution_type`);
--> statement-breakpoint

DROP TABLE `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupon_distributions__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupons__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_coupons_component_counts_0030`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'coupons', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'coupons was rebuilt with a physical restaurant_id FK in 0030 using a D1-safe component rebuild.');
--> statement-breakpoint
