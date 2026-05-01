-- 0034 restaurant FK rebuild for workforce scheduling component.
-- Rebuilds shift_templates and employee_schedules with physical restaurant_id
-- FKs together with schedule_swap_requests, their direct child table. D1 keeps
-- foreign_keys enabled, so this migration stages data in no-FK tables and does
-- not rely on PRAGMA foreign_keys=OFF.

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
  'shift_templates.restaurant_id must reference restaurants.id before component rebuild.'
FROM `shift_templates`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'shift_templates', 'created_by', 'orphan_created_by', 'error',
  count(*),
  (SELECT group_concat(`created_by`, ',') FROM (
    SELECT DISTINCT `created_by`
      FROM `shift_templates`
     WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`created_by`)
     LIMIT 5
  )),
  'shift_templates.created_by must reference users.id before component rebuild.'
FROM `shift_templates`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'shift_templates', 'updated_by', 'orphan_updated_by', 'error',
  count(*),
  (SELECT group_concat(`updated_by`, ',') FROM (
    SELECT DISTINCT `updated_by`
      FROM `shift_templates`
     WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`updated_by`)
     LIMIT 5
  )),
  'shift_templates.updated_by must reference users.id before component rebuild.'
FROM `shift_templates`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`updated_by`);
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
  'employee_schedules.restaurant_id must reference restaurants.id before component rebuild.'
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'employee_schedules', 'employee_id', 'orphan_employee_id', 'error',
  count(*),
  (SELECT group_concat(`employee_id`, ',') FROM (
    SELECT DISTINCT `employee_id`
      FROM `employee_schedules`
     WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`employee_id`)
     LIMIT 5
  )),
  'employee_schedules.employee_id must reference users.id before component rebuild.'
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'employee_schedules', 'shift_template_id', 'orphan_shift_template_id', 'error',
  count(*),
  (SELECT group_concat(`shift_template_id`, ',') FROM (
    SELECT DISTINCT `shift_template_id`
      FROM `employee_schedules`
     WHERE `shift_template_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `shift_templates` WHERE `shift_templates`.`id` = `employee_schedules`.`shift_template_id`)
     LIMIT 5
  )),
  'employee_schedules.shift_template_id must reference shift_templates.id before component rebuild.'
FROM `employee_schedules`
WHERE `shift_template_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `shift_templates` WHERE `shift_templates`.`id` = `employee_schedules`.`shift_template_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'employee_schedules', 'confirmed_by', 'orphan_confirmed_by', 'error',
  count(*),
  (SELECT group_concat(`confirmed_by`, ',') FROM (
    SELECT DISTINCT `confirmed_by`
      FROM `employee_schedules`
     WHERE `confirmed_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`confirmed_by`)
     LIMIT 5
  )),
  'employee_schedules.confirmed_by must reference users.id before component rebuild.'
FROM `employee_schedules`
WHERE `confirmed_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`confirmed_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'employee_schedules', 'created_by', 'orphan_created_by', 'error',
  count(*),
  (SELECT group_concat(`created_by`, ',') FROM (
    SELECT DISTINCT `created_by`
      FROM `employee_schedules`
     WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`created_by`)
     LIMIT 5
  )),
  'employee_schedules.created_by must reference users.id before component rebuild.'
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'employee_schedules', 'updated_by', 'orphan_updated_by', 'error',
  count(*),
  (SELECT group_concat(`updated_by`, ',') FROM (
    SELECT DISTINCT `updated_by`
      FROM `employee_schedules`
     WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`updated_by`)
     LIMIT 5
  )),
  'employee_schedules.updated_by must reference users.id before component rebuild.'
