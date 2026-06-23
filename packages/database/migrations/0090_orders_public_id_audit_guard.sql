-- Audit guard for the orders public_id bridge.
--
-- This is intentionally non-destructive. It blocks later not-null or primary
-- key rebuild work if bridge identifiers are missing, duplicated, or malformed.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'orders_public_id_bridge',
  'orders',
  'public_id',
  'public_id_missing',
  'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `orders`
     WHERE `public_id` IS NULL
     ORDER BY `id`
     LIMIT 5
  )),
  'Every orders row must have public_id before orders.id can be rebuilt or hidden from public contracts.'
FROM `orders`
WHERE `public_id` IS NULL;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'orders_public_id_bridge',
  'orders',
  'public_id',
  'public_id_duplicate',
  'error',
  count(*),
  (SELECT group_concat(`public_id`, ',') FROM (
    SELECT `public_id`
      FROM `orders`
     WHERE `public_id` IS NOT NULL
     GROUP BY `public_id`
    HAVING count(*) > 1
     ORDER BY `public_id`
     LIMIT 5
  )),
  'orders.public_id must remain unique before it can replace integer order ids in public contracts.'
FROM (
  SELECT `public_id`
    FROM `orders`
   WHERE `public_id` IS NOT NULL
   GROUP BY `public_id`
  HAVING count(*) > 1
);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'orders_public_id_bridge',
  'orders',
  'public_id',
  'public_id_invalid_format',
  'error',
  count(*),
  (SELECT group_concat(`id` || ':' || COALESCE(`public_id`, '<null>'), ',') FROM (
    SELECT `id`, `public_id`
      FROM `orders`
     WHERE `public_id` IS NOT NULL
       AND NOT (
         length(`public_id`) = 36
         AND lower(`public_id`) = `public_id`
         AND substr(`public_id`, 9, 1) = '-'
         AND substr(`public_id`, 14, 1) = '-'
         AND substr(`public_id`, 15, 1) = '7'
         AND substr(`public_id`, 19, 1) = '-'
         AND substr(`public_id`, 20, 1) IN ('8', '9', 'a', 'b')
         AND substr(`public_id`, 24, 1) = '-'
         AND replace(`public_id`, '-', '') NOT GLOB '*[^0-9a-f]*'
       )
     ORDER BY `id`
     LIMIT 5
  )),
  'orders.public_id must be lowercase UUID-v7-shaped text before public UUID contracts become authoritative.'
FROM `orders`
WHERE `public_id` IS NOT NULL
  AND NOT (
    length(`public_id`) = 36
    AND lower(`public_id`) = `public_id`
    AND substr(`public_id`, 9, 1) = '-'
    AND substr(`public_id`, 14, 1) = '-'
    AND substr(`public_id`, 15, 1) = '7'
    AND substr(`public_id`, 19, 1) = '-'
    AND substr(`public_id`, 20, 1) IN ('8', '9', 'a', 'b')
    AND substr(`public_id`, 24, 1) = '-'
    AND replace(`public_id`, '-', '') NOT GLOB '*[^0-9a-f]*'
  );
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_orders_public_id_audit_guard`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_orders_public_id_audit_guard` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_orders_public_id_audit_guard`
SELECT `check_name`, `violation_count`
FROM `data_integrity_audit`
WHERE `scope` = 'orders_public_id_bridge'
  AND `table_name` = 'orders'
  AND `column_name` = 'public_id'
  AND `severity` = 'error';
--> statement-breakpoint

DROP TABLE `_migration_assert_orders_public_id_audit_guard`;
