-- Tenant-local customer-directory projection for issue #299.
--
-- `customers` remains platform-wide. This table is the deliberately scoped
-- membership and rollup record which a restaurant may read through its opaque
-- id; it prevents a customer id from becoming a cross-tenant identifier.
CREATE TABLE `restaurant_customers` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `restaurant_id` TEXT NOT NULL,
  `customer_id` TEXT NOT NULL,
  `order_count` INTEGER NOT NULL DEFAULT 0,
  `cancelled_order_count` INTEGER NOT NULL DEFAULT 0,
  `total_spent_cents` INTEGER NOT NULL DEFAULT 0,
  `first_order_at_ms` INTEGER,
  `last_order_at_ms` INTEGER,
  `tags` TEXT,
  `note` TEXT,
  `is_blocked` INTEGER NOT NULL DEFAULT 0,
  `blocked_reason` TEXT,
  `recomputed_at_ms` INTEGER,
  `created_at_ms` INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  `updated_at_ms` INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  UNIQUE (`restaurant_id`, `customer_id`)
) STRICT;
--> statement-breakpoint
CREATE INDEX `restaurant_customers_recent_idx` ON `restaurant_customers` (`restaurant_id`, `last_order_at_ms`);
--> statement-breakpoint
CREATE INDEX `restaurant_customers_spend_idx` ON `restaurant_customers` (`restaurant_id`, `total_spent_cents`);
--> statement-breakpoint
CREATE INDEX `restaurant_customers_orders_idx` ON `restaurant_customers` (`restaurant_id`, `order_count`);
--> statement-breakpoint
CREATE INDEX `restaurant_customers_customer_idx` ON `restaurant_customers` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `orders_restaurant_customer_idx` ON `orders` (`restaurant_id`, `customer_id`, `created_at_ms`);
--> statement-breakpoint
CREATE TRIGGER `restaurant_customers_restaurant_guard_bi`
BEFORE INSERT ON `restaurant_customers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'restaurant_customers.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER `restaurant_customers_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `restaurant_customers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'restaurant_customers.restaurant_id references missing restaurants.id');
END;