FROM `employee_schedules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'schedule_swap_requests', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `schedule_swap_requests`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`)
     LIMIT 5
  )),
  'schedule_swap_requests.restaurant_id must reference restaurants.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'requester_employee_id', 'orphan_requester_employee_id', 'error',
  count(*),
  (SELECT group_concat(`requester_employee_id`, ',') FROM (
    SELECT DISTINCT `requester_employee_id`
      FROM `schedule_swap_requests`
     WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`requester_employee_id`)
     LIMIT 5
  )),
  'schedule_swap_requests.requester_employee_id must reference users.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`requester_employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'requester_schedule_id', 'orphan_requester_schedule_id', 'error',
  count(*),
  (SELECT group_concat(`requester_schedule_id`, ',') FROM (
    SELECT DISTINCT `requester_schedule_id`
      FROM `schedule_swap_requests`
     WHERE NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`requester_schedule_id`)
     LIMIT 5
  )),
  'schedule_swap_requests.requester_schedule_id must reference employee_schedules.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`requester_schedule_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'target_employee_id', 'orphan_target_employee_id', 'error',
  count(*),
  (SELECT group_concat(`target_employee_id`, ',') FROM (
    SELECT DISTINCT `target_employee_id`
      FROM `schedule_swap_requests`
     WHERE `target_employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`target_employee_id`)
     LIMIT 5
  )),
  'schedule_swap_requests.target_employee_id must reference users.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE `target_employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`target_employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'target_schedule_id', 'orphan_target_schedule_id', 'error',
  count(*),
  (SELECT group_concat(`target_schedule_id`, ',') FROM (
    SELECT DISTINCT `target_schedule_id`
      FROM `schedule_swap_requests`
     WHERE `target_schedule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`target_schedule_id`)
     LIMIT 5
  )),
  'schedule_swap_requests.target_schedule_id must reference employee_schedules.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE `target_schedule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`target_schedule_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'accepted_by', 'orphan_accepted_by', 'error',
  count(*),
  (SELECT group_concat(`accepted_by`, ',') FROM (
    SELECT DISTINCT `accepted_by`
      FROM `schedule_swap_requests`
     WHERE `accepted_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`accepted_by`)
     LIMIT 5
  )),
  'schedule_swap_requests.accepted_by must reference users.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE `accepted_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`accepted_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'approved_by', 'orphan_approved_by', 'error',
  count(*),
  (SELECT group_concat(`approved_by`, ',') FROM (
    SELECT DISTINCT `approved_by`
      FROM `schedule_swap_requests`
     WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`approved_by`)
     LIMIT 5
  )),
  'schedule_swap_requests.approved_by must reference users.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`approved_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'schedule_swap_requests', 'rejected_by', 'orphan_rejected_by', 'error',
  count(*),
  (SELECT group_concat(`rejected_by`, ',') FROM (
    SELECT DISTINCT `rejected_by`
      FROM `schedule_swap_requests`
     WHERE `rejected_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`rejected_by`)
     LIMIT 5
  )),
  'schedule_swap_requests.rejected_by must reference users.id before component rebuild.'
FROM `schedule_swap_requests`
WHERE `rejected_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`rejected_by`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_workforce_scheduling_component_fk_0034`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_workforce_scheduling_component_fk_0034` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'shift_templates.restaurant_id.orphan_restaurant_id', count(*)
FROM `shift_templates`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'shift_templates.created_by.orphan_created_by', count(*)
FROM `shift_templates`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'shift_templates.updated_by.orphan_updated_by', count(*)
FROM `shift_templates`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`updated_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'employee_schedules.restaurant_id.orphan_restaurant_id', count(*)
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'employee_schedules.employee_id.orphan_employee_id', count(*)
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`employee_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'employee_schedules.shift_template_id.orphan_shift_template_id', count(*)
FROM `employee_schedules`
WHERE `shift_template_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `shift_templates` WHERE `shift_templates`.`id` = `employee_schedules`.`shift_template_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'employee_schedules.confirmed_by.orphan_confirmed_by', count(*)
FROM `employee_schedules`
WHERE `confirmed_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`confirmed_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'employee_schedules.created_by.orphan_created_by', count(*)
FROM `employee_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'employee_schedules.updated_by.orphan_updated_by', count(*)
FROM `employee_schedules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`updated_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.restaurant_id.orphan_restaurant_id', count(*)
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.requester_employee_id.orphan_requester_employee_id', count(*)
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`requester_employee_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.requester_schedule_id.orphan_requester_schedule_id', count(*)
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`requester_schedule_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.target_employee_id.orphan_target_employee_id', count(*)
FROM `schedule_swap_requests`
WHERE `target_employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`target_employee_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.target_schedule_id.orphan_target_schedule_id', count(*)
FROM `schedule_swap_requests`
WHERE `target_schedule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`target_schedule_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.accepted_by.orphan_accepted_by', count(*)
FROM `schedule_swap_requests`
WHERE `accepted_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`accepted_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.approved_by.orphan_approved_by', count(*)
FROM `schedule_swap_requests`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`approved_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_fk_0034`
SELECT 'schedule_swap_requests.rejected_by.orphan_rejected_by', count(*)
FROM `schedule_swap_requests`
WHERE `rejected_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`rejected_by`);
--> statement-breakpoint

DROP TABLE `_migration_assert_workforce_scheduling_component_fk_0034`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_workforce_scheduling_component_counts_0034`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_workforce_scheduling_component_counts_0034` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `schedule_swap_requests__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `schedule_swap_requests__component_rebuild_data` AS SELECT * FROM `schedule_swap_requests`;
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_counts_0034`
SELECT
  'schedule_swap_requests.stage',
  (SELECT count(*) FROM `schedule_swap_requests`),
  (SELECT count(*) FROM `schedule_swap_requests__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `employee_schedules__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `employee_schedules__component_rebuild_data` AS SELECT * FROM `employee_schedules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_counts_0034`
SELECT
  'employee_schedules.stage',
  (SELECT count(*) FROM `employee_schedules`),
  (SELECT count(*) FROM `employee_schedules__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `shift_templates__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `shift_templates__component_rebuild_data` AS SELECT * FROM `shift_templates`;
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_counts_0034`
SELECT
  'shift_templates.stage',
  (SELECT count(*) FROM `shift_templates`),
  (SELECT count(*) FROM `shift_templates__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `schedule_swap_requests`;
--> statement-breakpoint

DROP TABLE `employee_schedules`;
--> statement-breakpoint

DROP TABLE `shift_templates`;
--> statement-breakpoint

CREATE TABLE `shift_templates` (
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
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
	`hourly_rate_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `shift_templates` (
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
FROM `shift_templates__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_counts_0034`
SELECT
  'shift_templates.final',
  (SELECT count(*) FROM `shift_templates__component_rebuild_data`),
  (SELECT count(*) FROM `shift_templates`);
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

CREATE TABLE `employee_schedules` (
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
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_template_id`) REFERENCES `shift_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `employee_schedules` (
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
FROM `employee_schedules__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_counts_0034`
SELECT
  'employee_schedules.final',
  (SELECT count(*) FROM `employee_schedules__component_rebuild_data`),
  (SELECT count(*) FROM `employee_schedules`);
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

CREATE TABLE `schedule_swap_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`requester_employee_id` integer NOT NULL,
	`requester_schedule_id` integer NOT NULL,
	`target_employee_id` integer,
	`target_schedule_id` integer,
	`request_type` text NOT NULL,
	`reason` text NOT NULL,
	`urgency` text DEFAULT 'normal',
	`is_open_request` integer DEFAULT false,
	`status` text DEFAULT 'pending' NOT NULL,
	`accepted_by` integer,
	`accepted_at_ms` integer,
	`approved_by` integer,
	`approved_at_ms` integer,
	`rejected_by` integer,
	`rejected_at_ms` integer,
	`rejection_reason` text,
	`expires_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`requester_employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_schedule_id`) REFERENCES `employee_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_schedule_id`) REFERENCES `employee_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `schedule_swap_requests` (
  `id`,
  `restaurant_id`,
  `requester_employee_id`,
  `requester_schedule_id`,
  `target_employee_id`,
  `target_schedule_id`,
  `request_type`,
  `reason`,
  `urgency`,
  `is_open_request`,
  `status`,
  `accepted_by`,
  `accepted_at_ms`,
  `approved_by`,
  `approved_at_ms`,
  `rejected_by`,
  `rejected_at_ms`,
  `rejection_reason`,
  `expires_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `requester_employee_id`,
  `requester_schedule_id`,
  `target_employee_id`,
  `target_schedule_id`,
  `request_type`,
  `reason`,
  `urgency`,
  `is_open_request`,
  `status`,
  `accepted_by`,
  `accepted_at_ms`,
  `approved_by`,
  `approved_at_ms`,
  `rejected_by`,
  `rejected_at_ms`,
  `rejection_reason`,
  `expires_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
FROM `schedule_swap_requests__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_workforce_scheduling_component_counts_0034`
SELECT
  'schedule_swap_requests.final',
  (SELECT count(*) FROM `schedule_swap_requests__component_rebuild_data`),
  (SELECT count(*) FROM `schedule_swap_requests`);
--> statement-breakpoint

CREATE INDEX `idx_schedule_swap_requests_requester_status` ON `schedule_swap_requests` (`requester_employee_id`,`status`);
--> statement-breakpoint

CREATE INDEX `idx_schedule_swap_requests_restaurant_status` ON `schedule_swap_requests` (`restaurant_id`,`status`);
--> statement-breakpoint

CREATE TRIGGER `schedule_swap_requests_restaurant_guard_bi`
BEFORE INSERT ON `schedule_swap_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'schedule_swap_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `schedule_swap_requests_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `schedule_swap_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'schedule_swap_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

DROP TABLE `schedule_swap_requests__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `employee_schedules__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `shift_templates__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_workforce_scheduling_component_counts_0034`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'shift_templates', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'shift_templates was rebuilt with a physical restaurant_id FK in 0034 using a D1-safe component rebuild.'),
  ('restaurant_fk', 'employee_schedules', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'employee_schedules was rebuilt with a physical restaurant_id FK in 0034 using a D1-safe component rebuild.');
--> statement-breakpoint
