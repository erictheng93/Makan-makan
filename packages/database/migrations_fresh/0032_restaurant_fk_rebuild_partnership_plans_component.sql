-- 0032 restaurant FK rebuild for partnership plans component.
-- Rebuilds partnership_plans with a physical restaurant_id FK together
-- with partnership_usage_logs, its direct child table. D1 keeps
-- foreign_keys enabled, so this migration uses no-FK staging tables
-- and does not rely on PRAGMA foreign_keys=OFF.

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
  'partnership_plans.restaurant_id must reference restaurants.id before component rebuild.'
FROM `partnership_plans`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_plans', 'partnership_id', 'orphan_partnership_id', 'error',
  count(*),
  (SELECT group_concat(`partnership_id`, ',') FROM (
    SELECT DISTINCT `partnership_id`
      FROM `partnership_plans`
     WHERE NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_plans`.`partnership_id`)
     LIMIT 5
  )),
  'partnership_plans.partnership_id must reference partnerships.id before component rebuild.'
FROM `partnership_plans`
WHERE NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_plans`.`partnership_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_plans', 'created_by', 'orphan_created_by', 'error',
  count(*),
  (SELECT group_concat(`created_by`, ',') FROM (
    SELECT DISTINCT `created_by`
      FROM `partnership_plans`
     WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_plans`.`created_by`)
     LIMIT 5
  )),
  'partnership_plans.created_by must reference users.id before component rebuild.'
FROM `partnership_plans`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_plans`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'partnership_usage_logs', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `partnership_usage_logs`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`)
     LIMIT 5
  )),
  'partnership_usage_logs.restaurant_id must reference restaurants.id before component rebuild.'
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_usage_logs', 'partnership_id', 'orphan_partnership_id', 'error',
  count(*),
  (SELECT group_concat(`partnership_id`, ',') FROM (
    SELECT DISTINCT `partnership_id`
      FROM `partnership_usage_logs`
     WHERE NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_usage_logs`.`partnership_id`)
     LIMIT 5
  )),
  'partnership_usage_logs.partnership_id must reference partnerships.id before component rebuild.'
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_usage_logs`.`partnership_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_usage_logs', 'plan_id', 'orphan_plan_id', 'error',
  count(*),
  (SELECT group_concat(`plan_id`, ',') FROM (
    SELECT DISTINCT `plan_id`
      FROM `partnership_usage_logs`
     WHERE NOT EXISTS (SELECT 1 FROM `partnership_plans` WHERE `partnership_plans`.`id` = `partnership_usage_logs`.`plan_id`)
     LIMIT 5
  )),
  'partnership_usage_logs.plan_id must reference partnership_plans.id before component rebuild.'
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `partnership_plans` WHERE `partnership_plans`.`id` = `partnership_usage_logs`.`plan_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_usage_logs', 'member_id', 'orphan_member_id', 'error',
  count(*),
  (SELECT group_concat(`member_id`, ',') FROM (
    SELECT DISTINCT `member_id`
      FROM `partnership_usage_logs`
     WHERE NOT EXISTS (SELECT 1 FROM `verified_members` WHERE `verified_members`.`id` = `partnership_usage_logs`.`member_id`)
     LIMIT 5
  )),
  'partnership_usage_logs.member_id must reference verified_members.id before component rebuild.'
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `verified_members` WHERE `verified_members`.`id` = `partnership_usage_logs`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_usage_logs', 'order_id', 'orphan_order_id', 'error',
  count(*),
  (SELECT group_concat(`order_id`, ',') FROM (
    SELECT DISTINCT `order_id`
      FROM `partnership_usage_logs`
     WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `partnership_usage_logs`.`order_id`)
     LIMIT 5
  )),
  'partnership_usage_logs.order_id must reference orders.id before component rebuild.'
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `partnership_usage_logs`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'partnership_usage_logs', 'verified_by_user_id', 'orphan_verified_by_user_id', 'error',
  count(*),
  (SELECT group_concat(`verified_by_user_id`, ',') FROM (
    SELECT DISTINCT `verified_by_user_id`
      FROM `partnership_usage_logs`
     WHERE `verified_by_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_usage_logs`.`verified_by_user_id`)
     LIMIT 5
  )),
  'partnership_usage_logs.verified_by_user_id must reference users.id before component rebuild.'
FROM `partnership_usage_logs`
WHERE `verified_by_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_usage_logs`.`verified_by_user_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_partnership_plans_component_fk_0032`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_partnership_plans_component_fk_0032` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_plans.restaurant_id.orphan_restaurant_id',
  count(*)
FROM `partnership_plans`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_plans.partnership_id.orphan_partnership_id',
  count(*)
FROM `partnership_plans`
WHERE NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_plans`.`partnership_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_plans.created_by.orphan_created_by',
  count(*)
FROM `partnership_plans`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_plans`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_usage_logs.restaurant_id.orphan_restaurant_id',
  count(*)
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_usage_logs.partnership_id.orphan_partnership_id',
  count(*)
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_usage_logs`.`partnership_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_usage_logs.plan_id.orphan_plan_id',
  count(*)
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `partnership_plans` WHERE `partnership_plans`.`id` = `partnership_usage_logs`.`plan_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_usage_logs.member_id.orphan_member_id',
  count(*)
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `verified_members` WHERE `verified_members`.`id` = `partnership_usage_logs`.`member_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_usage_logs.order_id.orphan_order_id',
  count(*)
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `partnership_usage_logs`.`order_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_fk_0032`
SELECT
  'partnership_usage_logs.verified_by_user_id.orphan_verified_by_user_id',
  count(*)
