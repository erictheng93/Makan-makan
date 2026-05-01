-- 0028 restaurant fk rebuild operational support.
-- Adds physical restaurant_id foreign keys through SQLite/D1-safe leaf table rebuilds.
-- Tables with inbound foreign keys are intentionally deferred to component rebuild migrations.
-- Existing orphan rows are audited and asserted before any table swap.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'audit_logs', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `audit_logs`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `audit_logs`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 audit_logs physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `audit_logs`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `audit_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'error_reports', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `error_reports`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `error_reports`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 error_reports physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `error_reports`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `error_reports`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'system_alerts', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `system_alerts`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `system_alerts`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 system_alerts physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `system_alerts`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `system_alerts`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'dish_search_index', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `dish_search_index`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `dish_search_index`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 dish_search_index physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `dish_search_index`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `dish_search_index`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'images', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `images`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `images`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 images physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `images`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `images`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'forecast_cache', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `forecast_cache`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `forecast_cache`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 forecast_cache physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `forecast_cache`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `forecast_cache`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'ingredient_definitions', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `ingredient_definitions`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `ingredient_definitions`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 ingredient_definitions physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `ingredient_definitions`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `ingredient_definitions`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'platform_integrations', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `platform_integrations`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_integrations`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 platform_integrations physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `platform_integrations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_integrations`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'platform_orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `platform_orders`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_orders`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 platform_orders physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `platform_orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'platform_menu_mappings', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `platform_menu_mappings`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_menu_mappings`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 platform_menu_mappings physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `platform_menu_mappings`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_menu_mappings`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'platform_webhook_logs', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `platform_webhook_logs`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_webhook_logs`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 platform_webhook_logs physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `platform_webhook_logs`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_webhook_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'shop_feedback', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `shop_feedback`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shop_feedback`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 shop_feedback physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `shop_feedback`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shop_feedback`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'qr_batches', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `qr_batches`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `qr_batches`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 qr_batches physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `qr_batches`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `qr_batches`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'coupon_templates', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `coupon_templates`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0028 coupon_templates physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `coupon_templates`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_restaurant_fk_0028`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_restaurant_fk_0028` (
  `table_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'audit_logs',
  count(*)
FROM `audit_logs`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `audit_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'error_reports',
  count(*)
FROM `error_reports`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `error_reports`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'system_alerts',
  count(*)
FROM `system_alerts`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `system_alerts`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'dish_search_index',
  count(*)
FROM `dish_search_index`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `dish_search_index`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'images',
  count(*)
FROM `images`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `images`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'forecast_cache',
  count(*)
FROM `forecast_cache`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `forecast_cache`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'ingredient_definitions',
  count(*)
FROM `ingredient_definitions`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `ingredient_definitions`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'platform_integrations',
  count(*)
FROM `platform_integrations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_integrations`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'platform_orders',
  count(*)
FROM `platform_orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'platform_menu_mappings',
  count(*)
FROM `platform_menu_mappings`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_menu_mappings`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'platform_webhook_logs',
  count(*)
FROM `platform_webhook_logs`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_webhook_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'shop_feedback',
  count(*)
FROM `shop_feedback`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shop_feedback`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'qr_batches',
  count(*)
FROM `qr_batches`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `qr_batches`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0028`
SELECT
  'coupon_templates',
  count(*)
FROM `coupon_templates`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_restaurant_fk_0028`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_restaurant_fk_counts_0028`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_restaurant_fk_counts_0028` (
  `table_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `rebuilt_count` integer NOT NULL,
  CHECK (`source_count` = `rebuilt_count`)
);
--> statement-breakpoint

-- Rebuild audit_logs.
DROP TABLE IF EXISTS `audit_logs__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `audit_logs__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`restaurant_id` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text,
	`description` text NOT NULL,
	`changes` text,
	`ip_address` text,
	`user_agent` text,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	`execution_time_ms` integer,
	`created_at_ms` integer NOT NULL, on_behalf_of_user_id INTEGER REFERENCES users(id),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `audit_logs__restaurant_fk_rebuild` (
  `id`,
  `user_id`,
  `restaurant_id`,
  `action`,
  `resource`,
  `resource_id`,
  `description`,
  `changes`,
  `ip_address`,
  `user_agent`,
  `success`,
  `error_message`,
  `execution_time_ms`,
  `created_at_ms`,
  `on_behalf_of_user_id`
)
SELECT
  `id`,
  `user_id`,
  `restaurant_id`,
  `action`,
  `resource`,
  `resource_id`,
  `description`,
  `changes`,
  `ip_address`,
  `user_agent`,
  `success`,
  `error_message`,
  `execution_time_ms`,
  `created_at_ms`,
  `on_behalf_of_user_id`
