-- Rebuild waiting_list with a physical restaurant_id FK.
--
-- Previous migrations added orphan audits and trigger guards. This migration
-- performs the table rebuild for the active waiting-list surface only, after
-- asserting that existing restaurant/table/customer references are clean.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'waiting_list', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `waiting_list`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`)
     LIMIT 5
  )),
  'Preflight for 0026 waiting_list physical FK rebuild; must be zero before rebuilding.'
FROM `waiting_list`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'waiting_list', 'table_id', 'orphan_table_id', 'error',
  count(*),
  (SELECT group_concat(`table_id`, ',') FROM (
    SELECT DISTINCT `table_id`
      FROM `waiting_list`
     WHERE `table_id` IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `waiting_list`.`table_id`)
     LIMIT 5
  )),
  'Preflight for 0026 waiting_list physical FK rebuild; must be zero before rebuilding.'
FROM `waiting_list`
WHERE `table_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `waiting_list`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'referential_integrity', 'waiting_list', 'customer_id', 'orphan_customer_id', 'error',
  count(*),
  (SELECT group_concat(`customer_id`, ',') FROM (
    SELECT DISTINCT `customer_id`
      FROM `waiting_list`
     WHERE `customer_id` IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `waiting_list`.`customer_id`)
     LIMIT 5
  )),
  'Preflight for 0026 waiting_list physical FK rebuild; must be zero before rebuilding.'
FROM `waiting_list`
WHERE `customer_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `waiting_list`.`customer_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_waiting_list_fk_0026`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_waiting_list_fk_0026` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint
INSERT INTO `_migration_assert_waiting_list_fk_0026`
SELECT
  'restaurant_id',
  count(*)
FROM `waiting_list`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`);
--> statement-breakpoint
INSERT INTO `_migration_assert_waiting_list_fk_0026`
SELECT
  'table_id',
  count(*)
FROM `waiting_list`
WHERE `table_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `waiting_list`.`table_id`);
--> statement-breakpoint
INSERT INTO `_migration_assert_waiting_list_fk_0026`
SELECT
  'customer_id',
  count(*)
FROM `waiting_list`
WHERE `customer_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `waiting_list`.`customer_id`);
--> statement-breakpoint
DROP TABLE `_migration_assert_waiting_list_fk_0026`;
--> statement-breakpoint

DROP TABLE IF EXISTS `waiting_list__restaurant_fk_rebuild`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `waiting_list_restaurant_guard_bi`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `waiting_list_restaurant_guard_bu`;
--> statement-breakpoint

CREATE TABLE `waiting_list__restaurant_fk_rebuild` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL,
  `customer_id` integer,
  `customer_name` text NOT NULL,
  `customer_phone` text NOT NULL,
  `party_size` integer NOT NULL,
  `preferred_table_type` text,
  `queue_number` integer NOT NULL,
  `queue_letter` text,
  `queue_date` text,
  `priority` integer NOT NULL DEFAULT 0,
  `estimated_wait_minutes` integer,
  `table_id` integer,
  `status` text NOT NULL DEFAULT 'waiting',
  `notes` text,
  `called_at` integer,
  `notified_at` integer,
  `confirmed_at` integer,
  `seated_at` integer,
  `cancelled_at` integer,
  `expired_at` integer,
  `timeout_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `waiting_list__restaurant_fk_rebuild` (
  `id`,
  `restaurant_id`,
  `customer_id`,
  `customer_name`,
  `customer_phone`,
  `party_size`,
  `preferred_table_type`,
  `queue_number`,
  `queue_letter`,
  `queue_date`,
  `priority`,
  `estimated_wait_minutes`,
  `table_id`,
  `status`,
  `notes`,
  `called_at`,
  `notified_at`,
  `confirmed_at`,
  `seated_at`,
  `cancelled_at`,
  `expired_at`,
  `timeout_at`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `restaurant_id`,
  `customer_id`,
  `customer_name`,
  `customer_phone`,
  `party_size`,
  `preferred_table_type`,
  `queue_number`,
  `queue_letter`,
  `queue_date`,
  `priority`,
  `estimated_wait_minutes`,
  `table_id`,
  `status`,
  `notes`,
  `called_at`,
  `notified_at`,
  `confirmed_at`,
  `seated_at`,
  `cancelled_at`,
  `expired_at`,
  `timeout_at`,
  `created_at`,
  `updated_at`
FROM `waiting_list`;
--> statement-breakpoint

DROP TABLE `waiting_list`;
--> statement-breakpoint
ALTER TABLE `waiting_list__restaurant_fk_rebuild` RENAME TO `waiting_list`;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `waiting_restaurant_status_idx`
  ON `waiting_list` (`restaurant_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `waiting_restaurant_queue_idx`
  ON `waiting_list` (`restaurant_id`, `queue_letter`, `queue_number`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `waiting_customer_phone_idx`
  ON `waiting_list` (`customer_phone`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `waiting_unique_queue_number_per_day_idx`
  ON `waiting_list` (`restaurant_id`, `queue_date`, `queue_letter`, `queue_number`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `waiting_customer_phone_active_idx`
  ON `waiting_list` (`restaurant_id`, `customer_phone`, `queue_date`, `status`);
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `waiting_list_restaurant_guard_bi`
BEFORE INSERT ON `waiting_list`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'waiting_list.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `waiting_list_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `waiting_list`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'waiting_list.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'waiting_list', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'waiting_list was rebuilt with a physical restaurant_id FK in 0026.');
