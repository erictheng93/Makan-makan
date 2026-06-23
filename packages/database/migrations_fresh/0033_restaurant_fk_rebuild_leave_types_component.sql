-- 0033 restaurant FK rebuild for leave types component.
-- Rebuilds leave_types with a physical nullable restaurant_id FK together
-- with its direct child tables. D1 keeps foreign_keys enabled, so this
-- migration uses no-FK staging tables and does not rely on PRAGMA
-- foreign_keys=OFF.

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
  'leave_types.restaurant_id must reference restaurants.id when present before component rebuild.'
FROM `leave_types`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'employee_leave_balances', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `employee_leave_balances`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_leave_balances`.`restaurant_id`)
     LIMIT 5
  )),
  'employee_leave_balances.restaurant_id must reference restaurants.id before component rebuild.'
FROM `employee_leave_balances`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_leave_balances`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'leave_approval_rules', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `leave_approval_rules`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`)
     LIMIT 5
  )),
  'leave_approval_rules.restaurant_id must reference restaurants.id before component rebuild.'
FROM `leave_approval_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'leave_requests', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `leave_requests`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`)
     LIMIT 5
  )),
  'leave_requests.restaurant_id must reference restaurants.id before component rebuild.'
FROM `leave_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_leave_types_component_fk_0033`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_leave_types_component_fk_0033` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_types.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_types`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_types.created_by.orphan_created_by', count(*)
FROM `leave_types`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_types`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_types.updated_by.orphan_updated_by', count(*)
FROM `leave_types`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_types`.`updated_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'employee_leave_balances.restaurant_id.orphan_restaurant_id', count(*)
FROM `employee_leave_balances`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_leave_balances`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'employee_leave_balances.employee_id.orphan_employee_id', count(*)
FROM `employee_leave_balances`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_leave_balances`.`employee_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'employee_leave_balances.leave_type_id.orphan_leave_type_id', count(*)
FROM `employee_leave_balances`
WHERE NOT EXISTS (SELECT 1 FROM `leave_types` WHERE `leave_types`.`id` = `employee_leave_balances`.`leave_type_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'employee_leave_balances.adjusted_by.orphan_adjusted_by', count(*)
FROM `employee_leave_balances`
WHERE `adjusted_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_leave_balances`.`adjusted_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'employee_leave_balances.last_updated_by.orphan_last_updated_by', count(*)
FROM `employee_leave_balances`
WHERE `last_updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_leave_balances`.`last_updated_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_approval_rules.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_approval_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_approval_rules.leave_type_id.orphan_leave_type_id', count(*)
FROM `leave_approval_rules`
WHERE `leave_type_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `leave_types` WHERE `leave_types`.`id` = `leave_approval_rules`.`leave_type_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_approval_rules.escalation_to_user_id.orphan_escalation_to_user_id', count(*)
FROM `leave_approval_rules`
WHERE `escalation_to_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_approval_rules`.`escalation_to_user_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_approval_rules.created_by.orphan_created_by', count(*)
FROM `leave_approval_rules`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_approval_rules`.`created_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_approval_rules.updated_by.orphan_updated_by', count(*)
FROM `leave_approval_rules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_approval_rules`.`updated_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_requests.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_requests.employee_id.orphan_employee_id', count(*)
FROM `leave_requests`
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`employee_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_requests.leave_type_id.orphan_leave_type_id', count(*)
FROM `leave_requests`
WHERE NOT EXISTS (SELECT 1 FROM `leave_types` WHERE `leave_types`.`id` = `leave_requests`.`leave_type_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_requests.final_approver_id.orphan_final_approver_id', count(*)
FROM `leave_requests`
WHERE `final_approver_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`final_approver_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_requests.rejected_by.orphan_rejected_by', count(*)
FROM `leave_requests`
WHERE `rejected_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`rejected_by`);
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_fk_0033`
SELECT 'leave_requests.cancelled_by.orphan_cancelled_by', count(*)
FROM `leave_requests`
WHERE `cancelled_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`cancelled_by`);
--> statement-breakpoint

DROP TABLE `_migration_assert_leave_types_component_fk_0033`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_leave_types_component_counts_0033`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_leave_types_component_counts_0033` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `employee_leave_balances__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `employee_leave_balances__component_rebuild_data` AS SELECT * FROM `employee_leave_balances`;
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_approval_rules__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_approval_rules__component_rebuild_data` AS SELECT * FROM `leave_approval_rules`;
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_requests__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_requests__component_rebuild_data` AS SELECT * FROM `leave_requests`;
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_types__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_types__component_rebuild_data` AS SELECT * FROM `leave_types`;
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_counts_0033`
SELECT 'employee_leave_balances.stage', (SELECT count(*) FROM `employee_leave_balances`), (SELECT count(*) FROM `employee_leave_balances__component_rebuild_data`)
UNION ALL
SELECT 'leave_approval_rules.stage', (SELECT count(*) FROM `leave_approval_rules`), (SELECT count(*) FROM `leave_approval_rules__component_rebuild_data`)
UNION ALL
SELECT 'leave_requests.stage', (SELECT count(*) FROM `leave_requests`), (SELECT count(*) FROM `leave_requests__component_rebuild_data`)
UNION ALL
SELECT 'leave_types.stage', (SELECT count(*) FROM `leave_types`), (SELECT count(*) FROM `leave_types__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `employee_leave_balances`;
--> statement-breakpoint

DROP TABLE `leave_approval_rules`;
--> statement-breakpoint

DROP TABLE `leave_requests`;
--> statement-breakpoint

DROP TABLE `leave_types`;
--> statement-breakpoint

CREATE TABLE "leave_types" (
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
	`created_by` TEXT,
	`updated_by` TEXT,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_types` (
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
FROM `leave_types__component_rebuild_data`;
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

CREATE TABLE "employee_leave_balances" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` TEXT NOT NULL,
	`leave_type_id` integer NOT NULL,
	`restaurant_id` text NOT NULL,
	`year` integer NOT NULL,
	`total_days` real DEFAULT 0 NOT NULL,
	`used_days` real DEFAULT 0 NOT NULL,
	`pending_days` real DEFAULT 0 NOT NULL,
	`carryover_from_previous` real DEFAULT 0,
	`carryover_to_next` real DEFAULT 0,
	`carryover_expires_at_ms` integer,
	`manual_adjustment` real DEFAULT 0,
	`adjustment_reason` text,
	`adjusted_by` TEXT,
	`adjusted_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`last_updated_by` TEXT,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjusted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `employee_leave_balances` (
  `id`,
  `employee_id`,
  `leave_type_id`,
  `restaurant_id`,
  `year`,
  `total_days`,
  `used_days`,
  `pending_days`,
  `carryover_from_previous`,
  `carryover_to_next`,
  `carryover_expires_at_ms`,
  `manual_adjustment`,
  `adjustment_reason`,
  `adjusted_by`,
  `adjusted_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `last_updated_by`
)
SELECT
  `id`,
  `employee_id`,
  `leave_type_id`,
  `restaurant_id`,
  `year`,
  `total_days`,
  `used_days`,
  `pending_days`,
  `carryover_from_previous`,
  `carryover_to_next`,
  `carryover_expires_at_ms`,
  `manual_adjustment`,
  `adjustment_reason`,
  `adjusted_by`,
  `adjusted_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `last_updated_by`
FROM `employee_leave_balances__component_rebuild_data`;
--> statement-breakpoint

CREATE INDEX `idx_employee_leave_balances_employee_year` ON `employee_leave_balances` (`employee_id`,`year`);
--> statement-breakpoint

CREATE INDEX `idx_employee_leave_balances_restaurant_year_type` ON `employee_leave_balances` (`restaurant_id`,`year`,`leave_type_id`);
--> statement-breakpoint

CREATE TRIGGER `employee_leave_balances_restaurant_guard_bi`
BEFORE INSERT ON `employee_leave_balances`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_leave_balances.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `employee_leave_balances_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_leave_balances`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_leave_balances.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "leave_approval_rules" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`leave_type_id` integer,
	`name` text NOT NULL,
	`description` text,
	`approval_level` integer NOT NULL,
	`approver_type` text NOT NULL,
	`approver_role_ids` text,
	`approver_user_ids` text,
	`enable_auto_approval` integer DEFAULT false NOT NULL,
	`auto_approval_conditions` text,
	`enable_auto_escalation` integer DEFAULT false NOT NULL,
	`escalation_timeout_hours` integer,
	`escalation_to_user_id` TEXT,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` TEXT NOT NULL,
	`updated_by` TEXT,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`escalation_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_approval_rules` (
  `id`,
  `restaurant_id`,
  `leave_type_id`,
  `name`,
  `description`,
  `approval_level`,
  `approver_type`,
  `approver_role_ids`,
  `approver_user_ids`,
  `enable_auto_approval`,
  `auto_approval_conditions`,
  `enable_auto_escalation`,
  `escalation_timeout_hours`,
  `escalation_to_user_id`,
  `priority`,
  `is_active`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `updated_by`
)
SELECT
  `id`,
  `restaurant_id`,
  `leave_type_id`,
  `name`,
  `description`,
  `approval_level`,
  `approver_type`,
  `approver_role_ids`,
  `approver_user_ids`,
  `enable_auto_approval`,
  `auto_approval_conditions`,
  `enable_auto_escalation`,
  `escalation_timeout_hours`,
  `escalation_to_user_id`,
  `priority`,
  `is_active`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `updated_by`
FROM `leave_approval_rules__component_rebuild_data`;
--> statement-breakpoint

CREATE INDEX `idx_leave_approval_rules_level_active` ON `leave_approval_rules` (`approval_level`,`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_leave_approval_rules_restaurant_type` ON `leave_approval_rules` (`restaurant_id`,`leave_type_id`);
--> statement-breakpoint

CREATE TRIGGER `leave_approval_rules_restaurant_guard_bi`
BEFORE INSERT ON `leave_approval_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_approval_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `leave_approval_rules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_approval_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_approval_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "leave_requests" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` TEXT NOT NULL,
	`leave_type_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_period` text DEFAULT 'full' NOT NULL,
	`end_period` text DEFAULT 'full' NOT NULL,
	`total_days` real NOT NULL,
	`reason` text NOT NULL,
	`attachment_url` text,
	`emergency_contact` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`approval_chain` text NOT NULL,
	`current_approval_level` integer DEFAULT 0 NOT NULL,
	`final_approver_id` TEXT,
	`final_approved_at_ms` integer,
	`rejected_by` TEXT,
	`rejected_at_ms` integer,
	`rejection_reason` text,
	`cancelled_by` TEXT,
	`cancelled_at_ms` integer,
	`cancellation_reason` text,
	`affected_schedule_ids` text,
	`replacement_notified` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`submitted_at_ms` integer,
	`deleted_at_ms` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`final_approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_requests` (
  `id`,
  `restaurant_id`,
  `employee_id`,
  `leave_type_id`,
  `start_date`,
  `end_date`,
  `start_period`,
  `end_period`,
  `total_days`,
  `reason`,
  `attachment_url`,
  `emergency_contact`,
  `status`,
  `approval_chain`,
  `current_approval_level`,
  `final_approver_id`,
  `final_approved_at_ms`,
  `rejected_by`,
  `rejected_at_ms`,
  `rejection_reason`,
  `cancelled_by`,
  `cancelled_at_ms`,
  `cancellation_reason`,
  `affected_schedule_ids`,
  `replacement_notified`,
  `created_at_ms`,
  `updated_at_ms`,
  `submitted_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `employee_id`,
  `leave_type_id`,
  `start_date`,
  `end_date`,
  `start_period`,
  `end_period`,
  `total_days`,
  `reason`,
  `attachment_url`,
  `emergency_contact`,
  `status`,
  `approval_chain`,
  `current_approval_level`,
  `final_approver_id`,
  `final_approved_at_ms`,
  `rejected_by`,
  `rejected_at_ms`,
  `rejection_reason`,
  `cancelled_by`,
  `cancelled_at_ms`,
  `cancellation_reason`,
  `affected_schedule_ids`,
  `replacement_notified`,
  `created_at_ms`,
  `updated_at_ms`,
  `submitted_at_ms`,
  `deleted_at_ms`
FROM `leave_requests__component_rebuild_data`;
--> statement-breakpoint

CREATE INDEX `idx_leave_requests_employee_date` ON `leave_requests` (`employee_id`,`start_date`);
--> statement-breakpoint

CREATE INDEX `idx_leave_requests_restaurant_status` ON `leave_requests` (`restaurant_id`,`status`);
--> statement-breakpoint

CREATE INDEX `idx_leave_requests_status_date` ON `leave_requests` (`status`,`start_date`);
--> statement-breakpoint

CREATE TRIGGER `leave_requests_restaurant_guard_bi`
BEFORE INSERT ON `leave_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `leave_requests_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT INTO `_migration_assert_leave_types_component_counts_0033`
SELECT 'leave_types.final', (SELECT count(*) FROM `leave_types__component_rebuild_data`), (SELECT count(*) FROM `leave_types`)
UNION ALL
SELECT 'employee_leave_balances.final', (SELECT count(*) FROM `employee_leave_balances__component_rebuild_data`), (SELECT count(*) FROM `employee_leave_balances`)
UNION ALL
SELECT 'leave_approval_rules.final', (SELECT count(*) FROM `leave_approval_rules__component_rebuild_data`), (SELECT count(*) FROM `leave_approval_rules`)
UNION ALL
SELECT 'leave_requests.final', (SELECT count(*) FROM `leave_requests__component_rebuild_data`), (SELECT count(*) FROM `leave_requests`);
--> statement-breakpoint

DROP TABLE `employee_leave_balances__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_approval_rules__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_requests__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_types__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_leave_types_component_counts_0033`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'leave_types', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'leave_types was rebuilt with a physical nullable restaurant_id FK in 0033 using a D1-safe component rebuild.');
--> statement-breakpoint