FROM `audit_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'audit_logs',
  (SELECT count(*) FROM `audit_logs`),
  (SELECT count(*) FROM `audit_logs__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `audit_logs`;
--> statement-breakpoint

ALTER TABLE `audit_logs__restaurant_fk_rebuild` RENAME TO `audit_logs`;
--> statement-breakpoint

CREATE INDEX audit_logs_on_behalf_of_idx
  ON audit_logs(on_behalf_of_user_id, created_at_ms);
--> statement-breakpoint

CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource`,`resource_id`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `audit_logs_restaurant_action_idx` ON `audit_logs` (`restaurant_id`,`action`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `audit_logs_time_idx` ON `audit_logs` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `audit_logs_user_action_idx` ON `audit_logs` (`user_id`,`action`,`created_at_ms`);
--> statement-breakpoint

CREATE TRIGGER `audit_logs_restaurant_guard_bi`
BEFORE INSERT ON `audit_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `audit_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `audit_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'audit_logs', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'audit_logs was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild error_reports.
DROP TABLE IF EXISTS `error_reports__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `error_reports__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`restaurant_id` text,
	`error_type` text NOT NULL,
	`severity` text NOT NULL,
	`error_code` text,
	`error_message` text NOT NULL,
	`error_context` text,
	`original_error` text,
	`user_agent` text,
	`url` text,
	`timestamp_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer,
	`resolved_by` integer,
	`resolution_notes` text,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `error_reports__restaurant_fk_rebuild` (
  `id`,
  `user_id`,
  `restaurant_id`,
  `error_type`,
  `severity`,
  `error_code`,
  `error_message`,
  `error_context`,
  `original_error`,
  `user_agent`,
  `url`,
  `timestamp_ms`,
  `created_at_ms`,
  `resolved_at_ms`,
  `resolved_by`,
  `resolution_notes`
)
SELECT
  `id`,
  `user_id`,
  `restaurant_id`,
  `error_type`,
  `severity`,
  `error_code`,
  `error_message`,
  `error_context`,
  `original_error`,
  `user_agent`,
  `url`,
  `timestamp_ms`,
  `created_at_ms`,
  `resolved_at_ms`,
  `resolved_by`,
  `resolution_notes`
FROM `error_reports`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'error_reports',
  (SELECT count(*) FROM `error_reports`),
  (SELECT count(*) FROM `error_reports__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `error_reports`;
--> statement-breakpoint

ALTER TABLE `error_reports__restaurant_fk_rebuild` RENAME TO `error_reports`;
--> statement-breakpoint

