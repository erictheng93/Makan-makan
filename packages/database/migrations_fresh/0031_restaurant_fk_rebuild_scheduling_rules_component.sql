-- 0031 restaurant FK rebuild for scheduling rules component.
-- Rebuilds scheduling_rules with a physical restaurant_id FK together
-- with scheduling_conflicts, its direct child table. D1 keeps foreign_keys
-- enabled, so this migration uses no-FK staging tables and does not rely
-- on PRAGMA foreign_keys=OFF.

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
  'scheduling_rules.restaurant_id must reference restaurants.id before component rebuild.'
FROM `scheduling_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'scheduling_rules', 'created_by', 'orphan_created_by', 'error',
  count(*),
  (SELECT group_concat(`created_by`, ',') FROM (
    SELECT DISTINCT `created_by`
      FROM `scheduling_rules`
     WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`created_by`)
     LIMIT 5
  )),
  'scheduling_rules.created_by must reference users.id before component rebuild.'
FROM `scheduling_rules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'scheduling_rules', 'updated_by', 'orphan_updated_by', 'error',
  count(*),
  (SELECT group_concat(`updated_by`, ',') FROM (
    SELECT DISTINCT `updated_by`
      FROM `scheduling_rules`
     WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`updated_by`)
     LIMIT 5
  )),
  'scheduling_rules.updated_by must reference users.id before component rebuild.'
FROM `scheduling_rules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'scheduling_conflicts', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `scheduling_conflicts`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`)
     LIMIT 5
  )),
  'scheduling_conflicts.restaurant_id must reference restaurants.id before component rebuild.'
FROM `scheduling_conflicts`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'scheduling_conflicts', 'rule_id', 'orphan_rule_id', 'error',
  count(*),
  (SELECT group_concat(`rule_id`, ',') FROM (
    SELECT DISTINCT `rule_id`
      FROM `scheduling_conflicts`
     WHERE `rule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `scheduling_rules` WHERE `scheduling_rules`.`id` = `scheduling_conflicts`.`rule_id`)
     LIMIT 5
  )),
  'scheduling_conflicts.rule_id must reference scheduling_rules.id before component rebuild.'
FROM `scheduling_conflicts`
WHERE `rule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `scheduling_rules` WHERE `scheduling_rules`.`id` = `scheduling_conflicts`.`rule_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'scheduling_conflicts', 'resolved_by', 'orphan_resolved_by', 'error',
  count(*),
  (SELECT group_concat(`resolved_by`, ',') FROM (
    SELECT DISTINCT `resolved_by`
      FROM `scheduling_conflicts`
     WHERE `resolved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_conflicts`.`resolved_by`)
     LIMIT 5
  )),
  'scheduling_conflicts.resolved_by must reference users.id before component rebuild.'
FROM `scheduling_conflicts`
WHERE `resolved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_conflicts`.`resolved_by`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_scheduling_rules_component_fk_0031`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_scheduling_rules_component_fk_0031` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_fk_0031`
SELECT
  'scheduling_rules.restaurant_id.orphan_restaurant_id',
  count(*)
FROM `scheduling_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_fk_0031`
SELECT
  'scheduling_rules.created_by.orphan_created_by',
  count(*)
FROM `scheduling_rules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_fk_0031`
SELECT
  'scheduling_rules.updated_by.orphan_updated_by',
  count(*)
FROM `scheduling_rules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`updated_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_fk_0031`
SELECT
  'scheduling_conflicts.restaurant_id.orphan_restaurant_id',
  count(*)
FROM `scheduling_conflicts`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_fk_0031`
SELECT
  'scheduling_conflicts.rule_id.orphan_rule_id',
  count(*)
FROM `scheduling_conflicts`
WHERE `rule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `scheduling_rules` WHERE `scheduling_rules`.`id` = `scheduling_conflicts`.`rule_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_fk_0031`
SELECT
  'scheduling_conflicts.resolved_by.orphan_resolved_by',
  count(*)
FROM `scheduling_conflicts`
WHERE `resolved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_conflicts`.`resolved_by`);
--> statement-breakpoint

DROP TABLE `_migration_assert_scheduling_rules_component_fk_0031`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_scheduling_rules_component_counts_0031`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_scheduling_rules_component_counts_0031` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `scheduling_conflicts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `scheduling_conflicts__component_rebuild_data` AS SELECT * FROM `scheduling_conflicts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_counts_0031`
SELECT
  'scheduling_conflicts.stage',
  (SELECT count(*) FROM `scheduling_conflicts`),
  (SELECT count(*) FROM `scheduling_conflicts__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `scheduling_rules__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `scheduling_rules__component_rebuild_data` AS SELECT * FROM `scheduling_rules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_counts_0031`
SELECT
  'scheduling_rules.stage',
  (SELECT count(*) FROM `scheduling_rules`),
  (SELECT count(*) FROM `scheduling_rules__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `scheduling_conflicts`;
--> statement-breakpoint

DROP TABLE `scheduling_rules`;
--> statement-breakpoint

CREATE TABLE "scheduling_rules" (
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
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `scheduling_rules` (
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
FROM `scheduling_rules__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_counts_0031`
SELECT
  'scheduling_rules.final',
  (SELECT count(*) FROM `scheduling_rules__component_rebuild_data`),
  (SELECT count(*) FROM `scheduling_rules`);
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

CREATE TABLE "scheduling_conflicts" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`conflict_type` text NOT NULL,
	`severity` text NOT NULL,
	`schedule_ids` text NOT NULL,
	`employee_ids` text NOT NULL,
	`rule_id` integer,
	`message` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'unresolved' NOT NULL,
	`resolved_by` integer,
	`resolved_at_ms` integer,
	`resolution_notes` text,
	`detected_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `scheduling_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `scheduling_conflicts` (
  `id`,
  `restaurant_id`,
  `conflict_type`,
  `severity`,
  `schedule_ids`,
  `employee_ids`,
  `rule_id`,
  `message`,
  `details`,
  `status`,
  `resolved_by`,
  `resolved_at_ms`,
  `resolution_notes`,
  `detected_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `conflict_type`,
  `severity`,
  `schedule_ids`,
  `employee_ids`,
  `rule_id`,
  `message`,
  `details`,
  `status`,
  `resolved_by`,
  `resolved_at_ms`,
  `resolution_notes`,
  `detected_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
FROM `scheduling_conflicts__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_scheduling_rules_component_counts_0031`
SELECT
  'scheduling_conflicts.final',
  (SELECT count(*) FROM `scheduling_conflicts__component_rebuild_data`),
  (SELECT count(*) FROM `scheduling_conflicts`);
--> statement-breakpoint

CREATE INDEX `idx_scheduling_conflicts_detected_at_ms` ON `scheduling_conflicts` (`detected_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_scheduling_conflicts_restaurant_status` ON `scheduling_conflicts` (`restaurant_id`,`status`);
--> statement-breakpoint

CREATE TRIGGER `scheduling_conflicts_restaurant_guard_bi`
BEFORE INSERT ON `scheduling_conflicts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_conflicts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `scheduling_conflicts_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `scheduling_conflicts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_conflicts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

DROP TABLE `scheduling_conflicts__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `scheduling_rules__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_scheduling_rules_component_counts_0031`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'scheduling_rules', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'scheduling_rules was rebuilt with a physical restaurant_id FK in 0031 using a D1-safe component rebuild.');
--> statement-breakpoint
