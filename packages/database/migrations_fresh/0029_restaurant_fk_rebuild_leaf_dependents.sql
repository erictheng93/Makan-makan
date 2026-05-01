-- 0029 restaurant fk rebuild leaf dependents.
-- Adds physical restaurant_id foreign keys through SQLite/D1-safe leaf table rebuilds.
-- Tables with inbound foreign keys are intentionally deferred to component rebuild migrations.
-- Existing orphan rows are audited and asserted before any table swap.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'backup_alerts', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `backup_alerts`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_alerts`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 backup_alerts physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `backup_alerts`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_alerts`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'backup_audit_logs', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `backup_audit_logs`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_audit_logs`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 backup_audit_logs physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `backup_audit_logs`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_audit_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'backup_configurations', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `backup_configurations`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_configurations`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 backup_configurations physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `backup_configurations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_configurations`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'backup_records', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `backup_records`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_records`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 backup_records physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `backup_records`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_records`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'backup_schedules', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `backup_schedules`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_schedules`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 backup_schedules physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `backup_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'restore_operations', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `restore_operations`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `restore_operations`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 restore_operations physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `restore_operations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `restore_operations`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'employee_availability', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `employee_availability`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_availability`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 employee_availability physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `employee_availability`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_availability`.`restaurant_id`);
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
  'Preflight for 0029 employee_leave_balances physical restaurant_id FK rebuild; must be zero before rebuilding.'
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
  'Preflight for 0029 leave_approval_rules physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `leave_approval_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'leave_calendar_events', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `leave_calendar_events`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_calendar_events`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 leave_calendar_events physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `leave_calendar_events`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_calendar_events`.`restaurant_id`);
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
  'Preflight for 0029 leave_requests physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `leave_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`);
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
  'Preflight for 0029 schedule_swap_requests physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`);
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
  'Preflight for 0029 scheduling_conflicts physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `scheduling_conflicts`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`);
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
  'Preflight for 0029 partnership_usage_logs physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'reservation_slots', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `reservation_slots`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservation_slots`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 reservation_slots physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `reservation_slots`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservation_slots`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'reservations', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `reservations`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0029 reservations physical restaurant_id FK rebuild; must be zero before rebuilding.'
FROM `reservations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_restaurant_fk_0029`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_restaurant_fk_0029` (
  `table_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'backup_alerts',
  count(*)
FROM `backup_alerts`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_alerts`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'backup_audit_logs',
  count(*)
FROM `backup_audit_logs`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_audit_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'backup_configurations',
  count(*)
FROM `backup_configurations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_configurations`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'backup_records',
  count(*)
FROM `backup_records`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_records`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'backup_schedules',
  count(*)
FROM `backup_schedules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `backup_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'restore_operations',
  count(*)
FROM `restore_operations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `restore_operations`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'employee_availability',
  count(*)
FROM `employee_availability`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_availability`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'employee_leave_balances',
  count(*)
FROM `employee_leave_balances`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_leave_balances`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'leave_approval_rules',
  count(*)
FROM `leave_approval_rules`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'leave_calendar_events',
  count(*)
FROM `leave_calendar_events`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_calendar_events`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'leave_requests',
  count(*)
FROM `leave_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'schedule_swap_requests',
  count(*)
FROM `schedule_swap_requests`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'scheduling_conflicts',
  count(*)
FROM `scheduling_conflicts`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'partnership_usage_logs',
  count(*)
FROM `partnership_usage_logs`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'reservation_slots',
  count(*)
FROM `reservation_slots`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservation_slots`.`restaurant_id`);
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_0029`
SELECT
  'reservations',
  count(*)
FROM `reservations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_restaurant_fk_0029`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_restaurant_fk_counts_0029`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_restaurant_fk_counts_0029` (
  `table_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `rebuilt_count` integer NOT NULL,
  CHECK (`source_count` = `rebuilt_count`)
);
--> statement-breakpoint