FROM `partnership_usage_logs`
WHERE `verified_by_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_usage_logs`.`verified_by_user_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_partnership_plans_component_fk_0032`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_partnership_plans_component_counts_0032`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_partnership_plans_component_counts_0032` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `partnership_usage_logs__component_rebuild_data` AS SELECT * FROM `partnership_usage_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_counts_0032`
SELECT
  'partnership_usage_logs.stage',
  (SELECT count(*) FROM `partnership_usage_logs`),
  (SELECT count(*) FROM `partnership_usage_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `partnership_plans__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `partnership_plans__component_rebuild_data` AS SELECT * FROM `partnership_plans`;
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_counts_0032`
SELECT
  'partnership_plans.stage',
  (SELECT count(*) FROM `partnership_plans`),
  (SELECT count(*) FROM `partnership_plans__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `partnership_usage_logs`;
--> statement-breakpoint

DROP TABLE `partnership_plans`;
--> statement-breakpoint

CREATE TABLE "partnership_plans" (
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
	`created_by` integer,
	`deleted_at_ms` integer,
	`discount_value_cents` integer,
	`max_discount_amount_cents` integer,
	`min_order_amount_cents` integer,
	`max_order_amount_cents` integer,
	`total_discount_given_cents` integer,
	`total_revenue_cents` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `partnership_plans` (
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
FROM `partnership_plans__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_counts_0032`
SELECT
  'partnership_plans.final',
  (SELECT count(*) FROM `partnership_plans__component_rebuild_data`),
  (SELECT count(*) FROM `partnership_plans`);
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

CREATE TABLE "partnership_usage_logs" (
	`id` text PRIMARY KEY NOT NULL,
	`partnership_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`member_id` text NOT NULL,
	`order_id` integer NOT NULL,
	`restaurant_id` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`discount_amount` real NOT NULL,
	`original_amount` real NOT NULL,
	`final_amount` real NOT NULL,
	`order_items` text DEFAULT '[]',
	"used_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`channel` text,
	`verification_method` text,
	`verified_by_user_id` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	"cancelled_at_ms" integer,
	`cancellation_reason` text,
	"refunded_at_ms" integer,
	`metadata` text DEFAULT '{}',
	"created_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`discount_value_cents` integer,
	`discount_amount_cents` integer,
	`original_amount_cents` integer,
	`final_amount_cents` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `partnership_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `verified_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `partnership_usage_logs` (
  `id`,
  `partnership_id`,
  `plan_id`,
  `member_id`,
  `order_id`,
  `restaurant_id`,
  `discount_type`,
  `discount_value`,
  `discount_amount`,
  `original_amount`,
  `final_amount`,
  `order_items`,
  `used_at_ms`,
  `channel`,
  `verification_method`,
  `verified_by_user_id`,
  `status`,
  `cancelled_at_ms`,
  `cancellation_reason`,
  `refunded_at_ms`,
  `metadata`,
  `created_at_ms`,
  `discount_value_cents`,
  `discount_amount_cents`,
  `original_amount_cents`,
  `final_amount_cents`
)
SELECT
  `id`,
  `partnership_id`,
  `plan_id`,
  `member_id`,
  `order_id`,
  `restaurant_id`,
  `discount_type`,
  `discount_value`,
  `discount_amount`,
  `original_amount`,
  `final_amount`,
  `order_items`,
  `used_at_ms`,
  `channel`,
  `verification_method`,
  `verified_by_user_id`,
  `status`,
  `cancelled_at_ms`,
  `cancellation_reason`,
  `refunded_at_ms`,
  `metadata`,
  `created_at_ms`,
  `discount_value_cents`,
  `discount_amount_cents`,
  `original_amount_cents`,
  `final_amount_cents`
FROM `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_partnership_plans_component_counts_0032`
SELECT
  'partnership_usage_logs.final',
  (SELECT count(*) FROM `partnership_usage_logs__component_rebuild_data`),
  (SELECT count(*) FROM `partnership_usage_logs`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_date` ON `partnership_usage_logs` ("used_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_member` ON `partnership_usage_logs` (`member_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_order` ON `partnership_usage_logs` (`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_partnership` ON `partnership_usage_logs` (`partnership_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_plan` ON `partnership_usage_logs` (`plan_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_restaurant` ON `partnership_usage_logs` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_usage_logs_status` ON `partnership_usage_logs` (`status`);
--> statement-breakpoint

CREATE TRIGGER `partnership_usage_logs_cents_sync_ai`
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

CREATE TRIGGER `partnership_usage_logs_cents_sync_au`
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

CREATE TRIGGER `partnership_usage_logs_restaurant_guard_bi`
BEFORE INSERT ON `partnership_usage_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_usage_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `partnership_usage_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `partnership_usage_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_usage_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

DROP TABLE `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `partnership_plans__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_partnership_plans_component_counts_0032`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'partnership_plans', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'partnership_plans was rebuilt with a physical restaurant_id FK in 0032 using a D1-safe component rebuild.');
--> statement-breakpoint