CREATE INDEX `idx_error_reports_created_at` ON `error_reports` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_error_type` ON `error_reports` (`error_type`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_restaurant_id` ON `error_reports` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_restaurant_timestamp` ON `error_reports` (`restaurant_id`,`timestamp_ms`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_severity` ON `error_reports` (`severity`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_timestamp` ON `error_reports` (`timestamp_ms`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_type_severity` ON `error_reports` (`error_type`,`severity`);
--> statement-breakpoint

CREATE INDEX `idx_error_reports_user_id` ON `error_reports` (`user_id`);
--> statement-breakpoint

CREATE TRIGGER `error_reports_restaurant_guard_bi`
BEFORE INSERT ON `error_reports`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'error_reports.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `error_reports_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `error_reports`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'error_reports.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'error_reports', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'error_reports was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild system_alerts.
DROP TABLE IF EXISTS `system_alerts__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `system_alerts__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`alert_type` text NOT NULL,
	`restaurant_id` text,
	`affected_component` text,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer,
	`resolved_by` integer,
	`resolution_notes` text,
	`auto_resolved` integer DEFAULT false,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `system_alerts__restaurant_fk_rebuild` (
  `id`,
  `title`,
  `description`,
  `severity`,
  `alert_type`,
  `restaurant_id`,
  `affected_component`,
  `created_at_ms`,
  `resolved_at_ms`,
  `resolved_by`,
  `resolution_notes`,
  `auto_resolved`
)
SELECT
  `id`,
  `title`,
  `description`,
  `severity`,
  `alert_type`,
  `restaurant_id`,
  `affected_component`,
  `created_at_ms`,
  `resolved_at_ms`,
  `resolved_by`,
  `resolution_notes`,
  `auto_resolved`
FROM `system_alerts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'system_alerts',
  (SELECT count(*) FROM `system_alerts`),
  (SELECT count(*) FROM `system_alerts__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `system_alerts`;
--> statement-breakpoint

ALTER TABLE `system_alerts__restaurant_fk_rebuild` RENAME TO `system_alerts`;
--> statement-breakpoint

CREATE INDEX `idx_system_alerts_created_at` ON `system_alerts` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_system_alerts_restaurant_id` ON `system_alerts` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_system_alerts_severity` ON `system_alerts` (`severity`);
--> statement-breakpoint

CREATE TRIGGER `system_alerts_restaurant_guard_bi`
BEFORE INSERT ON `system_alerts`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'system_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `system_alerts_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `system_alerts`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'system_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'system_alerts', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'system_alerts was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild dish_search_index.
DROP TABLE IF EXISTS `dish_search_index__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `dish_search_index__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  restaurant_id TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  dish_name_normalized TEXT NOT NULL,
  category_name TEXT,
  price REAL,
  is_available INTEGER NOT NULL DEFAULT 1,
  tags TEXT,
  district TEXT,
  restaurant_type TEXT,
  supports_takeaway INTEGER NOT NULL DEFAULT 0,
  supports_delivery INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL
, `price_cents` integer,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `dish_search_index__restaurant_fk_rebuild` (
  `id`,
  `menu_item_id`,
  `restaurant_id`,
  `dish_name`,
  `dish_name_normalized`,
  `category_name`,
  `price`,
  `is_available`,
  `tags`,
  `district`,
  `restaurant_type`,
  `supports_takeaway`,
  `supports_delivery`,
  `updated_at_ms`,
  `price_cents`
)
SELECT
  `id`,
  `menu_item_id`,
  `restaurant_id`,
  `dish_name`,
  `dish_name_normalized`,
  `category_name`,
  `price`,
  `is_available`,
  `tags`,
  `district`,
  `restaurant_type`,
  `supports_takeaway`,
  `supports_delivery`,
  `updated_at_ms`,
  `price_cents`
FROM `dish_search_index`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'dish_search_index',
  (SELECT count(*) FROM `dish_search_index`),
  (SELECT count(*) FROM `dish_search_index__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `dish_search_index`;
--> statement-breakpoint

ALTER TABLE `dish_search_index__restaurant_fk_rebuild` RENAME TO `dish_search_index`;
--> statement-breakpoint

CREATE INDEX dish_search_district_available_idx ON dish_search_index (district, is_available);
--> statement-breakpoint

CREATE INDEX dish_search_name_available_idx ON dish_search_index (dish_name_normalized, is_available);
--> statement-breakpoint

CREATE INDEX dish_search_price_available_idx ON dish_search_index (price, is_available);
--> statement-breakpoint

CREATE INDEX dish_search_restaurant_available_idx ON dish_search_index (restaurant_id, is_available);
--> statement-breakpoint

CREATE TRIGGER `dish_search_index_price_cents_sync_ai`
AFTER INSERT ON `dish_search_index`
FOR EACH ROW
BEGIN
  UPDATE `dish_search_index`
     SET `price_cents` = CASE WHEN NEW.`price` IS NULL THEN NULL ELSE CAST(round(NEW.`price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `dish_search_index_price_cents_sync_au`
AFTER UPDATE OF `price` ON `dish_search_index`
FOR EACH ROW
BEGIN
  UPDATE `dish_search_index`
     SET `price_cents` = CASE WHEN NEW.`price` IS NULL THEN NULL ELSE CAST(round(NEW.`price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `dish_search_index_restaurant_guard_bi`
BEFORE INSERT ON `dish_search_index`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'dish_search_index.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `dish_search_index_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `dish_search_index`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'dish_search_index.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'dish_search_index', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'dish_search_index was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild images.
DROP TABLE IF EXISTS `images__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `images__restaurant_fk_rebuild` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`category` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`uploaded_by` integer,
	`cloudflare_image_id` text,
	`variants` text,
	`metadata` text,
	`is_active` integer DEFAULT true NOT NULL,
	"uploaded_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `images__restaurant_fk_rebuild` (
  `id`,
  `filename`,
  `original_filename`,
  `mime_type`,
  `size`,
  `width`,
  `height`,
  `category`,
  `restaurant_id`,
  `uploaded_by`,
  `cloudflare_image_id`,
  `variants`,
  `metadata`,
  `is_active`,
  `uploaded_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `filename`,
  `original_filename`,
  `mime_type`,
  `size`,
  `width`,
  `height`,
  `category`,
  `restaurant_id`,
  `uploaded_by`,
  `cloudflare_image_id`,
  `variants`,
  `metadata`,
  `is_active`,
  `uploaded_at_ms`,
  `updated_at_ms`
FROM `images`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'images',
  (SELECT count(*) FROM `images`),
  (SELECT count(*) FROM `images__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `images`;
--> statement-breakpoint

ALTER TABLE `images__restaurant_fk_rebuild` RENAME TO `images`;
--> statement-breakpoint

CREATE TRIGGER `images_restaurant_guard_bi`
BEFORE INSERT ON `images`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'images.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `images_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `images`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'images.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'images', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'images was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild forecast_cache.
DROP TABLE IF EXISTS `forecast_cache__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `forecast_cache__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  forecast_date TEXT NOT NULL,
  forecast_type TEXT NOT NULL,
  data TEXT,
  metadata TEXT,
  generated_by TEXT NOT NULL,
  expires_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `forecast_cache__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `forecast_date`,
  `forecast_type`,
  `data`,
  `metadata`,
  `generated_by`,
  `expires_at_ms`,
  `created_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `forecast_date`,
  `forecast_type`,
  `data`,
  `metadata`,
  `generated_by`,
  `expires_at_ms`,
  `created_at_ms`
FROM `forecast_cache`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'forecast_cache',
  (SELECT count(*) FROM `forecast_cache`),
  (SELECT count(*) FROM `forecast_cache__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `forecast_cache`;
--> statement-breakpoint

ALTER TABLE `forecast_cache__restaurant_fk_rebuild` RENAME TO `forecast_cache`;
--> statement-breakpoint

CREATE INDEX forecast_cache_expires_at_idx
  ON forecast_cache (expires_at_ms);
--> statement-breakpoint

CREATE UNIQUE INDEX forecast_cache_restaurant_date_type_idx
  ON forecast_cache (restaurant_id, forecast_date, forecast_type);
--> statement-breakpoint

CREATE TRIGGER `forecast_cache_restaurant_guard_bi`
BEFORE INSERT ON `forecast_cache`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'forecast_cache.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `forecast_cache_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `forecast_cache`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'forecast_cache.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'forecast_cache', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'forecast_cache was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild ingredient_definitions.
DROP TABLE IF EXISTS `ingredient_definitions__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `ingredient_definitions__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT,
  cost_per_unit REAL,
  supplier TEXT,
  min_stock_level REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
, current_stock REAL, `cost_per_unit_cents` integer,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `ingredient_definitions__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `unit`,
  `category`,
  `cost_per_unit`,
  `supplier`,
  `min_stock_level`,
  `is_active`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `current_stock`,
  `cost_per_unit_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `unit`,
  `category`,
  `cost_per_unit`,
  `supplier`,
  `min_stock_level`,
  `is_active`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `current_stock`,
  `cost_per_unit_cents`
FROM `ingredient_definitions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'ingredient_definitions',
  (SELECT count(*) FROM `ingredient_definitions`),
  (SELECT count(*) FROM `ingredient_definitions__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `ingredient_definitions`;
--> statement-breakpoint

ALTER TABLE `ingredient_definitions__restaurant_fk_rebuild` RENAME TO `ingredient_definitions`;
--> statement-breakpoint

CREATE INDEX ingredient_defs_restaurant_active_idx
  ON ingredient_definitions (restaurant_id, is_active);
--> statement-breakpoint

CREATE INDEX ingredient_defs_restaurant_category_idx
  ON ingredient_definitions (restaurant_id, category);
--> statement-breakpoint

CREATE TRIGGER `ingredient_definitions_cost_cents_sync_ai`
AFTER INSERT ON `ingredient_definitions`
FOR EACH ROW
BEGIN
  UPDATE `ingredient_definitions`
     SET `cost_per_unit_cents` = CASE WHEN NEW.`cost_per_unit` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_per_unit` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `ingredient_definitions_cost_cents_sync_au`
AFTER UPDATE OF `cost_per_unit` ON `ingredient_definitions`
FOR EACH ROW
BEGIN
  UPDATE `ingredient_definitions`
     SET `cost_per_unit_cents` = CASE WHEN NEW.`cost_per_unit` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_per_unit` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `ingredient_definitions_restaurant_guard_bi`
BEFORE INSERT ON `ingredient_definitions`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'ingredient_definitions.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `ingredient_definitions_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `ingredient_definitions`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'ingredient_definitions.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'ingredient_definitions', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'ingredient_definitions was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild platform_integrations.
DROP TABLE IF EXISTS `platform_integrations__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `platform_integrations__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  credentials TEXT,
  config TEXT DEFAULT '{"autoAcceptOrders":false,"menuSyncEnabled":false}',
  last_menu_sync_at_ms INTEGER,
  menu_sync_status TEXT DEFAULT 'idle',
  menu_sync_error TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `platform_integrations__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `platform`,
  `enabled`,
  `credentials`,
  `config`,
  `last_menu_sync_at_ms`,
  `menu_sync_status`,
  `menu_sync_error`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `platform`,
  `enabled`,
  `credentials`,
  `config`,
  `last_menu_sync_at_ms`,
  `menu_sync_status`,
  `menu_sync_error`,
  `created_at_ms`,
  `updated_at_ms`
FROM `platform_integrations`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'platform_integrations',
  (SELECT count(*) FROM `platform_integrations`),
  (SELECT count(*) FROM `platform_integrations__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `platform_integrations`;
--> statement-breakpoint

ALTER TABLE `platform_integrations__restaurant_fk_rebuild` RENAME TO `platform_integrations`;
--> statement-breakpoint

CREATE INDEX platform_integrations_enabled_idx
  ON platform_integrations (enabled, platform);
--> statement-breakpoint

CREATE UNIQUE INDEX platform_integrations_restaurant_platform_idx
  ON platform_integrations (restaurant_id, platform);
--> statement-breakpoint

CREATE TRIGGER `platform_integrations_restaurant_guard_bi`
BEFORE INSERT ON `platform_integrations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_integrations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `platform_integrations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_integrations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_integrations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'platform_integrations', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'platform_integrations was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild platform_orders.
DROP TABLE IF EXISTS `platform_orders__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `platform_orders__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_order_id TEXT NOT NULL,
  platform_store_id TEXT,
  restaurant_id TEXT NOT NULL,
  platform_status TEXT,
  last_synced_at_ms INTEGER,
  raw_payload TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `platform_orders__restaurant_fk_rebuild` (
  `id`,
  `order_id`,
  `platform`,
  `platform_order_id`,
  `platform_store_id`,
  `restaurant_id`,
  `platform_status`,
  `last_synced_at_ms`,
  `raw_payload`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `order_id`,
  `platform`,
  `platform_order_id`,
  `platform_store_id`,
  `restaurant_id`,
  `platform_status`,
  `last_synced_at_ms`,
  `raw_payload`,
  `created_at_ms`,
  `updated_at_ms`
FROM `platform_orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'platform_orders',
  (SELECT count(*) FROM `platform_orders`),
  (SELECT count(*) FROM `platform_orders__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `platform_orders`;
--> statement-breakpoint

ALTER TABLE `platform_orders__restaurant_fk_rebuild` RENAME TO `platform_orders`;
--> statement-breakpoint

CREATE INDEX platform_orders_order_idx
  ON platform_orders (order_id);
--> statement-breakpoint

CREATE UNIQUE INDEX platform_orders_platform_order_idx
  ON platform_orders (platform, platform_order_id);
--> statement-breakpoint

CREATE INDEX platform_orders_restaurant_platform_idx
  ON platform_orders (restaurant_id, platform, created_at_ms);
--> statement-breakpoint

CREATE TRIGGER `platform_orders_restaurant_guard_bi`
BEFORE INSERT ON `platform_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `platform_orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'platform_orders', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'platform_orders was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild platform_menu_mappings.
DROP TABLE IF EXISTS `platform_menu_mappings__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `platform_menu_mappings__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_item_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  last_synced_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `platform_menu_mappings__restaurant_fk_rebuild` (
  `id`,
  `menu_item_id`,
  `restaurant_id`,
  `platform`,
  `platform_item_id`,
  `sync_status`,
  `last_synced_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `menu_item_id`,
  `restaurant_id`,
  `platform`,
  `platform_item_id`,
  `sync_status`,
  `last_synced_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
FROM `platform_menu_mappings`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'platform_menu_mappings',
  (SELECT count(*) FROM `platform_menu_mappings`),
  (SELECT count(*) FROM `platform_menu_mappings__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `platform_menu_mappings`;
--> statement-breakpoint

ALTER TABLE `platform_menu_mappings__restaurant_fk_rebuild` RENAME TO `platform_menu_mappings`;
--> statement-breakpoint

CREATE UNIQUE INDEX platform_menu_mappings_item_platform_idx
  ON platform_menu_mappings (menu_item_id, platform);
--> statement-breakpoint

CREATE INDEX platform_menu_mappings_restaurant_platform_idx
  ON platform_menu_mappings (restaurant_id, platform);
--> statement-breakpoint

CREATE TRIGGER `platform_menu_mappings_restaurant_guard_bi`
BEFORE INSERT ON `platform_menu_mappings`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_menu_mappings.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `platform_menu_mappings_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_menu_mappings`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_menu_mappings.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'platform_menu_mappings', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'platform_menu_mappings was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild platform_webhook_logs.
DROP TABLE IF EXISTS `platform_webhook_logs__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `platform_webhook_logs__restaurant_fk_rebuild` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  restaurant_id TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  processed_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `platform_webhook_logs__restaurant_fk_rebuild` (
  `id`,
  `platform`,
  `event_type`,
  `restaurant_id`,
  `payload`,
  `status`,
  `error`,
  `processed_at_ms`,
  `created_at_ms`
)
SELECT
  `id`,
  `platform`,
  `event_type`,
  `restaurant_id`,
  `payload`,
  `status`,
  `error`,
  `processed_at_ms`,
  `created_at_ms`
FROM `platform_webhook_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'platform_webhook_logs',
  (SELECT count(*) FROM `platform_webhook_logs`),
  (SELECT count(*) FROM `platform_webhook_logs__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `platform_webhook_logs`;
--> statement-breakpoint

ALTER TABLE `platform_webhook_logs__restaurant_fk_rebuild` RENAME TO `platform_webhook_logs`;
--> statement-breakpoint

CREATE INDEX platform_webhook_logs_platform_event_idx
  ON platform_webhook_logs (platform, event_type, created_at_ms);
--> statement-breakpoint

CREATE INDEX platform_webhook_logs_restaurant_idx
  ON platform_webhook_logs (restaurant_id, created_at_ms);
--> statement-breakpoint

CREATE INDEX platform_webhook_logs_status_idx
  ON platform_webhook_logs (status, created_at_ms);
--> statement-breakpoint

CREATE TRIGGER `platform_webhook_logs_restaurant_guard_bi`
BEFORE INSERT ON `platform_webhook_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_webhook_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `platform_webhook_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_webhook_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_webhook_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'platform_webhook_logs', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'platform_webhook_logs was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild shop_feedback.
DROP TABLE IF EXISTS `shop_feedback__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `shop_feedback__restaurant_fk_rebuild` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `restaurant_id` text NOT NULL,
  `user_id` integer NOT NULL,
  `category` text NOT NULL,
  `priority` text DEFAULT 'medium' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `related_module` text DEFAULT 'other' NOT NULL,
  `subject` text NOT NULL,
  `description` text NOT NULL,
  `attachment_urls` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `resolved_at_ms` integer,
  `resolved_by` integer,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `shop_feedback__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `user_id`,
  `category`,
  `priority`,
  `status`,
  `related_module`,
  `subject`,
  `description`,
  `attachment_urls`,
  `created_at_ms`,
  `updated_at_ms`,
  `resolved_at_ms`,
  `resolved_by`
)
SELECT
  `id`,
  `restaurant_id`,
  `user_id`,
  `category`,
  `priority`,
  `status`,
  `related_module`,
  `subject`,
  `description`,
  `attachment_urls`,
  `created_at_ms`,
  `updated_at_ms`,
  `resolved_at_ms`,
  `resolved_by`
FROM `shop_feedback`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'shop_feedback',
  (SELECT count(*) FROM `shop_feedback`),
  (SELECT count(*) FROM `shop_feedback__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `shop_feedback`;
--> statement-breakpoint

ALTER TABLE `shop_feedback__restaurant_fk_rebuild` RENAME TO `shop_feedback`;
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_category` ON `shop_feedback` (`category`);
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_category_status` ON `shop_feedback` (`category`,`status`);
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_created_at` ON `shop_feedback` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_restaurant_id` ON `shop_feedback` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_restaurant_status` ON `shop_feedback` (`restaurant_id`,`status`);
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_status` ON `shop_feedback` (`status`);
--> statement-breakpoint

CREATE INDEX `idx_shop_feedback_user_id` ON `shop_feedback` (`user_id`);
--> statement-breakpoint

CREATE TRIGGER `shop_feedback_restaurant_guard_bi`
BEFORE INSERT ON `shop_feedback`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shop_feedback.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `shop_feedback_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `shop_feedback`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shop_feedback.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'shop_feedback', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'shop_feedback was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild qr_batches.
DROP TABLE IF EXISTS `qr_batches__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `qr_batches__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`total_codes` integer NOT NULL,
	`generated_codes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` integer NOT NULL,
	"created_at_ms" integer NOT NULL,
	"completed_at_ms" integer,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `qr_batches__restaurant_fk_rebuild` (
  `id`,
  `batch_id`,
  `restaurant_id`,
  `total_codes`,
  `generated_codes`,
  `status`,
  `created_by`,
  `created_at_ms`,
  `completed_at_ms`
)
SELECT
  `id`,
  `batch_id`,
  `restaurant_id`,
  `total_codes`,
  `generated_codes`,
  `status`,
  `created_by`,
  `created_at_ms`,
  `completed_at_ms`
FROM `qr_batches`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'qr_batches',
  (SELECT count(*) FROM `qr_batches`),
  (SELECT count(*) FROM `qr_batches__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `qr_batches`;
--> statement-breakpoint

ALTER TABLE `qr_batches__restaurant_fk_rebuild` RENAME TO `qr_batches`;
--> statement-breakpoint

CREATE UNIQUE INDEX `qr_batches_batch_id_unique` ON `qr_batches` (`batch_id`);
--> statement-breakpoint

CREATE TRIGGER `qr_batches_restaurant_guard_bi`
BEFORE INSERT ON `qr_batches`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'qr_batches.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `qr_batches_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `qr_batches`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'qr_batches.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'qr_batches', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'qr_batches was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

-- Rebuild coupon_templates.
DROP TABLE IF EXISTS `coupon_templates__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `coupon_templates__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`name` text NOT NULL,
	`description` text,
	`template_data` text NOT NULL,
	`usage_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`is_system_template` integer DEFAULT false,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `coupon_templates__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `template_data`,
  `usage_count`,
  `is_active`,
  `is_system_template`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `template_data`,
  `usage_count`,
  `is_active`,
  `is_system_template`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`
FROM `coupon_templates`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0028`
SELECT
  'coupon_templates',
  (SELECT count(*) FROM `coupon_templates`),
  (SELECT count(*) FROM `coupon_templates__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `coupon_templates`;
--> statement-breakpoint

ALTER TABLE `coupon_templates__restaurant_fk_rebuild` RENAME TO `coupon_templates`;
--> statement-breakpoint

CREATE INDEX `idx_coupon_templates_active` ON `coupon_templates` (`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_templates_restaurant_id` ON `coupon_templates` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_templates_system` ON `coupon_templates` (`is_system_template`);
--> statement-breakpoint

CREATE TRIGGER `coupon_templates_restaurant_guard_bi`
BEFORE INSERT ON `coupon_templates`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupon_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `coupon_templates_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupon_templates`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupon_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'coupon_templates', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'coupon_templates was rebuilt with a physical restaurant_id FK in 0028.');
--> statement-breakpoint

DROP TABLE `_migration_assert_restaurant_fk_counts_0028`;
--> statement-breakpoint
