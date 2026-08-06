-- 0080: group_orders guest host foundation
--
-- Group orders can now be created by a guest, so created_by is nullable.
-- recovery_code is a host-only bearer secret returned once at creation.

DROP TABLE IF EXISTS `__new_group_orders`;
--> statement-breakpoint

CREATE TABLE `__new_group_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`share_code` text NOT NULL,
	`master_order_id` TEXT,
	`created_by` TEXT,
	`recovery_code` TEXT NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`split_type` text DEFAULT 'individual' NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`locked_at_ms` integer,
	`completed_at_ms` integer,
	`settings` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`total_amount_cents` integer,
	`tax_amount_cents` integer,
	`service_charge_cents` integer,
	`final_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `__new_group_orders` (
  `id`, `share_code`, `master_order_id`, `created_by`, `recovery_code`,
  `restaurant_id`, `table_id`, `status`, `split_type`,
  `expires_at_ms`, `locked_at_ms`, `completed_at_ms`, `settings`, `notes`,
  `created_at_ms`, `updated_at_ms`,
  `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents`
)
SELECT
  `id`, `share_code`, `master_order_id`, `created_by`, lower(hex(randomblob(16))),
  `restaurant_id`, `table_id`, `status`, `split_type`,
  `expires_at_ms`, `locked_at_ms`, `completed_at_ms`, `settings`, `notes`,
  `created_at_ms`, `updated_at_ms`,
  `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents`
FROM `group_orders`;
--> statement-breakpoint

DROP TABLE `group_orders`;
--> statement-breakpoint

ALTER TABLE `__new_group_orders` RENAME TO `group_orders`;
--> statement-breakpoint

CREATE UNIQUE INDEX `group_orders_share_code_unique` ON `group_orders` (`share_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_orders_recovery_code_unique` ON `group_orders` (`recovery_code`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_expires` ON `group_orders` (`expires_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_restaurant_status` ON `group_orders` (`restaurant_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_status_created` ON `group_orders` (`status`,`created_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_group_orders_table` ON `group_orders` (`table_id`);
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
