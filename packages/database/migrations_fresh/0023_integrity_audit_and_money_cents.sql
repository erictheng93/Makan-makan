-- Data integrity audit, restaurant scope guards, and integer-cent money shadow columns.
-- This migration keeps existing REAL columns for compatibility and introduces
-- cents columns plus sync triggers so services can migrate incrementally.

CREATE TABLE IF NOT EXISTS `data_integrity_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `scope` text NOT NULL,
  `table_name` text NOT NULL,
  `column_name` text NOT NULL,
  `check_name` text NOT NULL,
  `severity` text NOT NULL,
  `violation_count` integer DEFAULT 0 NOT NULL,
  `sample_values` text,
  `details` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `data_integrity_audit_check_unique`
  ON `data_integrity_audit` (`scope`, `table_name`, `column_name`, `check_name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `data_integrity_audit_scope_severity_idx`
  ON `data_integrity_audit` (`scope`, `severity`, `created_at_ms`);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Restaurant FK audit snapshots before trigger guards are enabled
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'users', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `users`
     WHERE `restaurant_id` IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `users`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'categories', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `categories`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `categories`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `categories`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'menu_items', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `menu_items`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `menu_items`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `menu_items`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'tables', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `tables`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `tables`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `tables`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `orders`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`);
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `reservations`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`);
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `reservation_slots`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservation_slots`.`restaurant_id`);
--> statement-breakpoint

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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `waiting_list`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'group_orders', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `group_orders`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `group_orders`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'coupons', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `coupons`
     WHERE `restaurant_id` IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `coupons`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'coupon_templates', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `coupon_templates`
     WHERE `restaurant_id` IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `coupon_templates`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`);
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `qr_batches`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `qr_batches`.`restaurant_id`);
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
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
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
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
     WHERE `restaurant_id` IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_webhook_logs`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `platform_webhook_logs`
WHERE `restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_webhook_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'cash_registers', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `cash_registers`
     WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`)
     LIMIT 5
  )),
  'Existing rows whose restaurant_id does not exist in restaurants.id; physical FK retrofit needs table rebuild after cleanup.'
FROM `cash_registers`
WHERE NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `cash_registers`.`restaurant_id`);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Restaurant scope guards for future writes
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS `users_restaurant_guard_bi`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'users.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `users_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `users`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'users.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `categories_restaurant_guard_bi`
BEFORE INSERT ON `categories`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'categories.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `categories_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `categories`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'categories.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `menu_items_restaurant_guard_bi`
BEFORE INSERT ON `menu_items`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'menu_items.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `menu_items_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `menu_items`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'menu_items.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `tables_restaurant_guard_bi`
BEFORE INSERT ON `tables`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'tables.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `tables_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `tables`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'tables.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `orders_restaurant_guard_bi`
BEFORE INSERT ON `orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `reservations_restaurant_guard_bi`
BEFORE INSERT ON `reservations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `reservations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `reservations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `reservation_slots_restaurant_guard_bi`
BEFORE INSERT ON `reservation_slots`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservation_slots.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `reservation_slots_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `reservation_slots`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'reservation_slots.restaurant_id references missing restaurants.id');
END;
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

CREATE TRIGGER IF NOT EXISTS `group_orders_restaurant_guard_bi`
BEFORE INSERT ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `group_orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `group_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'group_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `coupons_restaurant_guard_bi`
BEFORE INSERT ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `coupons_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `cash_registers_restaurant_guard_bi`
BEFORE INSERT ON `cash_registers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'cash_registers.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `cash_registers_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `cash_registers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'cash_registers.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Integer cents shadow columns and backfill
-- ---------------------------------------------------------------------------

ALTER TABLE `orders` ADD COLUMN `subtotal_cents` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `tax_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `service_charge_cents` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `discount_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `total_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `refund_amount_cents` integer;
--> statement-breakpoint
UPDATE `orders`
   SET `subtotal_cents` = CAST(round(`subtotal` * 100) AS integer),
       `tax_amount_cents` = CAST(round(`tax_amount` * 100) AS integer),
       `service_charge_cents` = CAST(round(`service_charge` * 100) AS integer),
       `discount_amount_cents` = CAST(round(`discount_amount` * 100) AS integer),
       `total_amount_cents` = CAST(round(`total_amount` * 100) AS integer),
       `refund_amount_cents` = CASE WHEN `refund_amount` IS NULL THEN NULL ELSE CAST(round(`refund_amount` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `order_items` ADD COLUMN `unit_price_cents` integer;
--> statement-breakpoint
ALTER TABLE `order_items` ADD COLUMN `total_price_cents` integer;
--> statement-breakpoint
UPDATE `order_items`
   SET `unit_price_cents` = CAST(round(`unit_price` * 100) AS integer),
       `total_price_cents` = CAST(round(`total_price` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `menu_items` ADD COLUMN `price_cents` integer;
--> statement-breakpoint
ALTER TABLE `menu_items` ADD COLUMN `original_price_cents` integer;
--> statement-breakpoint
ALTER TABLE `menu_items` ADD COLUMN `cost_price_cents` integer;
--> statement-breakpoint
UPDATE `menu_items`
   SET `price_cents` = CAST(round(`price` * 100) AS integer),
       `original_price_cents` = CASE WHEN `original_price` IS NULL THEN NULL ELSE CAST(round(`original_price` * 100) AS integer) END,
       `cost_price_cents` = CASE WHEN `cost_price` IS NULL THEN NULL ELSE CAST(round(`cost_price` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `coupons` ADD COLUMN `discount_value_cents` integer;
--> statement-breakpoint
ALTER TABLE `coupons` ADD COLUMN `max_discount_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `coupons` ADD COLUMN `min_order_amount_cents` integer;
--> statement-breakpoint
UPDATE `coupons`
   SET `discount_value_cents` = CASE WHEN `discount_type` = 'percentage' THEN NULL ELSE CAST(round(`discount_value` * 100) AS integer) END,
       `max_discount_amount_cents` = CASE WHEN `max_discount_amount` IS NULL THEN NULL ELSE CAST(round(`max_discount_amount` * 100) AS integer) END,
       `min_order_amount_cents` = CASE WHEN `min_order_amount` IS NULL THEN NULL ELSE CAST(round(`min_order_amount` * 100) AS integer) END;
--> statement-breakpoint

ALTER TABLE `coupon_usage` ADD COLUMN `discount_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `coupon_usage` ADD COLUMN `original_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `coupon_usage` ADD COLUMN `final_amount_cents` integer;
--> statement-breakpoint
UPDATE `coupon_usage`
   SET `discount_amount_cents` = CAST(round(`discount_amount` * 100) AS integer),
       `original_amount_cents` = CAST(round(`original_amount` * 100) AS integer),
       `final_amount_cents` = CAST(round(`final_amount` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `group_orders` ADD COLUMN `total_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `tax_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `service_charge_cents` integer;
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `final_amount_cents` integer;
--> statement-breakpoint
UPDATE `group_orders`
   SET `total_amount_cents` = CAST(round(`total_amount` * 100) AS integer),
       `tax_amount_cents` = CAST(round(`tax_amount` * 100) AS integer),
       `service_charge_cents` = CAST(round(`service_charge` * 100) AS integer),
       `final_amount_cents` = CAST(round(`final_amount` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `group_cart_items` ADD COLUMN `unit_price_cents` integer;
--> statement-breakpoint
ALTER TABLE `group_cart_items` ADD COLUMN `total_price_cents` integer;
--> statement-breakpoint
UPDATE `group_cart_items`
   SET `unit_price_cents` = CAST(round(`unit_price` * 100) AS integer),
       `total_price_cents` = CAST(round(`total_price` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `split_bills` ADD COLUMN `subtotal_cents` integer;
--> statement-breakpoint
ALTER TABLE `split_bills` ADD COLUMN `tax_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `split_bills` ADD COLUMN `service_charge_cents` integer;
--> statement-breakpoint
ALTER TABLE `split_bills` ADD COLUMN `discount_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `split_bills` ADD COLUMN `tip_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `split_bills` ADD COLUMN `total_amount_cents` integer;
--> statement-breakpoint
UPDATE `split_bills`
   SET `subtotal_cents` = CAST(round(`subtotal` * 100) AS integer),
       `tax_amount_cents` = CAST(round(`tax_amount` * 100) AS integer),
       `service_charge_cents` = CAST(round(`service_charge` * 100) AS integer),
       `discount_amount_cents` = CAST(round(`discount_amount` * 100) AS integer),
       `tip_amount_cents` = CAST(round(`tip_amount` * 100) AS integer),
       `total_amount_cents` = CAST(round(`total_amount` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `cash_shifts` ADD COLUMN `start_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `end_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `expected_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `actual_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `difference_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `total_sales_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `total_refunds_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `cash_sales_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `card_sales_cents` integer;
--> statement-breakpoint
ALTER TABLE `cash_shifts` ADD COLUMN `digital_sales_cents` integer;
--> statement-breakpoint
UPDATE `cash_shifts`
   SET `start_amount_cents` = CAST(round(`start_amount` * 100) AS integer),
       `end_amount_cents` = CASE WHEN `end_amount` IS NULL THEN NULL ELSE CAST(round(`end_amount` * 100) AS integer) END,
       `expected_amount_cents` = CAST(round(`expected_amount` * 100) AS integer),
       `actual_amount_cents` = CASE WHEN `actual_amount` IS NULL THEN NULL ELSE CAST(round(`actual_amount` * 100) AS integer) END,
       `difference_amount_cents` = CAST(round(`difference_amount` * 100) AS integer),
       `total_sales_cents` = CAST(round(`total_sales` * 100) AS integer),
       `total_refunds_cents` = CAST(round(`total_refunds` * 100) AS integer),
       `cash_sales_cents` = CAST(round(`cash_sales` * 100) AS integer),
       `card_sales_cents` = CAST(round(`card_sales` * 100) AS integer),
       `digital_sales_cents` = CAST(round(`digital_sales` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `cash_movements` ADD COLUMN `amount_cents` integer;
--> statement-breakpoint
UPDATE `cash_movements`
   SET `amount_cents` = CAST(round(`amount` * 100) AS integer);
--> statement-breakpoint

ALTER TABLE `refunds` ADD COLUMN `original_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `refunds` ADD COLUMN `refund_amount_cents` integer;
--> statement-breakpoint
UPDATE `refunds`
   SET `original_amount_cents` = CAST(round(`original_amount` * 100) AS integer),
       `refund_amount_cents` = CAST(round(`refund_amount` * 100) AS integer);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Money precision audit snapshots
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'orders', 'amounts', 'non_cent_real_value', 'warning',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `orders`
     WHERE abs(round(`subtotal` * 100) - (`subtotal` * 100)) > 0.000001
        OR abs(round(`tax_amount` * 100) - (`tax_amount` * 100)) > 0.000001
        OR abs(round(`service_charge` * 100) - (`service_charge` * 100)) > 0.000001
        OR abs(round(`discount_amount` * 100) - (`discount_amount` * 100)) > 0.000001
        OR abs(round(`total_amount` * 100) - (`total_amount` * 100)) > 0.000001
        OR (`refund_amount` IS NOT NULL AND abs(round(`refund_amount` * 100) - (`refund_amount` * 100)) > 0.000001)
     LIMIT 5
  )),
  'REAL money values with more than two decimal places; cents shadow columns round to nearest cent and require business review.'
FROM `orders`
WHERE abs(round(`subtotal` * 100) - (`subtotal` * 100)) > 0.000001
   OR abs(round(`tax_amount` * 100) - (`tax_amount` * 100)) > 0.000001
   OR abs(round(`service_charge` * 100) - (`service_charge` * 100)) > 0.000001
   OR abs(round(`discount_amount` * 100) - (`discount_amount` * 100)) > 0.000001
   OR abs(round(`total_amount` * 100) - (`total_amount` * 100)) > 0.000001
   OR (`refund_amount` IS NOT NULL AND abs(round(`refund_amount` * 100) - (`refund_amount` * 100)) > 0.000001);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'order_items', 'amounts', 'non_cent_real_value', 'warning',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `order_items`
     WHERE abs(round(`unit_price` * 100) - (`unit_price` * 100)) > 0.000001
        OR abs(round(`total_price` * 100) - (`total_price` * 100)) > 0.000001
     LIMIT 5
  )),
  'REAL money values with more than two decimal places; cents shadow columns round to nearest cent and require business review.'
FROM `order_items`
WHERE abs(round(`unit_price` * 100) - (`unit_price` * 100)) > 0.000001
   OR abs(round(`total_price` * 100) - (`total_price` * 100)) > 0.000001;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'menu_items', 'amounts', 'non_cent_real_value', 'warning',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `menu_items`
     WHERE abs(round(`price` * 100) - (`price` * 100)) > 0.000001
        OR (`original_price` IS NOT NULL AND abs(round(`original_price` * 100) - (`original_price` * 100)) > 0.000001)
        OR (`cost_price` IS NOT NULL AND abs(round(`cost_price` * 100) - (`cost_price` * 100)) > 0.000001)
     LIMIT 5
  )),
  'REAL money values with more than two decimal places; cents shadow columns round to nearest cent and require business review.'
FROM `menu_items`
WHERE abs(round(`price` * 100) - (`price` * 100)) > 0.000001
   OR (`original_price` IS NOT NULL AND abs(round(`original_price` * 100) - (`original_price` * 100)) > 0.000001)
   OR (`cost_price` IS NOT NULL AND abs(round(`cost_price` * 100) - (`cost_price` * 100)) > 0.000001);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'coupons', 'amounts', 'non_cent_real_value', 'warning',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `coupons`
     WHERE (`discount_type` != 'percentage' AND abs(round(`discount_value` * 100) - (`discount_value` * 100)) > 0.000001)
        OR (`max_discount_amount` IS NOT NULL AND abs(round(`max_discount_amount` * 100) - (`max_discount_amount` * 100)) > 0.000001)
        OR (`min_order_amount` IS NOT NULL AND abs(round(`min_order_amount` * 100) - (`min_order_amount` * 100)) > 0.000001)
     LIMIT 5
  )),
  'REAL money values with more than two decimal places; percentage discount_value is intentionally excluded.'
FROM `coupons`
WHERE (`discount_type` != 'percentage' AND abs(round(`discount_value` * 100) - (`discount_value` * 100)) > 0.000001)
   OR (`max_discount_amount` IS NOT NULL AND abs(round(`max_discount_amount` * 100) - (`max_discount_amount` * 100)) > 0.000001)
   OR (`min_order_amount` IS NOT NULL AND abs(round(`min_order_amount` * 100) - (`min_order_amount` * 100)) > 0.000001);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_precision', 'pos', 'amounts', 'non_cent_real_value', 'warning',
  (
    (SELECT count(*) FROM `cash_shifts`
      WHERE abs(round(`start_amount` * 100) - (`start_amount` * 100)) > 0.000001
         OR (`end_amount` IS NOT NULL AND abs(round(`end_amount` * 100) - (`end_amount` * 100)) > 0.000001)
         OR abs(round(`expected_amount` * 100) - (`expected_amount` * 100)) > 0.000001
         OR (`actual_amount` IS NOT NULL AND abs(round(`actual_amount` * 100) - (`actual_amount` * 100)) > 0.000001)
         OR abs(round(`difference_amount` * 100) - (`difference_amount` * 100)) > 0.000001
         OR abs(round(`total_sales` * 100) - (`total_sales` * 100)) > 0.000001
         OR abs(round(`total_refunds` * 100) - (`total_refunds` * 100)) > 0.000001
         OR abs(round(`cash_sales` * 100) - (`cash_sales` * 100)) > 0.000001
         OR abs(round(`card_sales` * 100) - (`card_sales` * 100)) > 0.000001
         OR abs(round(`digital_sales` * 100) - (`digital_sales` * 100)) > 0.000001)
    +
    (SELECT count(*) FROM `cash_movements`
      WHERE abs(round(`amount` * 100) - (`amount` * 100)) > 0.000001)
    +
    (SELECT count(*) FROM `refunds`
      WHERE abs(round(`original_amount` * 100) - (`original_amount` * 100)) > 0.000001
         OR abs(round(`refund_amount` * 100) - (`refund_amount` * 100)) > 0.000001)
  ),
  NULL,
  'REAL money values with more than two decimal places in POS tables; cents shadow columns round to nearest cent and require business review.';
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Cents sync triggers for future writes
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS `orders_cents_sync_ai`
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
CREATE TRIGGER IF NOT EXISTS `orders_cents_sync_au`
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

CREATE TRIGGER IF NOT EXISTS `order_items_cents_sync_ai`
AFTER INSERT ON `order_items`
FOR EACH ROW
BEGIN
  UPDATE `order_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `order_items_cents_sync_au`
AFTER UPDATE OF `unit_price`, `total_price` ON `order_items`
FOR EACH ROW
BEGIN
  UPDATE `order_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `menu_items_cents_sync_ai`
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
CREATE TRIGGER IF NOT EXISTS `menu_items_cents_sync_au`
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

CREATE TRIGGER IF NOT EXISTS `coupons_cents_sync_ai`
AFTER INSERT ON `coupons`
FOR EACH ROW
BEGIN
  UPDATE `coupons`
     SET `discount_value_cents` = CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` = CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` = CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `coupons_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `max_discount_amount`, `min_order_amount` ON `coupons`
FOR EACH ROW
BEGIN
  UPDATE `coupons`
     SET `discount_value_cents` = CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` = CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` = CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `coupon_usage_cents_sync_ai`
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
CREATE TRIGGER IF NOT EXISTS `coupon_usage_cents_sync_au`
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

CREATE TRIGGER IF NOT EXISTS `group_orders_cents_sync_ai`
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
CREATE TRIGGER IF NOT EXISTS `group_orders_cents_sync_au`
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

CREATE TRIGGER IF NOT EXISTS `group_cart_items_cents_sync_ai`
AFTER INSERT ON `group_cart_items`
FOR EACH ROW
BEGIN
  UPDATE `group_cart_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `group_cart_items_cents_sync_au`
AFTER UPDATE OF `unit_price`, `total_price` ON `group_cart_items`
FOR EACH ROW
BEGIN
  UPDATE `group_cart_items`
     SET `unit_price_cents` = CAST(round(NEW.`unit_price` * 100) AS integer),
         `total_price_cents` = CAST(round(NEW.`total_price` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `split_bills_cents_sync_ai`
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
CREATE TRIGGER IF NOT EXISTS `split_bills_cents_sync_au`
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

CREATE TRIGGER IF NOT EXISTS `cash_shifts_cents_sync_ai`
AFTER INSERT ON `cash_shifts`
FOR EACH ROW
BEGIN
  UPDATE `cash_shifts`
     SET `start_amount_cents` = CAST(round(NEW.`start_amount` * 100) AS integer),
         `end_amount_cents` = CASE WHEN NEW.`end_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`end_amount` * 100) AS integer) END,
         `expected_amount_cents` = CAST(round(NEW.`expected_amount` * 100) AS integer),
         `actual_amount_cents` = CASE WHEN NEW.`actual_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`actual_amount` * 100) AS integer) END,
         `difference_amount_cents` = CAST(round(NEW.`difference_amount` * 100) AS integer),
         `total_sales_cents` = CAST(round(NEW.`total_sales` * 100) AS integer),
         `total_refunds_cents` = CAST(round(NEW.`total_refunds` * 100) AS integer),
         `cash_sales_cents` = CAST(round(NEW.`cash_sales` * 100) AS integer),
         `card_sales_cents` = CAST(round(NEW.`card_sales` * 100) AS integer),
         `digital_sales_cents` = CAST(round(NEW.`digital_sales` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `cash_shifts_cents_sync_au`
AFTER UPDATE OF `start_amount`, `end_amount`, `expected_amount`, `actual_amount`, `difference_amount`, `total_sales`, `total_refunds`, `cash_sales`, `card_sales`, `digital_sales` ON `cash_shifts`
FOR EACH ROW
BEGIN
  UPDATE `cash_shifts`
     SET `start_amount_cents` = CAST(round(NEW.`start_amount` * 100) AS integer),
         `end_amount_cents` = CASE WHEN NEW.`end_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`end_amount` * 100) AS integer) END,
         `expected_amount_cents` = CAST(round(NEW.`expected_amount` * 100) AS integer),
         `actual_amount_cents` = CASE WHEN NEW.`actual_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`actual_amount` * 100) AS integer) END,
         `difference_amount_cents` = CAST(round(NEW.`difference_amount` * 100) AS integer),
         `total_sales_cents` = CAST(round(NEW.`total_sales` * 100) AS integer),
         `total_refunds_cents` = CAST(round(NEW.`total_refunds` * 100) AS integer),
         `cash_sales_cents` = CAST(round(NEW.`cash_sales` * 100) AS integer),
         `card_sales_cents` = CAST(round(NEW.`card_sales` * 100) AS integer),
         `digital_sales_cents` = CAST(round(NEW.`digital_sales` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `cash_movements_cents_sync_ai`
AFTER INSERT ON `cash_movements`
FOR EACH ROW
BEGIN
  UPDATE `cash_movements`
     SET `amount_cents` = CAST(round(NEW.`amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `cash_movements_cents_sync_au`
AFTER UPDATE OF `amount` ON `cash_movements`
FOR EACH ROW
BEGIN
  UPDATE `cash_movements`
     SET `amount_cents` = CAST(round(NEW.`amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `refunds_cents_sync_ai`
AFTER INSERT ON `refunds`
FOR EACH ROW
BEGIN
  UPDATE `refunds`
     SET `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `refund_amount_cents` = CAST(round(NEW.`refund_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `refunds_cents_sync_au`
AFTER UPDATE OF `original_amount`, `refund_amount` ON `refunds`
FOR EACH ROW
BEGIN
  UPDATE `refunds`
     SET `original_amount_cents` = CAST(round(NEW.`original_amount` * 100) AS integer),
         `refund_amount_cents` = CAST(round(NEW.`refund_amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
