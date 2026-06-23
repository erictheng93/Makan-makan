-- Add a non-destructive UUID public identifier bridge for orders.
--
-- orders.id remains the integer primary key in this phase. The public_id bridge
-- lets runtime contracts migrate before any table rebuild or dependent FK
-- conversion.

ALTER TABLE `orders` ADD COLUMN `public_id` text;
--> statement-breakpoint

UPDATE `orders`
   SET `public_id` = lower(
     substr(printf('%012x', COALESCE(`created_at_ms`, unixepoch('now') * 1000)), 1, 8) || '-' ||
     substr(printf('%012x', COALESCE(`created_at_ms`, unixepoch('now') * 1000)), 9, 4) || '-' ||
     '7' || substr(hex(randomblob(2)), 2, 3) || '-' ||
     substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2, 3) || '-' ||
     substr(hex(randomblob(4)) || printf('%08x', `id`), 1, 12)
   )
 WHERE `public_id` IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `orders_public_id_unique`
  ON `orders` (`public_id`)
  WHERE `public_id` IS NOT NULL;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_orders_public_id_bridge`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_orders_public_id_bridge` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_orders_public_id_bridge`
SELECT
  'orders.public_id_backfill_missing',
  count(*)
FROM `orders`
WHERE `public_id` IS NULL;
--> statement-breakpoint

INSERT INTO `_migration_assert_orders_public_id_bridge`
SELECT
  'orders.public_id_backfill_duplicates',
  count(*)
FROM (
  SELECT `public_id`
    FROM `orders`
   WHERE `public_id` IS NOT NULL
   GROUP BY `public_id`
  HAVING count(*) > 1
);
--> statement-breakpoint

DROP TABLE `_migration_assert_orders_public_id_bridge`;
