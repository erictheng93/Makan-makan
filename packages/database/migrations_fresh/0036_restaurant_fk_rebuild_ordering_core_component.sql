-- 0036 restaurant FK rebuild for ordering core component.
-- Rebuilds categories, group_orders, menu_items, orders, tables with physical restaurant_id FKs.
-- Dependent tables are rebuilt from no-FK staging tables because D1 keeps foreign_keys enabled.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'categories', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `categories`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`)
     LIMIT 5
  )),
  'categories.restaurant_id must reference restaurants.id before component rebuild.'
FROM `categories`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'group_orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `group_orders`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`)
     LIMIT 5
  )),
  'group_orders.restaurant_id must reference restaurants.id before component rebuild.'
FROM `group_orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'menu_items', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `menu_items`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`)
     LIMIT 5
  )),
  'menu_items.restaurant_id must reference restaurants.id before component rebuild.'
FROM `menu_items`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `orders`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`)
     LIMIT 5
  )),
  'orders.restaurant_id must reference restaurants.id before component rebuild.'
FROM `orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'tables', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `tables`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`)
     LIMIT 5
  )),
  'tables.restaurant_id must reference restaurants.id before component rebuild.'
FROM `tables`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_ordering_core_component_fk_0036`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_ordering_core_component_fk_0036` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'categories.restaurant_id.orphan_restaurant_id', count(*)
FROM `categories`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'coupon_usage.user_id.orphan_user_id', count(*)
FROM `coupon_usage`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_usage`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'coupon_usage.order_id.orphan_order_id', count(*)
FROM `coupon_usage`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `coupon_usage`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'coupon_usage.coupon_id.orphan_coupon_id', count(*)
FROM `coupon_usage`
WHERE `coupon_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_usage`.`coupon_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_activity_logs.member_id.orphan_member_id', count(*)
FROM `group_activity_logs`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_members` WHERE `group_members`.`id` = `group_activity_logs`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_activity_logs.group_order_id.orphan_group_order_id', count(*)
FROM `group_activity_logs`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `group_activity_logs`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_cart_items.menu_item_id.orphan_menu_item_id', count(*)
FROM `group_cart_items`
WHERE `menu_item_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `menu_items` WHERE `menu_items`.`id` = `group_cart_items`.`menu_item_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_cart_items.member_id.orphan_member_id', count(*)
FROM `group_cart_items`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_members` WHERE `group_members`.`id` = `group_cart_items`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_cart_items.group_order_id.orphan_group_order_id', count(*)
FROM `group_cart_items`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `group_cart_items`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_members.user_id.orphan_user_id', count(*)
FROM `group_members`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `group_members`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_members.group_order_id.orphan_group_order_id', count(*)
FROM `group_members`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `group_members`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_orders.table_id.orphan_table_id', count(*)
FROM `group_orders`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `group_orders`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_orders.created_by.orphan_created_by', count(*)
FROM `group_orders`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `group_orders`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'menu_items.restaurant_id.orphan_restaurant_id', count(*)
FROM `menu_items`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'menu_items.category_id.orphan_category_id', count(*)
FROM `menu_items`
WHERE `category_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `categories` WHERE `categories`.`id` = `menu_items`.`category_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'order_items.menu_item_id.orphan_menu_item_id', count(*)
FROM `order_items`
WHERE `menu_item_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `menu_items` WHERE `menu_items`.`id` = `order_items`.`menu_item_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'order_items.order_id.orphan_order_id', count(*)
FROM `order_items`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `order_items`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'orders.customer_id.orphan_customer_id', count(*)
FROM `orders`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `orders`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'orders.table_id.orphan_table_id', count(*)
FROM `orders`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `orders`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'partnership_usage_logs.restaurant_id.orphan_restaurant_id', count(*)
FROM `partnership_usage_logs`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'partnership_usage_logs.verified_by_user_id.orphan_verified_by_user_id', count(*)
FROM `partnership_usage_logs`
WHERE `verified_by_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_usage_logs`.`verified_by_user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'partnership_usage_logs.order_id.orphan_order_id', count(*)
FROM `partnership_usage_logs`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `partnership_usage_logs`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'partnership_usage_logs.member_id.orphan_member_id', count(*)
FROM `partnership_usage_logs`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `verified_members` WHERE `verified_members`.`id` = `partnership_usage_logs`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'partnership_usage_logs.plan_id.orphan_plan_id', count(*)
FROM `partnership_usage_logs`
WHERE `plan_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `partnership_plans` WHERE `partnership_plans`.`id` = `partnership_usage_logs`.`plan_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'partnership_usage_logs.partnership_id.orphan_partnership_id', count(*)
FROM `partnership_usage_logs`
WHERE `partnership_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_usage_logs`.`partnership_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'payment_transactions.restaurant_id.orphan_restaurant_id', count(*)
FROM `payment_transactions`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `payment_transactions`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'payment_transactions.order_id.orphan_order_id', count(*)
FROM `payment_transactions`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `payment_transactions`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'platform_menu_mappings.restaurant_id.orphan_restaurant_id', count(*)
FROM `platform_menu_mappings`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_menu_mappings`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'platform_menu_mappings.menu_item_id.orphan_menu_item_id', count(*)
FROM `platform_menu_mappings`
WHERE `menu_item_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `menu_items` WHERE `menu_items`.`id` = `platform_menu_mappings`.`menu_item_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'platform_orders.restaurant_id.orphan_restaurant_id', count(*)
FROM `platform_orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'platform_orders.order_id.orphan_order_id', count(*)
FROM `platform_orders`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `platform_orders`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'receipts.shift_id.orphan_shift_id', count(*)
FROM `receipts`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `receipts`.`shift_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'receipts.register_id.orphan_register_id', count(*)
FROM `receipts`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `receipts`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'receipts.order_id.orphan_order_id', count(*)
FROM `receipts`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `receipts`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refund_transactions.restaurant_id.orphan_restaurant_id', count(*)
FROM `refund_transactions`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `refund_transactions`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refund_transactions.order_id.orphan_order_id', count(*)
FROM `refund_transactions`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `refund_transactions`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refund_transactions.payment_transaction_id.orphan_payment_transaction_id', count(*)
FROM `refund_transactions`
WHERE `payment_transaction_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `payment_transactions` WHERE `payment_transactions`.`transaction_id` = `refund_transactions`.`payment_transaction_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refunds.approved_by.orphan_approved_by', count(*)
FROM `refunds`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `refunds`.`approved_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refunds.processed_by.orphan_processed_by', count(*)
FROM `refunds`
WHERE `processed_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `refunds`.`processed_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refunds.shift_id.orphan_shift_id', count(*)
FROM `refunds`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `refunds`.`shift_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refunds.register_id.orphan_register_id', count(*)
FROM `refunds`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `refunds`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'refunds.original_order_id.orphan_original_order_id', count(*)
FROM `refunds`
WHERE `original_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `refunds`.`original_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'reservations.restaurant_id.orphan_restaurant_id', count(*)
FROM `reservations`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'reservations.customer_id.orphan_customer_id', count(*)
FROM `reservations`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `reservations`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'reservations.table_id.orphan_table_id', count(*)
FROM `reservations`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `reservations`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'seats.table_id.orphan_table_id', count(*)
FROM `seats`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `seats`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'split_bills.member_id.orphan_member_id', count(*)
FROM `split_bills`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_members` WHERE `group_members`.`id` = `split_bills`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'split_bills.group_order_id.orphan_group_order_id', count(*)
FROM `split_bills`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `split_bills`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'waiting_list.customer_id.orphan_customer_id', count(*)
FROM `waiting_list`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `waiting_list`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'waiting_list.table_id.orphan_table_id', count(*)
FROM `waiting_list`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `waiting_list`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'waiting_list.restaurant_id.orphan_restaurant_id', count(*)
FROM `waiting_list`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'categories.restaurant_id.orphan_restaurant_id', count(*)
FROM `categories`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'group_orders.restaurant_id.orphan_restaurant_id', count(*)
FROM `group_orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'menu_items.restaurant_id.orphan_restaurant_id', count(*)
FROM `menu_items`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'orders.restaurant_id.orphan_restaurant_id', count(*)
FROM `orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_ordering_core_component_fk_0036`
SELECT 'tables.restaurant_id.orphan_restaurant_id', count(*)
FROM `tables`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_ordering_core_component_fk_0036`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_ordering_core_component_counts_0036`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_ordering_core_component_counts_0036` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `categories__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `categories__component_rebuild_data` AS SELECT * FROM `categories`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'categories.stage', (SELECT count(*) FROM `categories`), (SELECT count(*) FROM `categories__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupon_usage__component_rebuild_data` AS SELECT * FROM `coupon_usage`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'coupon_usage.stage', (SELECT count(*) FROM `coupon_usage`), (SELECT count(*) FROM `coupon_usage__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_activity_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_activity_logs__component_rebuild_data` AS SELECT * FROM `group_activity_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_activity_logs.stage', (SELECT count(*) FROM `group_activity_logs`), (SELECT count(*) FROM `group_activity_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_cart_items__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_cart_items__component_rebuild_data` AS SELECT * FROM `group_cart_items`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_cart_items.stage', (SELECT count(*) FROM `group_cart_items`), (SELECT count(*) FROM `group_cart_items__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_members__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_members__component_rebuild_data` AS SELECT * FROM `group_members`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_members.stage', (SELECT count(*) FROM `group_members`), (SELECT count(*) FROM `group_members__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_orders__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_orders__component_rebuild_data` AS SELECT * FROM `group_orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_orders.stage', (SELECT count(*) FROM `group_orders`), (SELECT count(*) FROM `group_orders__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `menu_items__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `menu_items__component_rebuild_data` AS SELECT * FROM `menu_items`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'menu_items.stage', (SELECT count(*) FROM `menu_items`), (SELECT count(*) FROM `menu_items__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `order_items__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `order_items__component_rebuild_data` AS SELECT * FROM `order_items`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'order_items.stage', (SELECT count(*) FROM `order_items`), (SELECT count(*) FROM `order_items__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `orders__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `orders__component_rebuild_data` AS SELECT * FROM `orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'orders.stage', (SELECT count(*) FROM `orders`), (SELECT count(*) FROM `orders__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `partnership_usage_logs__component_rebuild_data` AS SELECT * FROM `partnership_usage_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'partnership_usage_logs.stage', (SELECT count(*) FROM `partnership_usage_logs`), (SELECT count(*) FROM `partnership_usage_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `payment_transactions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `payment_transactions__component_rebuild_data` AS SELECT * FROM `payment_transactions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'payment_transactions.stage', (SELECT count(*) FROM `payment_transactions`), (SELECT count(*) FROM `payment_transactions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `platform_menu_mappings__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `platform_menu_mappings__component_rebuild_data` AS SELECT * FROM `platform_menu_mappings`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'platform_menu_mappings.stage', (SELECT count(*) FROM `platform_menu_mappings`), (SELECT count(*) FROM `platform_menu_mappings__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `platform_orders__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `platform_orders__component_rebuild_data` AS SELECT * FROM `platform_orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'platform_orders.stage', (SELECT count(*) FROM `platform_orders`), (SELECT count(*) FROM `platform_orders__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `receipts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `receipts__component_rebuild_data` AS SELECT * FROM `receipts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'receipts.stage', (SELECT count(*) FROM `receipts`), (SELECT count(*) FROM `receipts__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `refund_transactions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `refund_transactions__component_rebuild_data` AS SELECT * FROM `refund_transactions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'refund_transactions.stage', (SELECT count(*) FROM `refund_transactions`), (SELECT count(*) FROM `refund_transactions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `refunds__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `refunds__component_rebuild_data` AS SELECT * FROM `refunds`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'refunds.stage', (SELECT count(*) FROM `refunds`), (SELECT count(*) FROM `refunds__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `reservations__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `reservations__component_rebuild_data` AS SELECT * FROM `reservations`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'reservations.stage', (SELECT count(*) FROM `reservations`), (SELECT count(*) FROM `reservations__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `seats__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `seats__component_rebuild_data` AS SELECT * FROM `seats`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'seats.stage', (SELECT count(*) FROM `seats`), (SELECT count(*) FROM `seats__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `split_bills__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `split_bills__component_rebuild_data` AS SELECT * FROM `split_bills`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'split_bills.stage', (SELECT count(*) FROM `split_bills`), (SELECT count(*) FROM `split_bills__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `tables__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `tables__component_rebuild_data` AS SELECT * FROM `tables`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'tables.stage', (SELECT count(*) FROM `tables`), (SELECT count(*) FROM `tables__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `waiting_list__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `waiting_list__component_rebuild_data` AS SELECT * FROM `waiting_list`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'waiting_list.stage', (SELECT count(*) FROM `waiting_list`), (SELECT count(*) FROM `waiting_list__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE `coupon_usage`;
--> statement-breakpoint

DROP TABLE `group_activity_logs`;
--> statement-breakpoint

DROP TABLE `group_cart_items`;
--> statement-breakpoint

DROP TABLE `order_items`;
--> statement-breakpoint

DROP TABLE `partnership_usage_logs`;
--> statement-breakpoint

DROP TABLE `platform_menu_mappings`;
--> statement-breakpoint

DROP TABLE `platform_orders`;
--> statement-breakpoint

DROP TABLE `receipts`;
--> statement-breakpoint

DROP TABLE `refund_transactions`;
--> statement-breakpoint

DROP TABLE `refunds`;
--> statement-breakpoint

DROP TABLE `reservations`;
--> statement-breakpoint

DROP TABLE `seats`;
--> statement-breakpoint

DROP TABLE `split_bills`;
--> statement-breakpoint

DROP TABLE `waiting_list`;
--> statement-breakpoint

DROP TABLE `group_members`;
--> statement-breakpoint

DROP TABLE `menu_items`;
--> statement-breakpoint

DROP TABLE `payment_transactions`;
--> statement-breakpoint

DROP TABLE `categories`;
--> statement-breakpoint

DROP TABLE `group_orders`;
--> statement-breakpoint

DROP TABLE `orders`;
--> statement-breakpoint

DROP TABLE `tables`;
--> statement-breakpoint

CREATE TABLE "tables" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`number` text NOT NULL,
	`name` text,
	`capacity` integer DEFAULT 4 NOT NULL,
	`location` text,
	`floor` integer DEFAULT 1,
	`section` text,
	`qr_code` text NOT NULL,
	`qr_code_image_url` text,
	`qr_code_version` integer DEFAULT 1 NOT NULL,
	`qr_mode` text DEFAULT 'table',
	`seat_count` integer DEFAULT 0,
	`seat_layout` text,
	`seat_numbering_style` text DEFAULT 'numeric',
	`is_occupied` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_reservable` integer DEFAULT true NOT NULL,
	`features` text,
	`current_order_id` integer,
	`occupied_at_ms` integer,
	`occupied_by` text,
	`estimated_free_at_ms` integer,
	`last_cleaned_at_ms` integer,
	`maintenance_notes` text,
	`total_usage` integer DEFAULT 0 NOT NULL,
	`average_occupancy_minutes` integer DEFAULT 0,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `tables` (
  `id`,
  `restaurant_id`,
  `number`,
  `name`,
  `capacity`,
  `location`,
  `floor`,
  `section`,
  `qr_code`,
  `qr_code_image_url`,
  `qr_code_version`,
  `qr_mode`,
  `seat_count`,
  `seat_layout`,
  `seat_numbering_style`,
  `is_occupied`,
  `is_active`,
  `is_reservable`,
  `features`,
  `current_order_id`,
  `occupied_at_ms`,
  `occupied_by`,
  `estimated_free_at_ms`,
  `last_cleaned_at_ms`,
  `maintenance_notes`,
  `total_usage`,
  `average_occupancy_minutes`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `number`,
  `name`,
  `capacity`,
  `location`,
  `floor`,
  `section`,
  `qr_code`,
  `qr_code_image_url`,
  `qr_code_version`,
  `qr_mode`,
  `seat_count`,
  `seat_layout`,
  `seat_numbering_style`,
  `is_occupied`,
  `is_active`,
  `is_reservable`,
  `features`,
  `current_order_id`,
  `occupied_at_ms`,
  `occupied_by`,
  `estimated_free_at_ms`,
  `last_cleaned_at_ms`,
  `maintenance_notes`,
  `total_usage`,
  `average_occupancy_minutes`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `tables__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'tables.final', (SELECT count(*) FROM `tables__component_rebuild_data`), (SELECT count(*) FROM `tables`);
--> statement-breakpoint

CREATE INDEX `tables_qr_code_idx` ON `tables` (`qr_code`);
--> statement-breakpoint

CREATE UNIQUE INDEX `tables_qr_code_unique` ON `tables` (`qr_code`);
--> statement-breakpoint

CREATE INDEX `tables_restaurant_number_idx` ON `tables` (`restaurant_id`,`number`);
--> statement-breakpoint

CREATE INDEX `tables_restaurant_status_idx` ON `tables` (`restaurant_id`,`is_occupied`,`is_active`);
--> statement-breakpoint

CREATE TRIGGER `tables_restaurant_guard_bi`
BEFORE INSERT ON `tables`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'tables.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `tables_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `tables`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'tables.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "orders" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` integer,
	`customer_id` integer,
	`order_number` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order_type` text DEFAULT 'table',
	`subtotal` real NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`service_charge` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`customer_info` text,
	`estimated_prep_time` integer,
	`actual_prep_time` integer,
	`confirmed_at_ms` integer,
	`preparing_at_ms` integer,
	`ready_at_ms` integer,
	`delivered_at_ms` integer,
	`paid_at_ms` integer,
	`cancelled_at_ms` integer,
	`payment_method` text,
	`payment_status` text DEFAULT 'pending',
	`payment_transaction_id` text,
	`coupon_code` text,
	`promotion_ids` text,
	`rating` integer,
	`review_comment` text,
	`reviewed_at_ms` integer,
	`notes` text,
	`internal_notes` text,
	`cancellation_reason` text,
	`refund_amount` real,
	`delivery_info` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, order_source TEXT DEFAULT 'direct', version INTEGER NOT NULL DEFAULT 0, client_mutation_id TEXT, `subtotal_cents` integer, `tax_amount_cents` integer, `service_charge_cents` integer, `discount_amount_cents` integer, `total_amount_cents` integer, `refund_amount_cents` integer,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `orders` (
  `id`,
  `restaurant_id`,
  `table_id`,
  `customer_id`,
  `order_number`,
  `status`,
  `order_type`,
  `subtotal`,
  `tax_amount`,
  `service_charge`,
  `discount_amount`,
  `total_amount`,
  `customer_info`,
  `estimated_prep_time`,
  `actual_prep_time`,
  `confirmed_at_ms`,
  `preparing_at_ms`,
  `ready_at_ms`,
  `delivered_at_ms`,
  `paid_at_ms`,
  `cancelled_at_ms`,
  `payment_method`,
  `payment_status`,
  `payment_transaction_id`,
  `coupon_code`,
  `promotion_ids`,
  `rating`,
  `review_comment`,
  `reviewed_at_ms`,
  `notes`,
  `internal_notes`,
  `cancellation_reason`,
  `refund_amount`,
  `delivery_info`,
  `created_at_ms`,
  `updated_at_ms`,
  `order_source`,
  `version`,
  `client_mutation_id`,
  `subtotal_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `discount_amount_cents`,
  `total_amount_cents`,
  `refund_amount_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `table_id`,
  `customer_id`,
  `order_number`,
  `status`,
  `order_type`,
  `subtotal`,
  `tax_amount`,
  `service_charge`,
  `discount_amount`,
  `total_amount`,
  `customer_info`,
  `estimated_prep_time`,
  `actual_prep_time`,
  `confirmed_at_ms`,
  `preparing_at_ms`,
  `ready_at_ms`,
  `delivered_at_ms`,
  `paid_at_ms`,
  `cancelled_at_ms`,
  `payment_method`,
  `payment_status`,
  `payment_transaction_id`,
  `coupon_code`,
  `promotion_ids`,
  `rating`,
  `review_comment`,
  `reviewed_at_ms`,
  `notes`,
  `internal_notes`,
  `cancellation_reason`,
  `refund_amount`,
  `delivery_info`,
  `created_at_ms`,
  `updated_at_ms`,
  `order_source`,
  `version`,
  `client_mutation_id`,
  `subtotal_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `discount_amount_cents`,
  `total_amount_cents`,
  `refund_amount_cents`
FROM `orders__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'orders.final', (SELECT count(*) FROM `orders__component_rebuild_data`), (SELECT count(*) FROM `orders`);
--> statement-breakpoint

CREATE UNIQUE INDEX orders_client_mutation_unique
  ON orders(restaurant_id, client_mutation_id);
--> statement-breakpoint

CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);
--> statement-breakpoint

CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);
--> statement-breakpoint

CREATE INDEX orders_order_source_idx ON orders (restaurant_id, order_source, created_at_ms);
--> statement-breakpoint

CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`,`paid_at_ms`);
--> statement-breakpoint

CREATE UNIQUE INDEX `orders_payment_transaction_unique`
  ON `orders` (`payment_transaction_id`)
  WHERE `payment_transaction_id` IS NOT NULL;
--> statement-breakpoint

CREATE INDEX `orders_restaurant_payment_tx_idx`
  ON `orders` (`restaurant_id`, `payment_transaction_id`);
--> statement-breakpoint

CREATE INDEX `orders_restaurant_status_idx` ON `orders` (`restaurant_id`,`status`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `orders_restaurant_table_idx` ON `orders` (`restaurant_id`,`table_id`,`status`);
--> statement-breakpoint

CREATE INDEX `orders_status_time_idx` ON `orders` (`status`,`created_at_ms`);
--> statement-breakpoint

CREATE TRIGGER `orders_cents_sync_ai`
AFTER INSERT ON `orders`
FOR EACH ROW
BEGIN
  UPDATE `orders`
     SET `subtotal_cents` = CAST(round(NEW.`subtotal` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `refund_amount_cents` = CASE WHEN NEW.`refund_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`refund_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `orders_cents_sync_au`
AFTER UPDATE OF `subtotal`, `tax_amount`, `service_charge`, `discount_amount`, `total_amount`, `refund_amount` ON `orders`
FOR EACH ROW
BEGIN
  UPDATE `orders`
     SET `subtotal_cents` = CAST(round(NEW.`subtotal` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `refund_amount_cents` = CASE WHEN NEW.`refund_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`refund_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `orders_restaurant_guard_bi`
BEFORE INSERT ON `orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "group_orders" (
	`id` text PRIMARY KEY NOT NULL,
	`share_code` text NOT NULL,
	`master_order_id` integer,
	`created_by` integer NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`split_type` text DEFAULT 'individual' NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`service_charge` real DEFAULT 0 NOT NULL,
	`final_amount` real DEFAULT 0 NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`locked_at_ms` integer,
	`completed_at_ms` integer,
	`settings` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, `total_amount_cents` integer, `tax_amount_cents` integer, `service_charge_cents` integer, `final_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `group_orders` (
  `id`,
  `share_code`,
  `master_order_id`,
  `created_by`,
  `restaurant_id`,
  `table_id`,
  `status`,
  `split_type`,
  `total_amount`,
  `tax_amount`,
  `service_charge`,
  `final_amount`,
  `expires_at_ms`,
  `locked_at_ms`,
  `completed_at_ms`,
  `settings`,
  `notes`,
  `created_at_ms`,
  `updated_at_ms`,
  `total_amount_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `final_amount_cents`
)
SELECT
  `id`,
  `share_code`,
  `master_order_id`,
  `created_by`,
  `restaurant_id`,
  `table_id`,
  `status`,
  `split_type`,
  `total_amount`,
  `tax_amount`,
  `service_charge`,
  `final_amount`,
  `expires_at_ms`,
  `locked_at_ms`,
  `completed_at_ms`,
  `settings`,
  `notes`,
  `created_at_ms`,
  `updated_at_ms`,
  `total_amount_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `final_amount_cents`
FROM `group_orders__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_orders.final', (SELECT count(*) FROM `group_orders__component_rebuild_data`), (SELECT count(*) FROM `group_orders`);
--> statement-breakpoint

CREATE UNIQUE INDEX `group_orders_share_code_unique` ON `group_orders` (`share_code`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_expires` ON `group_orders` (`expires_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_restaurant_status` ON `group_orders` (`restaurant_id`,`status`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_status_created` ON `group_orders` (`status`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_group_orders_table` ON `group_orders` (`table_id`);
--> statement-breakpoint

CREATE TRIGGER `group_orders_cents_sync_ai`
AFTER INSERT ON `group_orders`
FOR EACH ROW
BEGIN
  UPDATE `group_orders`
     SET `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_cents_sync_au`
AFTER UPDATE OF `total_amount`, `tax_amount`, `service_charge`, `final_amount` ON `group_orders`
FOR EACH ROW
BEGIN
  UPDATE `group_orders`
     SET `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_restaurant_guard_bi`
BEFORE INSERT ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `group_orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`image_url` text,
	`icon_url` text,
	`available_hours` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `categories` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `sort_order`,
  `is_active`,
  `is_visible`,
  `image_url`,
  `icon_url`,
  `available_hours`,
  `item_count`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `sort_order`,
  `is_active`,
  `is_visible`,
  `image_url`,
  `icon_url`,
  `available_hours`,
  `item_count`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `categories__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'categories.final', (SELECT count(*) FROM `categories__component_rebuild_data`), (SELECT count(*) FROM `categories`);
--> statement-breakpoint

CREATE INDEX `categories_restaurant_active_idx` ON `categories` (`restaurant_id`,`is_active`);
--> statement-breakpoint

CREATE INDEX `categories_restaurant_sort_idx` ON `categories` (`restaurant_id`,`sort_order`);
--> statement-breakpoint

CREATE TRIGGER `categories_restaurant_guard_bi`
BEFORE INSERT ON `categories`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'categories.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `categories_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `categories`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'categories.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE `payment_transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `transaction_id` text NOT NULL,
  `order_id` integer NOT NULL,
  `restaurant_id` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `currency` text,
  `country_code` text,
  `payment_method` text NOT NULL,
  `gateway` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `idempotency_key` text,
  `provider_transaction_id` text,
  `customer_info` text,
  `metadata` text,
  `error_code` text,
  `error_message` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `completed_at_ms` integer,
  `failed_at_ms` integer,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `payment_transactions` (
  `id`,
  `transaction_id`,
  `order_id`,
  `restaurant_id`,
  `amount_cents`,
  `currency`,
  `country_code`,
  `payment_method`,
  `gateway`,
  `status`,
  `idempotency_key`,
  `provider_transaction_id`,
  `customer_info`,
  `metadata`,
  `error_code`,
  `error_message`,
  `created_at_ms`,
  `updated_at_ms`,
  `completed_at_ms`,
  `failed_at_ms`
)
SELECT
  `id`,
  `transaction_id`,
  `order_id`,
  `restaurant_id`,
  `amount_cents`,
  `currency`,
  `country_code`,
  `payment_method`,
  `gateway`,
  `status`,
  `idempotency_key`,
  `provider_transaction_id`,
  `customer_info`,
  `metadata`,
  `error_code`,
  `error_message`,
  `created_at_ms`,
  `updated_at_ms`,
  `completed_at_ms`,
  `failed_at_ms`
FROM `payment_transactions__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'payment_transactions.final', (SELECT count(*) FROM `payment_transactions__component_rebuild_data`), (SELECT count(*) FROM `payment_transactions`);
--> statement-breakpoint

CREATE INDEX `payment_transactions_idempotency_idx`
  ON `payment_transactions` (`idempotency_key`);
--> statement-breakpoint

CREATE INDEX `payment_transactions_order_idx`
  ON `payment_transactions` (`order_id`, `created_at_ms`);
--> statement-breakpoint

CREATE INDEX `payment_transactions_restaurant_status_idx`
  ON `payment_transactions` (`restaurant_id`, `status`, `created_at_ms`);
--> statement-breakpoint

CREATE UNIQUE INDEX `payment_transactions_transaction_id_unique`
  ON `payment_transactions` (`transaction_id`);
--> statement-breakpoint

CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ingredients` text,
	`price` real NOT NULL,
	`original_price` real,
	`cost_price` real,
	`image_url` text,
	`image_variants` text,
	`is_available` integer DEFAULT true NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_popular` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`inventory_count` integer,
	`min_inventory_alert` integer DEFAULT 5,
	`spice_level` integer DEFAULT 0 NOT NULL,
	`preparation_time` integer DEFAULT 15,
	`calories` integer,
	`dietary_info` text,
	`allergens` text,
	`options` text,
	`available_hours` text,
	`order_count` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`tags` text,
	`keywords` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
	`price_cents` integer,
	`original_price_cents` integer,
	`cost_price_cents` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `menu_items` (
  `id`,
  `restaurant_id`,
  `category_id`,
  `name`,
  `description`,
  `ingredients`,
  `price`,
  `original_price`,
  `cost_price`,
  `image_url`,
  `image_variants`,
  `is_available`,
  `is_featured`,
  `is_popular`,
  `sort_order`,
  `inventory_count`,
  `min_inventory_alert`,
  `spice_level`,
  `preparation_time`,
  `calories`,
  `dietary_info`,
  `allergens`,
  `options`,
  `available_hours`,
  `order_count`,
  `rating`,
  `review_count`,
  `view_count`,
  `tags`,
  `keywords`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `price_cents`,
  `original_price_cents`,
  `cost_price_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `category_id`,
  `name`,
  `description`,
  `ingredients`,
  `price`,
  `original_price`,
  `cost_price`,
  `image_url`,
  `image_variants`,
  `is_available`,
  `is_featured`,
  `is_popular`,
  `sort_order`,
  `inventory_count`,
  `min_inventory_alert`,
  `spice_level`,
  `preparation_time`,
  `calories`,
  `dietary_info`,
  `allergens`,
  `options`,
  `available_hours`,
  `order_count`,
  `rating`,
  `review_count`,
  `view_count`,
  `tags`,
  `keywords`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `price_cents`,
  `original_price_cents`,
  `cost_price_cents`
FROM `menu_items__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'menu_items.final', (SELECT count(*) FROM `menu_items__component_rebuild_data`), (SELECT count(*) FROM `menu_items`);
--> statement-breakpoint

CREATE INDEX `menu_items_availability_idx` ON `menu_items` (`is_available`,`inventory_count`);
--> statement-breakpoint

CREATE INDEX `menu_items_price_range_idx` ON `menu_items` (`restaurant_id`,`price`);
--> statement-breakpoint

CREATE INDEX `menu_items_restaurant_category_idx` ON `menu_items` (`restaurant_id`,`category_id`,`is_available`);
--> statement-breakpoint

CREATE INDEX `menu_items_restaurant_featured_idx` ON `menu_items` (`restaurant_id`,`is_featured`,`is_available`);
--> statement-breakpoint

CREATE INDEX `menu_items_restaurant_popular_idx` ON `menu_items` (`restaurant_id`,`is_popular`,`order_count`);
--> statement-breakpoint

CREATE TRIGGER `menu_items_cents_sync_ai`
AFTER INSERT ON `menu_items`
FOR EACH ROW
BEGIN
  UPDATE `menu_items`
     SET `price_cents` = CAST(round(NEW.`price` * 100) AS integer),
         `original_price_cents` = CASE WHEN NEW.`original_price` IS NULL THEN NULL ELSE CAST(round(NEW.`original_price` * 100) AS integer) END,
         `cost_price_cents` = CASE WHEN NEW.`cost_price` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `menu_items_cents_sync_au`
AFTER UPDATE OF `price`, `original_price`, `cost_price` ON `menu_items`
FOR EACH ROW
BEGIN
  UPDATE `menu_items`
     SET `price_cents` = CAST(round(NEW.`price` * 100) AS integer),
         `original_price_cents` = CASE WHEN NEW.`original_price` IS NULL THEN NULL ELSE CAST(round(NEW.`original_price` * 100) AS integer) END,
         `cost_price_cents` = CASE WHEN NEW.`cost_price` IS NULL THEN NULL ELSE CAST(round(NEW.`cost_price` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `menu_items_restaurant_guard_bi`
BEFORE INSERT ON `menu_items`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'menu_items.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `menu_items_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `menu_items`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'menu_items.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "group_members" (
	`id` text PRIMARY KEY NOT NULL,
	`group_order_id` text NOT NULL,
	`user_id` integer,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`avatar_url` text,
	`role` text DEFAULT 'member' NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`joined_at_ms` integer NOT NULL,
	`last_active_at_ms` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`left_at_ms` integer,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `group_members` (
  `id`,
  `group_order_id`,
  `user_id`,
  `session_id`,
  `name`,
  `phone`,
  `email`,
  `avatar_url`,
  `role`,
  `permissions`,
  `joined_at_ms`,
  `last_active_at_ms`,
  `is_active`,
  `left_at_ms`
)
SELECT
  `id`,
  `group_order_id`,
  `user_id`,
  `session_id`,
  `name`,
  `phone`,
  `email`,
  `avatar_url`,
  `role`,
  `permissions`,
  `joined_at_ms`,
  `last_active_at_ms`,
  `is_active`,
  `left_at_ms`
FROM `group_members__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_members.final', (SELECT count(*) FROM `group_members__component_rebuild_data`), (SELECT count(*) FROM `group_members`);
--> statement-breakpoint

CREATE INDEX `idx_group_members_active` ON `group_members` (`group_order_id`,`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_group_members_group_order` ON `group_members` (`group_order_id`);
--> statement-breakpoint

CREATE INDEX `idx_group_members_session` ON `group_members` (`session_id`);
--> statement-breakpoint

CREATE INDEX `idx_group_members_user` ON `group_members` (`user_id`);
--> statement-breakpoint

CREATE TABLE "waiting_list" (
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

INSERT INTO `waiting_list` (
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
FROM `waiting_list__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'waiting_list.final', (SELECT count(*) FROM `waiting_list__component_rebuild_data`), (SELECT count(*) FROM `waiting_list`);
--> statement-breakpoint

CREATE INDEX `waiting_customer_phone_active_idx`
  ON `waiting_list` (`restaurant_id`, `customer_phone`, `queue_date`, `status`);
--> statement-breakpoint

CREATE INDEX `waiting_customer_phone_idx`
  ON `waiting_list` (`customer_phone`);
--> statement-breakpoint

CREATE INDEX `waiting_restaurant_queue_idx`
  ON `waiting_list` (`restaurant_id`, `queue_letter`, `queue_number`);
--> statement-breakpoint

CREATE INDEX `waiting_restaurant_status_idx`
  ON `waiting_list` (`restaurant_id`, `status`, `created_at`);
--> statement-breakpoint

CREATE UNIQUE INDEX `waiting_unique_queue_number_per_day_idx`
  ON `waiting_list` (`restaurant_id`, `queue_date`, `queue_letter`, `queue_number`);
--> statement-breakpoint

CREATE TRIGGER `waiting_list_restaurant_guard_bi`
BEFORE INSERT ON `waiting_list`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'waiting_list.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `waiting_list_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `waiting_list`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'waiting_list.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "split_bills" (
	`id` text PRIMARY KEY NOT NULL,
	`group_order_id` text NOT NULL,
	`member_id` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`service_charge` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`tip_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text,
	`payment_reference` text,
	`paid_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL, `subtotal_cents` integer, `tax_amount_cents` integer, `service_charge_cents` integer, `discount_amount_cents` integer, `tip_amount_cents` integer, `total_amount_cents` integer,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `split_bills` (
  `id`,
  `group_order_id`,
  `member_id`,
  `subtotal`,
  `tax_amount`,
  `service_charge`,
  `discount_amount`,
  `tip_amount`,
  `total_amount`,
  `items`,
  `payment_status`,
  `payment_method`,
  `payment_reference`,
  `paid_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `subtotal_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `discount_amount_cents`,
  `tip_amount_cents`,
  `total_amount_cents`
)
SELECT
  `id`,
  `group_order_id`,
  `member_id`,
  `subtotal`,
  `tax_amount`,
  `service_charge`,
  `discount_amount`,
  `tip_amount`,
  `total_amount`,
  `items`,
  `payment_status`,
  `payment_method`,
  `payment_reference`,
  `paid_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `subtotal_cents`,
  `tax_amount_cents`,
  `service_charge_cents`,
  `discount_amount_cents`,
  `tip_amount_cents`,
  `total_amount_cents`
FROM `split_bills__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'split_bills.final', (SELECT count(*) FROM `split_bills__component_rebuild_data`), (SELECT count(*) FROM `split_bills`);
--> statement-breakpoint

CREATE INDEX `idx_split_bills_group_order` ON `split_bills` (`group_order_id`);
--> statement-breakpoint

CREATE INDEX `idx_split_bills_member` ON `split_bills` (`member_id`);
--> statement-breakpoint

CREATE INDEX `idx_split_bills_payment_status` ON `split_bills` (`group_order_id`,`payment_status`);
--> statement-breakpoint

CREATE TRIGGER `split_bills_cents_sync_ai`
AFTER INSERT ON `split_bills`
FOR EACH ROW
BEGIN
  UPDATE `split_bills`
     SET `subtotal_cents` = CAST(round(NEW.`subtotal` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `tip_amount_cents` = CAST(round(NEW.`tip_amount` * 100) AS integer),
         `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `split_bills_cents_sync_au`
AFTER UPDATE OF `subtotal`, `tax_amount`, `service_charge`, `discount_amount`, `tip_amount`, `total_amount` ON `split_bills`
FOR EACH ROW
BEGIN
  UPDATE `split_bills`
     SET `subtotal_cents` = CAST(round(NEW.`subtotal` * 100) AS integer),
         `tax_amount_cents` = CAST(round(NEW.`tax_amount` * 100) AS integer),
         `service_charge_cents` = CAST(round(NEW.`service_charge` * 100) AS integer),
         `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `tip_amount_cents` = CAST(round(NEW.`tip_amount` * 100) AS integer),
         `total_amount_cents` = CAST(round(NEW.`total_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE `seats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_id` integer NOT NULL,
	`seat_number` text NOT NULL,
	`seat_name` text,
	`position` text,
	`qr_code` text NOT NULL,
	`qr_code_image_url` text,
	`qr_code_version` integer DEFAULT 1 NOT NULL,
	`is_occupied` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`current_order_id` integer,
	"occupied_at_ms" integer,
	`occupied_by` text,
	`total_usage` integer DEFAULT 0 NOT NULL,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
	"deleted_at_ms" integer,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `seats` (
  `id`,
  `table_id`,
  `seat_number`,
  `seat_name`,
  `position`,
  `qr_code`,
  `qr_code_image_url`,
  `qr_code_version`,
  `is_occupied`,
  `is_active`,
  `current_order_id`,
  `occupied_at_ms`,
  `occupied_by`,
  `total_usage`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `table_id`,
  `seat_number`,
  `seat_name`,
  `position`,
  `qr_code`,
  `qr_code_image_url`,
  `qr_code_version`,
  `is_occupied`,
  `is_active`,
  `current_order_id`,
  `occupied_at_ms`,
  `occupied_by`,
  `total_usage`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `seats__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'seats.final', (SELECT count(*) FROM `seats__component_rebuild_data`), (SELECT count(*) FROM `seats`);
--> statement-breakpoint

CREATE INDEX `seats_is_active_idx` ON `seats` (`is_active`);
--> statement-breakpoint

CREATE INDEX `seats_is_occupied_idx` ON `seats` (`is_occupied`);
--> statement-breakpoint

CREATE INDEX `seats_qr_code_idx` ON `seats` (`qr_code`);
--> statement-breakpoint

CREATE UNIQUE INDEX `seats_qr_code_unique` ON `seats` (`qr_code`);
--> statement-breakpoint

CREATE INDEX `seats_table_id_idx` ON `seats` (`table_id`);
--> statement-breakpoint

CREATE INDEX `seats_table_seat_number_idx` ON `seats` (`table_id`,`seat_number`);
--> statement-breakpoint

CREATE TABLE "reservations" (
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

INSERT INTO `reservations` (
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
FROM `reservations__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'reservations.final', (SELECT count(*) FROM `reservations__component_rebuild_data`), (SELECT count(*) FROM `reservations`);
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

CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`original_order_id` integer NOT NULL,
	`register_id` text NOT NULL,
	`shift_id` text,
	`refund_number` text NOT NULL,
	`refund_type` text NOT NULL,
	`original_amount` real NOT NULL,
	`refund_amount` real NOT NULL,
	`refund_method` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_description` text,
	`items_refunded` text DEFAULT '[]' NOT NULL,
	`processed_by` integer NOT NULL,
	`approved_by` integer,
	`customer_signature` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`processed_at_ms` integer,
	`completed_at_ms` integer,
	`original_amount_cents` integer,
	`refund_amount_cents` integer,
	FOREIGN KEY (`original_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `refunds` (
  `id`,
  `original_order_id`,
  `register_id`,
  `shift_id`,
  `refund_number`,
  `refund_type`,
  `original_amount`,
  `refund_amount`,
  `refund_method`,
  `reason_code`,
  `reason_description`,
  `items_refunded`,
  `processed_by`,
  `approved_by`,
  `customer_signature`,
  `status`,
  `metadata`,
  `processed_at_ms`,
  `completed_at_ms`,
  `original_amount_cents`,
  `refund_amount_cents`
)
SELECT
  `id`,
  `original_order_id`,
  `register_id`,
  `shift_id`,
  `refund_number`,
  `refund_type`,
  `original_amount`,
  `refund_amount`,
  `refund_method`,
  `reason_code`,
  `reason_description`,
  `items_refunded`,
  `processed_by`,
  `approved_by`,
  `customer_signature`,
  `status`,
  `metadata`,
  `processed_at_ms`,
  `completed_at_ms`,
  `original_amount_cents`,
  `refund_amount_cents`
FROM `refunds__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'refunds.final', (SELECT count(*) FROM `refunds__component_rebuild_data`), (SELECT count(*) FROM `refunds`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_order` ON `refunds` (`original_order_id`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_register` ON `refunds` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_shift` ON `refunds` (`shift_id`);
--> statement-breakpoint

CREATE INDEX `idx_refunds_status` ON `refunds` (`status`);
--> statement-breakpoint

CREATE UNIQUE INDEX `refunds_refund_number_unique` ON `refunds` (`refund_number`);
--> statement-breakpoint

CREATE TRIGGER `refunds_cents_sync_ai`
AFTER INSERT ON `refunds`
FOR EACH ROW
BEGIN
  UPDATE `refunds`
     SET `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `refund_amount_cents` = CAST(round(NEW.`refund_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `refunds_cents_sync_au`
AFTER UPDATE OF `original_amount`, `refund_amount` ON `refunds`
FOR EACH ROW
BEGIN
  UPDATE `refunds`
     SET `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `refund_amount_cents` = CAST(round(NEW.`refund_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE `refund_transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `refund_id` text NOT NULL,
  `payment_transaction_id` text NOT NULL,
  `order_id` integer NOT NULL,
  `restaurant_id` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `reason` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `provider_refund_id` text,
  `error_code` text,
  `error_message` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `completed_at_ms` integer,
  FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions`(`transaction_id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `refund_transactions` (
  `id`,
  `refund_id`,
  `payment_transaction_id`,
  `order_id`,
  `restaurant_id`,
  `amount_cents`,
  `reason`,
  `status`,
  `provider_refund_id`,
  `error_code`,
  `error_message`,
  `created_at_ms`,
  `updated_at_ms`,
  `completed_at_ms`
)
SELECT
  `id`,
  `refund_id`,
  `payment_transaction_id`,
  `order_id`,
  `restaurant_id`,
  `amount_cents`,
  `reason`,
  `status`,
  `provider_refund_id`,
  `error_code`,
  `error_message`,
  `created_at_ms`,
  `updated_at_ms`,
  `completed_at_ms`
FROM `refund_transactions__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'refund_transactions.final', (SELECT count(*) FROM `refund_transactions__component_rebuild_data`), (SELECT count(*) FROM `refund_transactions`);
--> statement-breakpoint

CREATE INDEX `refund_transactions_order_idx`
  ON `refund_transactions` (`order_id`, `created_at_ms`);
--> statement-breakpoint

CREATE INDEX `refund_transactions_payment_idx`
  ON `refund_transactions` (`payment_transaction_id`, `created_at_ms`);
--> statement-breakpoint

CREATE UNIQUE INDEX `refund_transactions_refund_id_unique`
  ON `refund_transactions` (`refund_id`);
--> statement-breakpoint

CREATE TABLE "receipts" (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` integer NOT NULL,
	`register_id` text NOT NULL,
	`shift_id` text,
	`receipt_number` text NOT NULL,
	`receipt_type` text NOT NULL,
	`template_name` text DEFAULT 'standard' NOT NULL,
	`content` text NOT NULL,
	`raw_content` text,
	`print_status` text DEFAULT 'pending' NOT NULL,
	`print_attempts` integer DEFAULT 0 NOT NULL,
	`printer_name` text,
	`printer_response` text,
	`printed_at_ms` integer,
	`reprinted_count` integer DEFAULT 0 NOT NULL,
	`last_reprint_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `receipts` (
  `id`,
  `order_id`,
  `register_id`,
  `shift_id`,
  `receipt_number`,
  `receipt_type`,
  `template_name`,
  `content`,
  `raw_content`,
  `print_status`,
  `print_attempts`,
  `printer_name`,
  `printer_response`,
  `printed_at_ms`,
  `reprinted_count`,
  `last_reprint_at_ms`,
  `created_at_ms`
)
SELECT
  `id`,
  `order_id`,
  `register_id`,
  `shift_id`,
  `receipt_number`,
  `receipt_type`,
  `template_name`,
  `content`,
  `raw_content`,
  `print_status`,
  `print_attempts`,
  `printer_name`,
  `printer_response`,
  `printed_at_ms`,
  `reprinted_count`,
  `last_reprint_at_ms`,
  `created_at_ms`
FROM `receipts__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'receipts.final', (SELECT count(*) FROM `receipts__component_rebuild_data`), (SELECT count(*) FROM `receipts`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_order` ON `receipts` (`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_print_status` ON `receipts` (`print_status`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_register` ON `receipts` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_receipts_shift` ON `receipts` (`shift_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `receipts` (`receipt_number`);
--> statement-breakpoint

CREATE TABLE "platform_orders" (
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

INSERT INTO `platform_orders` (
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
FROM `platform_orders__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'platform_orders.final', (SELECT count(*) FROM `platform_orders__component_rebuild_data`), (SELECT count(*) FROM `platform_orders`);
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

CREATE TABLE `platform_menu_mappings` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `menu_item_id` integer NOT NULL,
  `restaurant_id` text NOT NULL,
  `platform` text NOT NULL,
  `platform_item_id` text,
  `sync_status` text DEFAULT 'pending',
  `last_synced_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `platform_menu_mappings` (
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
FROM `platform_menu_mappings__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'platform_menu_mappings.final', (SELECT count(*) FROM `platform_menu_mappings__component_rebuild_data`), (SELECT count(*) FROM `platform_menu_mappings`);
--> statement-breakpoint

CREATE UNIQUE INDEX `platform_menu_mappings_item_platform_idx`
  ON `platform_menu_mappings` (`menu_item_id`, `platform`);
--> statement-breakpoint

CREATE INDEX `platform_menu_mappings_restaurant_platform_idx`
  ON `platform_menu_mappings` (`restaurant_id`, `platform`);
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

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'partnership_usage_logs.final', (SELECT count(*) FROM `partnership_usage_logs__component_rebuild_data`), (SELECT count(*) FROM `partnership_usage_logs`);
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

CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`menu_item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`total_price` real NOT NULL,
	`item_snapshot` text,
	`customizations` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`prepared_at_ms` integer,
	`served_at_ms` integer,
	`notes` text,
	`kitchen_notes` text,
	`cancelled_at_ms` integer,
	`cancellation_reason` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`unit_price_cents` integer,
	`total_price_cents` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint

INSERT INTO `order_items` (
  `id`,
  `order_id`,
  `menu_item_id`,
  `quantity`,
  `unit_price`,
  `total_price`,
  `item_snapshot`,
  `customizations`,
  `status`,
  `prepared_at_ms`,
  `served_at_ms`,
  `notes`,
  `kitchen_notes`,
  `cancelled_at_ms`,
  `cancellation_reason`,
  `created_at_ms`,
  `updated_at_ms`,
  `unit_price_cents`,
  `total_price_cents`
)
SELECT
  `id`,
  `order_id`,
  `menu_item_id`,
  `quantity`,
  `unit_price`,
  `total_price`,
  `item_snapshot`,
  `customizations`,
  `status`,
  `prepared_at_ms`,
  `served_at_ms`,
  `notes`,
  `kitchen_notes`,
  `cancelled_at_ms`,
  `cancellation_reason`,
  `created_at_ms`,
  `updated_at_ms`,
  `unit_price_cents`,
  `total_price_cents`
FROM `order_items__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'order_items.final', (SELECT count(*) FROM `order_items__component_rebuild_data`), (SELECT count(*) FROM `order_items`);
--> statement-breakpoint

CREATE INDEX `order_items_menu_item_idx` ON `order_items` (`menu_item_id`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `order_items_order_status_idx` ON `order_items` (`order_id`,`status`);
--> statement-breakpoint

CREATE TRIGGER `order_items_cents_sync_ai`
AFTER INSERT ON `order_items`
FOR EACH ROW
BEGIN
  UPDATE `order_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `order_items_cents_sync_au`
AFTER UPDATE OF `unit_price`, `total_price` ON `order_items`
FOR EACH ROW
BEGIN
  UPDATE `order_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE `group_cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`group_order_id` text NOT NULL,
	`member_id` text NOT NULL,
	`menu_item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`total_price` real NOT NULL,
	`customizations` text DEFAULT '{}' NOT NULL,
	`special_instructions` text,
	`status` text DEFAULT 'active' NOT NULL,
	`added_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`unit_price_cents` integer,
	`total_price_cents` integer,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `group_cart_items` (
  `id`,
  `group_order_id`,
  `member_id`,
  `menu_item_id`,
  `quantity`,
  `unit_price`,
  `total_price`,
  `customizations`,
  `special_instructions`,
  `status`,
  `added_at_ms`,
  `updated_at_ms`,
  `unit_price_cents`,
  `total_price_cents`
)
SELECT
  `id`,
  `group_order_id`,
  `member_id`,
  `menu_item_id`,
  `quantity`,
  `unit_price`,
  `total_price`,
  `customizations`,
  `special_instructions`,
  `status`,
  `added_at_ms`,
  `updated_at_ms`,
  `unit_price_cents`,
  `total_price_cents`
FROM `group_cart_items__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_cart_items.final', (SELECT count(*) FROM `group_cart_items__component_rebuild_data`), (SELECT count(*) FROM `group_cart_items`);
--> statement-breakpoint

CREATE INDEX `idx_group_cart_items_group_order` ON `group_cart_items` (`group_order_id`);
--> statement-breakpoint

CREATE INDEX `idx_group_cart_items_member` ON `group_cart_items` (`member_id`);
--> statement-breakpoint

CREATE INDEX `idx_group_cart_items_status` ON `group_cart_items` (`group_order_id`,`status`);
--> statement-breakpoint

CREATE TRIGGER `group_cart_items_cents_sync_ai`
AFTER INSERT ON `group_cart_items`
FOR EACH ROW
BEGIN
  UPDATE `group_cart_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `group_cart_items_cents_sync_au`
AFTER UPDATE OF `unit_price`, `total_price` ON `group_cart_items`
FOR EACH ROW
BEGIN
  UPDATE `group_cart_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE "group_activity_logs" (
	`id` text PRIMARY KEY NOT NULL,
	`group_order_id` text NOT NULL,
	`member_id` text,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `group_activity_logs` (
  `id`,
  `group_order_id`,
  `member_id`,
  `action`,
  `description`,
  `metadata`,
  `created_at_ms`
)
SELECT
  `id`,
  `group_order_id`,
  `member_id`,
  `action`,
  `description`,
  `metadata`,
  `created_at_ms`
FROM `group_activity_logs__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'group_activity_logs.final', (SELECT count(*) FROM `group_activity_logs__component_rebuild_data`), (SELECT count(*) FROM `group_activity_logs`);
--> statement-breakpoint

CREATE INDEX `idx_group_activity_logs_action` ON `group_activity_logs` (`group_order_id`,`action`);
--> statement-breakpoint

CREATE INDEX `idx_group_activity_logs_created` ON `group_activity_logs` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_group_activity_logs_group_order` ON `group_activity_logs` (`group_order_id`);
--> statement-breakpoint

CREATE TABLE `coupon_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`user_id` integer,
	`discount_amount` real NOT NULL,
	`original_amount` real NOT NULL,
	`final_amount` real NOT NULL,
	`status` text DEFAULT 'active',
	"used_at_ms" integer NOT NULL,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL, `discount_amount_cents` integer, `original_amount_cents` integer, `final_amount_cents` integer,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `coupon_usage` (
  `id`,
  `coupon_id`,
  `order_id`,
  `user_id`,
  `discount_amount`,
  `original_amount`,
  `final_amount`,
  `status`,
  `used_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `discount_amount_cents`,
  `original_amount_cents`,
  `final_amount_cents`
)
SELECT
  `id`,
  `coupon_id`,
  `order_id`,
  `user_id`,
  `discount_amount`,
  `original_amount`,
  `final_amount`,
  `status`,
  `used_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `discount_amount_cents`,
  `original_amount_cents`,
  `final_amount_cents`
FROM `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_ordering_core_component_counts_0036`
SELECT 'coupon_usage.final', (SELECT count(*) FROM `coupon_usage__component_rebuild_data`), (SELECT count(*) FROM `coupon_usage`);
--> statement-breakpoint

CREATE UNIQUE INDEX `coupon_usage_coupon_order_active_unique`
  ON `coupon_usage` (`coupon_id`, `order_id`)
  WHERE `status` IS NULL OR `status` != 'cancelled';
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_coupon_id` ON `coupon_usage` (`coupon_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_order_id` ON `coupon_usage` (`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_status` ON `coupon_usage` (`status`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_unique` ON `coupon_usage` (`coupon_id`,`order_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_used_at` ON `coupon_usage` ("used_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_coupon_usage_user_id` ON `coupon_usage` (`user_id`);
--> statement-breakpoint

CREATE TRIGGER `coupon_usage_cents_sync_ai`
AFTER INSERT ON `coupon_usage`
FOR EACH ROW
BEGIN
  UPDATE `coupon_usage`
     SET `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `coupon_usage_cents_sync_au`
AFTER UPDATE OF `discount_amount`, `original_amount`, `final_amount` ON `coupon_usage`
FOR EACH ROW
BEGIN
  UPDATE `coupon_usage`
     SET `discount_amount_cents` = CAST(round(NEW.`discount_amount` * 100) AS integer),
         `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `final_amount_cents` = CAST(round(NEW.`final_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

DROP TABLE `categories__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_activity_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_cart_items__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_members__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_orders__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `menu_items__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `order_items__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `orders__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `payment_transactions__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `platform_menu_mappings__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `platform_orders__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `receipts__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `refund_transactions__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `refunds__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `reservations__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `seats__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `split_bills__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `tables__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `waiting_list__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_ordering_core_component_counts_0036`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'categories', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'categories was rebuilt with a physical restaurant_id FK in 0036 using a D1-safe component rebuild.');
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'group_orders', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'group_orders was rebuilt with a physical restaurant_id FK in 0036 using a D1-safe component rebuild.');
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'menu_items', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'menu_items was rebuilt with a physical restaurant_id FK in 0036 using a D1-safe component rebuild.');
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'orders', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'orders was rebuilt with a physical restaurant_id FK in 0036 using a D1-safe component rebuild.');
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'tables', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'tables was rebuilt with a physical restaurant_id FK in 0036 using a D1-safe component rebuild.');
--> statement-breakpoint
