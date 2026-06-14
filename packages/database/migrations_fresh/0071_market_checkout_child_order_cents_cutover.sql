-- Retire legacy REAL totals from persisted market checkout child orders.
--
-- Runtime/API payloads still expose decimal totalAmount for compatibility, but
-- persisted data now keeps total_amount_cents as the single money source.

PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_market_checkout_child_order_counts`;
--> statement-breakpoint
CREATE TABLE `_migration_market_checkout_child_order_counts` (
  `table_name` text PRIMARY KEY NOT NULL,
  `before_count` integer NOT NULL,
  `after_count` integer
);
--> statement-breakpoint

INSERT INTO `_migration_market_checkout_child_order_counts`
  (`table_name`, `before_count`)
VALUES
  ('market_checkout_child_orders', (SELECT count(*) FROM `market_checkout_child_orders`));
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_market_checkout_child_order_cents_cutover`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_market_checkout_child_order_cents_cutover` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

ALTER TABLE `market_checkout_child_orders` DROP COLUMN `total_amount`;
--> statement-breakpoint

UPDATE `_migration_market_checkout_child_order_counts`
   SET `after_count` = CASE `table_name`
     WHEN 'market_checkout_child_orders' THEN (SELECT count(*) FROM `market_checkout_child_orders`)
   END;
--> statement-breakpoint

INSERT INTO `_migration_assert_market_checkout_child_order_cents_cutover`
SELECT
  'market_checkout_child_order_cents_cutover.row_counts_unchanged',
  count(*)
FROM `_migration_market_checkout_child_order_counts`
WHERE `before_count` != `after_count`
   OR `after_count` IS NULL;
--> statement-breakpoint

INSERT INTO `_migration_assert_market_checkout_child_order_cents_cutover`
SELECT
  'market_checkout_child_order_cents_cutover.foreign_key_check',
  count(*)
FROM pragma_foreign_key_check;
--> statement-breakpoint

PRAGMA foreign_key_check;
--> statement-breakpoint

DROP TABLE `_migration_market_checkout_child_order_counts`;
--> statement-breakpoint
DROP TABLE `_migration_assert_market_checkout_child_order_cents_cutover`;