-- Rebuild backup_alerts.
DROP TABLE IF EXISTS `backup_alerts__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `backup_alerts__restaurant_fk_rebuild` (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    message TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    acknowledged INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0,
    triggered_at TEXT,
    resolved_at TEXT,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `backup_alerts__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `alert_type`,
  `severity`,
  `message`,
  `details`,
  `acknowledged`,
  `resolved`,
  `triggered_at`,
  `resolved_at`
)
SELECT
  `id`,
  `restaurant_id`,
  `alert_type`,
  `severity`,
  `message`,
  `details`,
  `acknowledged`,
  `resolved`,
  `triggered_at`,
  `resolved_at`
FROM `backup_alerts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'backup_alerts',
  (SELECT count(*) FROM `backup_alerts`),
  (SELECT count(*) FROM `backup_alerts__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `backup_alerts`;
--> statement-breakpoint

ALTER TABLE `backup_alerts__restaurant_fk_rebuild` RENAME TO `backup_alerts`;
--> statement-breakpoint

CREATE INDEX idx_backup_alerts_resolved ON backup_alerts(restaurant_id, resolved);
--> statement-breakpoint

CREATE INDEX idx_backup_alerts_restaurant ON backup_alerts(restaurant_id);
--> statement-breakpoint

CREATE INDEX idx_backup_alerts_triggered_at ON backup_alerts(triggered_at);
--> statement-breakpoint

CREATE TRIGGER `backup_alerts_restaurant_guard_bi`
BEFORE INSERT ON `backup_alerts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `backup_alerts_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_alerts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'backup_alerts', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'backup_alerts was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild backup_audit_logs.
DROP TABLE IF EXISTS `backup_audit_logs__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `backup_audit_logs__restaurant_fk_rebuild` (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    performed_by TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TEXT,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `backup_audit_logs__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `action`,
  `details`,
  `performed_by`,
  `ip_address`,
  `user_agent`,
  `timestamp`
)
SELECT
  `id`,
  `restaurant_id`,
  `action`,
  `details`,
  `performed_by`,
  `ip_address`,
  `user_agent`,
  `timestamp`
FROM `backup_audit_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'backup_audit_logs',
  (SELECT count(*) FROM `backup_audit_logs`),
  (SELECT count(*) FROM `backup_audit_logs__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `backup_audit_logs`;
--> statement-breakpoint

ALTER TABLE `backup_audit_logs__restaurant_fk_rebuild` RENAME TO `backup_audit_logs`;
--> statement-breakpoint

CREATE INDEX idx_backup_audit_logs_action ON backup_audit_logs(action);
--> statement-breakpoint

CREATE INDEX idx_backup_audit_logs_restaurant ON backup_audit_logs(restaurant_id);
--> statement-breakpoint

CREATE INDEX idx_backup_audit_logs_timestamp ON backup_audit_logs(timestamp);
--> statement-breakpoint

CREATE TRIGGER `backup_audit_logs_restaurant_guard_bi`
BEFORE INSERT ON `backup_audit_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `backup_audit_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_audit_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'backup_audit_logs', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'backup_audit_logs was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild backup_configurations.
DROP TABLE IF EXISTS `backup_configurations__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `backup_configurations__restaurant_fk_rebuild` (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    backup_type TEXT NOT NULL DEFAULT 'full',
    schedule_enabled INTEGER NOT NULL DEFAULT 0,
    schedule_cron TEXT,
    retention_days INTEGER NOT NULL DEFAULT 30,
    include_tables TEXT DEFAULT '[]',
    exclude_tables TEXT DEFAULT '[]',
    compression_enabled INTEGER NOT NULL DEFAULT 1,
    encryption_enabled INTEGER NOT NULL DEFAULT 0,
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    max_parallel_backups INTEGER NOT NULL DEFAULT 1,
    notifications_enabled INTEGER NOT NULL DEFAULT 0,
    notification_channels TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `backup_configurations__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `backup_type`,
  `schedule_enabled`,
  `schedule_cron`,
  `retention_days`,
  `include_tables`,
  `exclude_tables`,
  `compression_enabled`,
  `encryption_enabled`,
  `storage_provider`,
  `max_parallel_backups`,
  `notifications_enabled`,
  `notification_channels`,
  `created_by`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `backup_type`,
  `schedule_enabled`,
  `schedule_cron`,
  `retention_days`,
  `include_tables`,
  `exclude_tables`,
  `compression_enabled`,
  `encryption_enabled`,
  `storage_provider`,
  `max_parallel_backups`,
  `notifications_enabled`,
  `notification_channels`,
  `created_by`,
  `created_at`,
  `updated_at`
FROM `backup_configurations`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'backup_configurations',
  (SELECT count(*) FROM `backup_configurations`),
  (SELECT count(*) FROM `backup_configurations__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `backup_configurations`;
--> statement-breakpoint

ALTER TABLE `backup_configurations__restaurant_fk_rebuild` RENAME TO `backup_configurations`;
--> statement-breakpoint

CREATE INDEX idx_backup_configurations_restaurant ON backup_configurations(restaurant_id);
--> statement-breakpoint

CREATE INDEX idx_backup_configurations_schedule ON backup_configurations(schedule_enabled);
--> statement-breakpoint

CREATE TRIGGER `backup_configurations_restaurant_guard_bi`
BEFORE INSERT ON `backup_configurations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_configurations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `backup_configurations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_configurations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_configurations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'backup_configurations', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'backup_configurations was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild backup_records.
DROP TABLE IF EXISTS `backup_records__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `backup_records__restaurant_fk_rebuild` (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    configuration_id TEXT,
    name TEXT NOT NULL,
    backup_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_size INTEGER NOT NULL DEFAULT 0,
    compressed_size INTEGER NOT NULL DEFAULT 0,
    records_count INTEGER NOT NULL DEFAULT 0,
    tables_included TEXT NOT NULL DEFAULT '[]',
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_path TEXT NOT NULL DEFAULT '',
    encryption_enabled INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    created_by TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    updated_at TEXT,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `backup_records__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `configuration_id`,
  `name`,
  `backup_type`,
  `status`,
  `file_size`,
  `compressed_size`,
  `records_count`,
  `tables_included`,
  `storage_provider`,
  `storage_path`,
  `encryption_enabled`,
  `checksum`,
  `started_at`,
  `completed_at`,
  `error_message`,
  `created_by`,
  `metadata`,
  `updated_at`
)
SELECT
  `id`,
  `restaurant_id`,
  `configuration_id`,
  `name`,
  `backup_type`,
  `status`,
  `file_size`,
  `compressed_size`,
  `records_count`,
  `tables_included`,
  `storage_provider`,
  `storage_path`,
  `encryption_enabled`,
  `checksum`,
  `started_at`,
  `completed_at`,
  `error_message`,
  `created_by`,
  `metadata`,
  `updated_at`
FROM `backup_records`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'backup_records',
  (SELECT count(*) FROM `backup_records`),
  (SELECT count(*) FROM `backup_records__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `backup_records`;
--> statement-breakpoint

ALTER TABLE `backup_records__restaurant_fk_rebuild` RENAME TO `backup_records`;
--> statement-breakpoint

CREATE INDEX idx_backup_records_config ON backup_records(configuration_id);
--> statement-breakpoint

CREATE INDEX idx_backup_records_restaurant ON backup_records(restaurant_id);
--> statement-breakpoint

CREATE INDEX idx_backup_records_started_at ON backup_records(started_at);
--> statement-breakpoint

CREATE INDEX idx_backup_records_status ON backup_records(restaurant_id, status);
--> statement-breakpoint

CREATE TRIGGER `backup_records_restaurant_guard_bi`
BEFORE INSERT ON `backup_records`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_records.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `backup_records_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_records`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_records.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'backup_records', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'backup_records was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild backup_schedules.
DROP TABLE IF EXISTS `backup_schedules__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `backup_schedules__restaurant_fk_rebuild` (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `backup_schedules__restaurant_fk_rebuild` (
  `id`,
  `configuration_id`,
  `restaurant_id`,
  `cron_expression`,
  `enabled`,
  `last_run_at`,
  `next_run_at`,
  `consecutive_failures`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `configuration_id`,
  `restaurant_id`,
  `cron_expression`,
  `enabled`,
  `last_run_at`,
  `next_run_at`,
  `consecutive_failures`,
  `created_at`,
  `updated_at`
FROM `backup_schedules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'backup_schedules',
  (SELECT count(*) FROM `backup_schedules`),
  (SELECT count(*) FROM `backup_schedules__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `backup_schedules`;
--> statement-breakpoint

ALTER TABLE `backup_schedules__restaurant_fk_rebuild` RENAME TO `backup_schedules`;
--> statement-breakpoint

CREATE INDEX idx_backup_schedules_config ON backup_schedules(configuration_id);
--> statement-breakpoint

CREATE INDEX idx_backup_schedules_enabled ON backup_schedules(enabled);
--> statement-breakpoint

CREATE INDEX idx_backup_schedules_restaurant ON backup_schedules(restaurant_id);
--> statement-breakpoint

CREATE TRIGGER `backup_schedules_restaurant_guard_bi`
BEFORE INSERT ON `backup_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `backup_schedules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'backup_schedules', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'backup_schedules was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild restore_operations.
DROP TABLE IF EXISTS `restore_operations__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `restore_operations__restaurant_fk_rebuild` (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    backup_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    restore_type TEXT NOT NULL,
    target_tables TEXT DEFAULT '[]',
    overwrite_existing INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    tables_restored INTEGER NOT NULL DEFAULT 0,
    records_restored INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    performed_by TEXT NOT NULL,
    safety_checks TEXT DEFAULT '{}',
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `restore_operations__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `backup_id`,
  `status`,
  `restore_type`,
  `target_tables`,
  `overwrite_existing`,
  `started_at`,
  `completed_at`,
  `tables_restored`,
  `records_restored`,
  `error_message`,
  `performed_by`,
  `safety_checks`
)
SELECT
  `id`,
  `restaurant_id`,
  `backup_id`,
  `status`,
  `restore_type`,
  `target_tables`,
  `overwrite_existing`,
  `started_at`,
  `completed_at`,
  `tables_restored`,
  `records_restored`,
  `error_message`,
  `performed_by`,
  `safety_checks`
FROM `restore_operations`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'restore_operations',
  (SELECT count(*) FROM `restore_operations`),
  (SELECT count(*) FROM `restore_operations__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `restore_operations`;
--> statement-breakpoint

ALTER TABLE `restore_operations__restaurant_fk_rebuild` RENAME TO `restore_operations`;
--> statement-breakpoint

CREATE INDEX idx_restore_operations_backup ON restore_operations(backup_id);
--> statement-breakpoint

CREATE INDEX idx_restore_operations_restaurant ON restore_operations(restaurant_id);
--> statement-breakpoint

CREATE INDEX idx_restore_operations_status ON restore_operations(status);
--> statement-breakpoint

CREATE TRIGGER `restore_operations_restaurant_guard_bi`
BEFORE INSERT ON `restore_operations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'restore_operations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `restore_operations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `restore_operations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'restore_operations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'restore_operations', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'restore_operations was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild employee_availability.
DROP TABLE IF EXISTS `employee_availability__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `employee_availability__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` integer NOT NULL,
	`availability_type` text NOT NULL,
	`day_of_week` integer,
	`start_time` text,
	`end_time` text,
	`start_date` text,
	`end_date` text,
	`preference_type` text NOT NULL,
	`priority` integer DEFAULT 0,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `employee_availability__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `employee_id`,
  `availability_type`,
  `day_of_week`,
  `start_time`,
  `end_time`,
  `start_date`,
  `end_date`,
  `preference_type`,
  `priority`,
  `notes`,
  `is_active`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `employee_id`,
  `availability_type`,
  `day_of_week`,
  `start_time`,
  `end_time`,
  `start_date`,
  `end_date`,
  `preference_type`,
  `priority`,
  `notes`,
  `is_active`,
  `created_at_ms`,
  `updated_at_ms`
FROM `employee_availability`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'employee_availability',
  (SELECT count(*) FROM `employee_availability`),
  (SELECT count(*) FROM `employee_availability__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `employee_availability`;
--> statement-breakpoint

ALTER TABLE `employee_availability__restaurant_fk_rebuild` RENAME TO `employee_availability`;
--> statement-breakpoint

CREATE INDEX `idx_employee_availability_day_preference` ON `employee_availability` (`day_of_week`,`preference_type`);
--> statement-breakpoint

CREATE INDEX `idx_employee_availability_restaurant_employee` ON `employee_availability` (`restaurant_id`,`employee_id`);
--> statement-breakpoint

CREATE TRIGGER `employee_availability_restaurant_guard_bi`
BEFORE INSERT ON `employee_availability`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_availability.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `employee_availability_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_availability`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_availability.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'employee_availability', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'employee_availability was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild employee_leave_balances.
DROP TABLE IF EXISTS `employee_leave_balances__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `employee_leave_balances__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
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
	`adjusted_by` integer,
	`adjusted_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`last_updated_by` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjusted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `employee_leave_balances__restaurant_fk_rebuild` (
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
FROM `employee_leave_balances`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'employee_leave_balances',
  (SELECT count(*) FROM `employee_leave_balances`),
  (SELECT count(*) FROM `employee_leave_balances__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `employee_leave_balances`;
--> statement-breakpoint

ALTER TABLE `employee_leave_balances__restaurant_fk_rebuild` RENAME TO `employee_leave_balances`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'employee_leave_balances', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'employee_leave_balances was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild leave_approval_rules.
DROP TABLE IF EXISTS `leave_approval_rules__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `leave_approval_rules__restaurant_fk_rebuild` (
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
	`escalation_to_user_id` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`escalation_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_approval_rules__restaurant_fk_rebuild` (
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
FROM `leave_approval_rules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'leave_approval_rules',
  (SELECT count(*) FROM `leave_approval_rules`),
  (SELECT count(*) FROM `leave_approval_rules__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `leave_approval_rules`;
--> statement-breakpoint

ALTER TABLE `leave_approval_rules__restaurant_fk_rebuild` RENAME TO `leave_approval_rules`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'leave_approval_rules', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'leave_approval_rules was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild leave_calendar_events.
DROP TABLE IF EXISTS `leave_calendar_events__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `leave_calendar_events__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`name` text NOT NULL,
	`description` text,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurrence_pattern` text,
	`is_working_day` integer DEFAULT false NOT NULL,
	`compensatory_for` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` integer,
	`color` text,
	`icon` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_calendar_events__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `event_type`,
  `event_date`,
  `is_recurring`,
  `recurrence_pattern`,
  `is_working_day`,
  `compensatory_for`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `color`,
  `icon`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `event_type`,
  `event_date`,
  `is_recurring`,
  `recurrence_pattern`,
  `is_working_day`,
  `compensatory_for`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `color`,
  `icon`
FROM `leave_calendar_events`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'leave_calendar_events',
  (SELECT count(*) FROM `leave_calendar_events`),
  (SELECT count(*) FROM `leave_calendar_events__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `leave_calendar_events`;
--> statement-breakpoint

ALTER TABLE `leave_calendar_events__restaurant_fk_rebuild` RENAME TO `leave_calendar_events`;
--> statement-breakpoint

CREATE INDEX `idx_leave_calendar_events_restaurant_date` ON `leave_calendar_events` (`restaurant_id`,`event_date`);
--> statement-breakpoint

CREATE INDEX `idx_leave_calendar_events_type` ON `leave_calendar_events` (`event_type`);
--> statement-breakpoint

CREATE TRIGGER `leave_calendar_events_restaurant_guard_bi`
BEFORE INSERT ON `leave_calendar_events`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_calendar_events.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `leave_calendar_events_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_calendar_events`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_calendar_events.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'leave_calendar_events', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'leave_calendar_events was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild leave_requests.
DROP TABLE IF EXISTS `leave_requests__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `leave_requests__restaurant_fk_rebuild` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` integer NOT NULL,
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
	`final_approver_id` integer,
	`final_approved_at_ms` integer,
	`rejected_by` integer,
	`rejected_at_ms` integer,
	`rejection_reason` text,
	`cancelled_by` integer,
	`cancelled_at_ms` integer,
	`cancellation_reason` text,
	`affected_schedule_ids` text,
	`replacement_notified` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`submitted_at_ms` integer, deleted_at_ms INTEGER,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`final_approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_requests__restaurant_fk_rebuild` (
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
FROM `leave_requests`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'leave_requests',
  (SELECT count(*) FROM `leave_requests`),
  (SELECT count(*) FROM `leave_requests__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `leave_requests`;
--> statement-breakpoint

ALTER TABLE `leave_requests__restaurant_fk_rebuild` RENAME TO `leave_requests`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'leave_requests', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'leave_requests was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild schedule_swap_requests.
DROP TABLE IF EXISTS `schedule_swap_requests__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `schedule_swap_requests__restaurant_fk_rebuild` (
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

INSERT INTO `schedule_swap_requests__restaurant_fk_rebuild` (
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
FROM `schedule_swap_requests`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'schedule_swap_requests',
  (SELECT count(*) FROM `schedule_swap_requests`),
  (SELECT count(*) FROM `schedule_swap_requests__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `schedule_swap_requests`;
--> statement-breakpoint

ALTER TABLE `schedule_swap_requests__restaurant_fk_rebuild` RENAME TO `schedule_swap_requests`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'schedule_swap_requests', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'schedule_swap_requests was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild scheduling_conflicts.
DROP TABLE IF EXISTS `scheduling_conflicts__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `scheduling_conflicts__restaurant_fk_rebuild` (
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

INSERT INTO `scheduling_conflicts__restaurant_fk_rebuild` (
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
FROM `scheduling_conflicts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'scheduling_conflicts',
  (SELECT count(*) FROM `scheduling_conflicts`),
  (SELECT count(*) FROM `scheduling_conflicts__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `scheduling_conflicts`;
--> statement-breakpoint

ALTER TABLE `scheduling_conflicts__restaurant_fk_rebuild` RENAME TO `scheduling_conflicts`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'scheduling_conflicts', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'scheduling_conflicts was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild partnership_usage_logs.
DROP TABLE IF EXISTS `partnership_usage_logs__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `partnership_usage_logs__restaurant_fk_rebuild` (
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
	"created_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL, `discount_value_cents` integer, `discount_amount_cents` integer, `original_amount_cents` integer, `final_amount_cents` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `partnership_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `verified_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `partnership_usage_logs__restaurant_fk_rebuild` (
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
FROM `partnership_usage_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'partnership_usage_logs',
  (SELECT count(*) FROM `partnership_usage_logs`),
  (SELECT count(*) FROM `partnership_usage_logs__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `partnership_usage_logs`;
--> statement-breakpoint

ALTER TABLE `partnership_usage_logs__restaurant_fk_rebuild` RENAME TO `partnership_usage_logs`;
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

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'partnership_usage_logs', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'partnership_usage_logs was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild reservation_slots.
DROP TABLE IF EXISTS `reservation_slots__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `reservation_slots__restaurant_fk_rebuild` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`date` text NOT NULL,
	`time_slot` text NOT NULL,
	`max_capacity` integer NOT NULL,
	`max_tables` integer NOT NULL,
	`current_reservations` integer NOT NULL DEFAULT 0,
	`current_capacity` integer NOT NULL DEFAULT 0,
	`is_available` integer NOT NULL DEFAULT 1,
	`block_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `reservation_slots__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `date`,
  `time_slot`,
  `max_capacity`,
  `max_tables`,
  `current_reservations`,
  `current_capacity`,
  `is_available`,
  `block_reason`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `restaurant_id`,
  `date`,
  `time_slot`,
  `max_capacity`,
  `max_tables`,
  `current_reservations`,
  `current_capacity`,
  `is_available`,
  `block_reason`,
  `created_at`,
  `updated_at`
FROM `reservation_slots`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'reservation_slots',
  (SELECT count(*) FROM `reservation_slots`),
  (SELECT count(*) FROM `reservation_slots__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `reservation_slots`;
--> statement-breakpoint

ALTER TABLE `reservation_slots__restaurant_fk_rebuild` RENAME TO `reservation_slots`;
--> statement-breakpoint

CREATE INDEX `slots_restaurant_date_avail_idx` ON `reservation_slots` (`restaurant_id`, `date`, `is_available`);
--> statement-breakpoint

CREATE UNIQUE INDEX `slots_restaurant_date_slot_idx` ON `reservation_slots` (`restaurant_id`, `date`, `time_slot`);
--> statement-breakpoint

CREATE TRIGGER `reservation_slots_restaurant_guard_bi`
BEFORE INSERT ON `reservation_slots`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservation_slots.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `reservation_slots_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `reservation_slots`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservation_slots.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'reservation_slots', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'reservation_slots was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

-- Rebuild reservations.
DROP TABLE IF EXISTS `reservations__restaurant_fk_rebuild`;
--> statement-breakpoint

CREATE TABLE `reservations__restaurant_fk_rebuild` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`customer_id` integer,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_email` text,
	`party_size` integer NOT NULL,
	`reservation_date` text NOT NULL,
	`reservation_time` text NOT NULL,
	`duration_minutes` integer NOT NULL DEFAULT 90,
	`table_id` integer,
	`special_requests` text,
	`status` text NOT NULL DEFAULT 'pending',
	`confirmation_code` text NOT NULL,
	`notes` text,
	`confirmed_at` integer,
	`reminded_at` integer,
	`arrived_at` integer,
	`seated_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	`no_show_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `reservations__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `customer_id`,
  `customer_name`,
  `customer_phone`,
  `customer_email`,
  `party_size`,
  `reservation_date`,
  `reservation_time`,
  `duration_minutes`,
  `table_id`,
  `special_requests`,
  `status`,
  `confirmation_code`,
  `notes`,
  `confirmed_at`,
  `reminded_at`,
  `arrived_at`,
  `seated_at`,
  `completed_at`,
  `cancelled_at`,
  `no_show_at`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `restaurant_id`,
  `customer_id`,
  `customer_name`,
  `customer_phone`,
  `customer_email`,
  `party_size`,
  `reservation_date`,
  `reservation_time`,
  `duration_minutes`,
  `table_id`,
  `special_requests`,
  `status`,
  `confirmation_code`,
  `notes`,
  `confirmed_at`,
  `reminded_at`,
  `arrived_at`,
  `seated_at`,
  `completed_at`,
  `cancelled_at`,
  `no_show_at`,
  `created_at`,
  `updated_at`
FROM `reservations`;
--> statement-breakpoint

INSERT INTO `_migration_assert_restaurant_fk_counts_0029`
SELECT
  'reservations',
  (SELECT count(*) FROM `reservations`),
  (SELECT count(*) FROM `reservations__restaurant_fk_rebuild`);
--> statement-breakpoint

DROP TABLE `reservations`;
--> statement-breakpoint

ALTER TABLE `reservations__restaurant_fk_rebuild` RENAME TO `reservations`;
--> statement-breakpoint

CREATE UNIQUE INDEX `reservations_confirmation_code_idx` ON `reservations` (`confirmation_code`);
--> statement-breakpoint

CREATE INDEX `reservations_customer_phone_idx` ON `reservations` (`customer_phone`);
--> statement-breakpoint

CREATE INDEX `reservations_restaurant_date_time_idx` ON `reservations` (`restaurant_id`, `reservation_date`, `reservation_time`);
--> statement-breakpoint

CREATE INDEX `reservations_restaurant_status_date_idx` ON `reservations` (`restaurant_id`, `status`, `reservation_date`);
--> statement-breakpoint

CREATE INDEX `reservations_table_idx` ON `reservations` (`table_id`);
--> statement-breakpoint

CREATE TRIGGER `reservations_restaurant_guard_bi`
BEFORE INSERT ON `reservations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `reservations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `reservations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'reservations', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'reservations was rebuilt with a physical restaurant_id FK in 0029.');
--> statement-breakpoint

DROP TABLE `_migration_assert_restaurant_fk_counts_0029`;
--> statement-breakpoint
