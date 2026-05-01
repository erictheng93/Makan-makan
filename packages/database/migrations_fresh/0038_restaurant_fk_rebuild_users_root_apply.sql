-- 0038 restaurant FK rebuild for users root component apply phase.
-- Continues 0037 by rebuilding users and dependent tables from staged data.
DROP TABLE `audit_logs`;
--> statement-breakpoint

DROP TABLE `cash_movements`;
--> statement-breakpoint

DROP TABLE `coupon_distributions`;
--> statement-breakpoint

DROP TABLE `coupon_templates`;
--> statement-breakpoint

DROP TABLE `coupon_usage`;
--> statement-breakpoint

DROP TABLE `email_verification_tokens`;
--> statement-breakpoint

DROP TABLE `employee_availability`;
--> statement-breakpoint

DROP TABLE `employee_leave_balances`;
--> statement-breakpoint

DROP TABLE `group_activity_logs`;
--> statement-breakpoint

DROP TABLE `group_cart_items`;
--> statement-breakpoint

DROP TABLE `leave_approval_rules`;
--> statement-breakpoint

DROP TABLE `leave_calendar_events`;
--> statement-breakpoint

DROP TABLE `leave_requests`;
--> statement-breakpoint

DROP TABLE `order_items`;
--> statement-breakpoint

DROP TABLE `partnership_usage_logs`;
--> statement-breakpoint

DROP TABLE `password_change_logs`;
--> statement-breakpoint

DROP TABLE `password_reset_tokens`;
--> statement-breakpoint

DROP TABLE `phone_verification_tokens`;
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

DROP TABLE `schedule_swap_requests`;
--> statement-breakpoint

DROP TABLE `scheduling_conflicts`;
--> statement-breakpoint

DROP TABLE `sessions`;
--> statement-breakpoint

DROP TABLE `share_codes`;
--> statement-breakpoint

DROP TABLE `shift_reports`;
--> statement-breakpoint

DROP TABLE `split_bills`;
--> statement-breakpoint

DROP TABLE `waiting_list`;
--> statement-breakpoint

DROP TABLE `cash_shifts`;
--> statement-breakpoint

DROP TABLE `coupons`;
--> statement-breakpoint

DROP TABLE `employee_schedules`;
--> statement-breakpoint

DROP TABLE `group_members`;
--> statement-breakpoint

DROP TABLE `leave_types`;
--> statement-breakpoint

DROP TABLE `partnership_plans`;
--> statement-breakpoint

DROP TABLE `payment_transactions`;
--> statement-breakpoint

DROP TABLE `scheduling_rules`;
--> statement-breakpoint

DROP TABLE `verified_members`;
--> statement-breakpoint

DROP TABLE `group_orders`;
--> statement-breakpoint

DROP TABLE `orders`;
--> statement-breakpoint

DROP TABLE `partnerships`;
--> statement-breakpoint

DROP TABLE `shift_templates`;
--> statement-breakpoint

DROP TABLE `users`;
--> statement-breakpoint

CREATE TABLE "users" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`phone` text,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` integer DEFAULT 4 NOT NULL,
	`restaurant_id` text,
	`address` text,
	`date_of_birth` text,
	`profile_image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`preferences` text,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`total_spent` integer DEFAULT 0 NOT NULL,
	`last_login_at_ms` integer,
	`password_changed_at_ms` integer,
	`email_verified_at_ms` integer,
	`phone_verified_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer
, token_version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `users` (
  `id`,
  `username`,
  `email`,
  `phone`,
  `full_name`,
  `password_hash`,
  `role`,
  `restaurant_id`,
  `address`,
  `date_of_birth`,
  `profile_image_url`,
  `is_active`,
  `is_verified`,
  `preferences`,
  `total_orders`,
  `total_spent`,
  `last_login_at_ms`,
  `password_changed_at_ms`,
  `email_verified_at_ms`,
  `phone_verified_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `token_version`
)
SELECT
  `id`,
  `username`,
  `email`,
  `phone`,
  `full_name`,
  `password_hash`,
  `role`,
  `restaurant_id`,
  `address`,
  `date_of_birth`,
  `profile_image_url`,
  `is_active`,
  `is_verified`,
  `preferences`,
  `total_orders`,
  `total_spent`,
  `last_login_at_ms`,
  `password_changed_at_ms`,
  `email_verified_at_ms`,
  `phone_verified_at_ms`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `token_version`
FROM `users__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'users.final', (SELECT count(*) FROM `users__component_rebuild_data`), (SELECT count(*) FROM `users`);
--> statement-breakpoint

CREATE INDEX `users_restaurant_role_active_idx`
  ON `users` (`restaurant_id`, `role`, `is_active`);
--> statement-breakpoint

CREATE INDEX users_token_version_idx ON users(id, token_version);
--> statement-breakpoint

CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint

CREATE TRIGGER `users_restaurant_guard_bi`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'users.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `users_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `users`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'users.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE `shift_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`shift_type` text DEFAULT 'regular' NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`is_split_shift` integer DEFAULT false NOT NULL,
	`break_start_time` text,
	`break_end_time` text,
	`break_duration_minutes` integer DEFAULT 0,
	`applicable_days` text DEFAULT '[]',
	`min_employees` integer DEFAULT 1,
	`max_employees` integer DEFAULT 10,
	`hourly_rate` real,
	`overtime_multiplier` real DEFAULT 1.5,
	`color_code` text DEFAULT '#3B82F6',
	`icon` text,
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
	`hourly_rate_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `shift_templates` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `shift_type`,
  `start_time`,
  `end_time`,
  `duration_minutes`,
  `is_split_shift`,
  `break_start_time`,
  `break_end_time`,
  `break_duration_minutes`,
  `applicable_days`,
  `min_employees`,
  `max_employees`,
  `hourly_rate`,
  `overtime_multiplier`,
  `color_code`,
  `icon`,
  `sort_order`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `hourly_rate_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `shift_type`,
  `start_time`,
  `end_time`,
  `duration_minutes`,
  `is_split_shift`,
  `break_start_time`,
  `break_end_time`,
  `break_duration_minutes`,
  `applicable_days`,
  `min_employees`,
  `max_employees`,
  `hourly_rate`,
  `overtime_multiplier`,
  `color_code`,
  `icon`,
  `sort_order`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `hourly_rate_cents`
FROM `shift_templates__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'shift_templates.final', (SELECT count(*) FROM `shift_templates__component_rebuild_data`), (SELECT count(*) FROM `shift_templates`);
--> statement-breakpoint

CREATE INDEX `idx_shift_templates_restaurant_active` ON `shift_templates` (`restaurant_id`,`is_active`);
--> statement-breakpoint

CREATE TRIGGER `shift_templates_hourly_cents_sync_ai`
AFTER INSERT ON `shift_templates`
FOR EACH ROW
BEGIN
  UPDATE `shift_templates`
     SET `hourly_rate_cents` = CASE WHEN NEW.`hourly_rate` IS NULL THEN NULL ELSE CAST(round(NEW.`hourly_rate` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `shift_templates_hourly_cents_sync_au`
AFTER UPDATE OF `hourly_rate` ON `shift_templates`
FOR EACH ROW
BEGIN
  UPDATE `shift_templates`
     SET `hourly_rate_cents` = CASE WHEN NEW.`hourly_rate` IS NULL THEN NULL ELSE CAST(round(NEW.`hourly_rate` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `shift_templates_restaurant_guard_bi`
BEFORE INSERT ON `shift_templates`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shift_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `shift_templates_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `shift_templates`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shift_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "partnerships" (
	`id` text PRIMARY KEY NOT NULL,
	`partner_code` text NOT NULL,
	`partner_name` text NOT NULL,
	`partner_name_en` text,
	`partner_type` text NOT NULL,
	`contact_person` text NOT NULL,
	`contact_title` text,
	`contact_phone` text NOT NULL,
	`contact_email` text NOT NULL,
	`address` text,
	`contract_number` text,
	"contract_start_date_ms" integer NOT NULL,
	"contract_end_date_ms" integer NOT NULL,
	`contract_document_url` text,
	`verification_method` text DEFAULT 'manual' NOT NULL,
	`verification_config` text DEFAULT '{}',
	`allowed_email_domains` text DEFAULT '[]',
	`default_discount_type` text,
	`default_discount_value` real,
	`total_verified_members` integer DEFAULT 0,
	`total_usage_count` integer DEFAULT 0,
	`total_discount_given` real DEFAULT 0,
	`total_revenue` real DEFAULT 0,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_active` integer DEFAULT true,
	`logo_url` text,
	`description` text,
	`notes` text,
	`tags` text DEFAULT '[]',
	`metadata` text DEFAULT '{}',
	"created_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	"updated_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`created_by` integer, deleted_at_ms INTEGER, `default_discount_value_cents` integer, `total_discount_given_cents` integer, `total_revenue_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `partnerships` (
  `id`,
  `partner_code`,
  `partner_name`,
  `partner_name_en`,
  `partner_type`,
  `contact_person`,
  `contact_title`,
  `contact_phone`,
  `contact_email`,
  `address`,
  `contract_number`,
  `contract_start_date_ms`,
  `contract_end_date_ms`,
  `contract_document_url`,
  `verification_method`,
  `verification_config`,
  `allowed_email_domains`,
  `default_discount_type`,
  `default_discount_value`,
  `total_verified_members`,
  `total_usage_count`,
  `total_discount_given`,
  `total_revenue`,
  `status`,
  `is_active`,
  `logo_url`,
  `description`,
  `notes`,
  `tags`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `default_discount_value_cents`,
  `total_discount_given_cents`,
  `total_revenue_cents`
)
SELECT
  `id`,
  `partner_code`,
  `partner_name`,
  `partner_name_en`,
  `partner_type`,
  `contact_person`,
  `contact_title`,
  `contact_phone`,
  `contact_email`,
  `address`,
  `contract_number`,
  `contract_start_date_ms`,
  `contract_end_date_ms`,
  `contract_document_url`,
  `verification_method`,
  `verification_config`,
  `allowed_email_domains`,
  `default_discount_type`,
  `default_discount_value`,
  `total_verified_members`,
  `total_usage_count`,
  `total_discount_given`,
  `total_revenue`,
  `status`,
  `is_active`,
  `logo_url`,
  `description`,
  `notes`,
  `tags`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `default_discount_value_cents`,
  `total_discount_given_cents`,
  `total_revenue_cents`
FROM `partnerships__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'partnerships.final', (SELECT count(*) FROM `partnerships__component_rebuild_data`), (SELECT count(*) FROM `partnerships`);
--> statement-breakpoint

CREATE INDEX `idx_partnerships_code` ON `partnerships` (`partner_code`);
--> statement-breakpoint

CREATE INDEX `idx_partnerships_contract_dates` ON `partnerships` ("contract_start_date_ms","contract_end_date_ms");
--> statement-breakpoint

CREATE INDEX `idx_partnerships_status` ON `partnerships` (`status`,`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_partnerships_type` ON `partnerships` (`partner_type`);
--> statement-breakpoint

CREATE UNIQUE INDEX `partnerships_contract_number_unique` ON `partnerships` (`contract_number`);
--> statement-breakpoint

CREATE UNIQUE INDEX `partnerships_partner_code_unique` ON `partnerships` (`partner_code`);
--> statement-breakpoint

CREATE TRIGGER `partnerships_cents_sync_ai`
AFTER INSERT ON `partnerships`
FOR EACH ROW
BEGIN
  UPDATE `partnerships`
     SET `default_discount_value_cents` =
           CASE
             WHEN NEW.`default_discount_value` IS NULL OR NEW.`default_discount_type` = 'percentage'
               THEN NULL
             ELSE CAST(round(NEW.`default_discount_value` * 100) AS integer)
           END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `partnerships_cents_sync_au`
AFTER UPDATE OF `default_discount_type`, `default_discount_value`, `total_discount_given`, `total_revenue` ON `partnerships`
FOR EACH ROW
BEGIN
  UPDATE `partnerships`
     SET `default_discount_value_cents` =
           CASE
             WHEN NEW.`default_discount_value` IS NULL OR NEW.`default_discount_type` = 'percentage'
               THEN NULL
             ELSE CAST(round(NEW.`default_discount_value` * 100) AS integer)
           END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

CREATE TABLE "verified_members" (
	`id` text PRIMARY KEY NOT NULL,
	`partnership_id` text NOT NULL,
	`customer_id` text,
	`member_id` text NOT NULL,
	`member_type` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text,
	`phone` text,
	`verification_method` text NOT NULL,
	`verification_document_url` text,
	"verified_at_ms" integer,
	`verified_by` integer,
	"verification_expiry_ms" integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`total_usage_count` integer DEFAULT 0,
	`total_discount_received` real DEFAULT 0,
	`total_spending` real DEFAULT 0,
	"last_used_at_ms" integer,
	`department` text,
	`grade_or_position` text,
	`student_id_photo_url` text,
	`notes` text,
	`metadata` text DEFAULT '{}',
	"created_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	"updated_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL, deleted_at_ms INTEGER, `total_discount_received_cents` integer, `total_spending_cents` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `verified_members` (
  `id`,
  `partnership_id`,
  `customer_id`,
  `member_id`,
  `member_type`,
  `full_name`,
  `email`,
  `phone`,
  `verification_method`,
  `verification_document_url`,
  `verified_at_ms`,
  `verified_by`,
  `verification_expiry_ms`,
  `status`,
  `rejection_reason`,
  `total_usage_count`,
  `total_discount_received`,
  `total_spending`,
  `last_used_at_ms`,
  `department`,
  `grade_or_position`,
  `student_id_photo_url`,
  `notes`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `total_discount_received_cents`,
  `total_spending_cents`
)
SELECT
  `id`,
  `partnership_id`,
  `customer_id`,
  `member_id`,
  `member_type`,
  `full_name`,
  `email`,
  `phone`,
  `verification_method`,
  `verification_document_url`,
  `verified_at_ms`,
  `verified_by`,
  `verification_expiry_ms`,
  `status`,
  `rejection_reason`,
  `total_usage_count`,
  `total_discount_received`,
  `total_spending`,
  `last_used_at_ms`,
  `department`,
  `grade_or_position`,
  `student_id_photo_url`,
  `notes`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`,
  `total_discount_received_cents`,
  `total_spending_cents`
FROM `verified_members__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'verified_members.final', (SELECT count(*) FROM `verified_members__component_rebuild_data`), (SELECT count(*) FROM `verified_members`);
--> statement-breakpoint

CREATE INDEX `idx_verified_members_customer` ON `verified_members` (`customer_id`);
--> statement-breakpoint

CREATE INDEX `idx_verified_members_email` ON `verified_members` (`email`);
--> statement-breakpoint

CREATE INDEX `idx_verified_members_member_id` ON `verified_members` (`partnership_id`,`member_id`);
--> statement-breakpoint

CREATE INDEX `idx_verified_members_partnership` ON `verified_members` (`partnership_id`);
--> statement-breakpoint

CREATE INDEX `idx_verified_members_status` ON `verified_members` (`status`);
--> statement-breakpoint

CREATE TRIGGER `verified_members_cents_sync_ai`
AFTER INSERT ON `verified_members`
FOR EACH ROW
BEGIN
  UPDATE `verified_members`
     SET `total_discount_received_cents` =
           CASE WHEN NEW.`total_discount_received` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_received` * 100) AS integer) END,
         `total_spending_cents` =
           CASE WHEN NEW.`total_spending` IS NULL THEN NULL ELSE CAST(round(NEW.`total_spending` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `verified_members_cents_sync_au`
AFTER UPDATE OF `total_discount_received`, `total_spending` ON `verified_members`
FOR EACH ROW
BEGIN
  UPDATE `verified_members`
     SET `total_discount_received_cents` =
           CASE WHEN NEW.`total_discount_received` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_received` * 100) AS integer) END,
         `total_spending_cents` =
           CASE WHEN NEW.`total_spending` IS NULL THEN NULL ELSE CAST(round(NEW.`total_spending` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE "scheduling_rules" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rule_type` text NOT NULL,
	`rule_config` text NOT NULL,
	`applies_to_roles` text,
	`applies_to_employees` text,
	`priority` integer DEFAULT 0,
	`severity` text DEFAULT 'warning' NOT NULL,
	`is_system_rule` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `scheduling_rules` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `rule_type`,
  `rule_config`,
  `applies_to_roles`,
  `applies_to_employees`,
  `priority`,
  `severity`,
  `is_system_rule`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `rule_type`,
  `rule_config`,
  `applies_to_roles`,
  `applies_to_employees`,
  `priority`,
  `severity`,
  `is_system_rule`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`
FROM `scheduling_rules__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'scheduling_rules.final', (SELECT count(*) FROM `scheduling_rules__component_rebuild_data`), (SELECT count(*) FROM `scheduling_rules`);
--> statement-breakpoint

CREATE INDEX `idx_scheduling_rules_restaurant_type_active` ON `scheduling_rules` (`restaurant_id`,`rule_type`,`is_active`);
--> statement-breakpoint

CREATE TRIGGER `scheduling_rules_restaurant_guard_bi`
BEFORE INSERT ON `scheduling_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `scheduling_rules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `scheduling_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_rules.restaurant_id references missing restaurants.id');
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

CREATE TABLE "partnership_plans" (
	`id` text PRIMARY KEY NOT NULL,
	`partnership_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`plan_code` text NOT NULL,
	`plan_name` text NOT NULL,
	`plan_name_en` text,
	`description` text,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`max_discount_amount` real,
	`min_order_amount` real DEFAULT 0,
	`max_order_amount` real,
	`applicable_menu_items` text DEFAULT '[]',
	`applicable_categories` text DEFAULT '[]',
	`excluded_menu_items` text DEFAULT '[]',
	`excluded_categories` text DEFAULT '[]',
	`applicable_days` text DEFAULT '[]',
	`applicable_time_slots` text DEFAULT '[]',
	`usage_limit_per_member` integer,
	`usage_limit_per_day` integer,
	`daily_usage_count` integer DEFAULT 0,
	`total_usage_count` integer DEFAULT 0,
	"valid_from_ms" integer NOT NULL,
	"valid_to_ms" integer NOT NULL,
	`priority` integer DEFAULT 0,
	`can_combine_with_coupons` integer DEFAULT false,
	`can_combine_with_promotions` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`badge_text` text,
	`badge_color` text,
	`show_on_menu` integer DEFAULT true,
	`total_discount_given` real DEFAULT 0,
	`total_revenue` real DEFAULT 0,
	`terms_and_conditions` text,
	`notes` text,
	`metadata` text DEFAULT '{}',
	"created_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	"updated_at_ms" integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`created_by` integer,
	`deleted_at_ms` integer,
	`discount_value_cents` integer,
	`max_discount_amount_cents` integer,
	`min_order_amount_cents` integer,
	`max_order_amount_cents` integer,
	`total_discount_given_cents` integer,
	`total_revenue_cents` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `partnership_plans` (
  `id`,
  `partnership_id`,
  `restaurant_id`,
  `plan_code`,
  `plan_name`,
  `plan_name_en`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `max_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `excluded_menu_items`,
  `excluded_categories`,
  `applicable_days`,
  `applicable_time_slots`,
  `usage_limit_per_member`,
  `usage_limit_per_day`,
  `daily_usage_count`,
  `total_usage_count`,
  `valid_from_ms`,
  `valid_to_ms`,
  `priority`,
  `can_combine_with_coupons`,
  `can_combine_with_promotions`,
  `is_active`,
  `badge_text`,
  `badge_color`,
  `show_on_menu`,
  `total_discount_given`,
  `total_revenue`,
  `terms_and_conditions`,
  `notes`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`,
  `max_order_amount_cents`,
  `total_discount_given_cents`,
  `total_revenue_cents`
)
SELECT
  `id`,
  `partnership_id`,
  `restaurant_id`,
  `plan_code`,
  `plan_name`,
  `plan_name_en`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `max_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `excluded_menu_items`,
  `excluded_categories`,
  `applicable_days`,
  `applicable_time_slots`,
  `usage_limit_per_member`,
  `usage_limit_per_day`,
  `daily_usage_count`,
  `total_usage_count`,
  `valid_from_ms`,
  `valid_to_ms`,
  `priority`,
  `can_combine_with_coupons`,
  `can_combine_with_promotions`,
  `is_active`,
  `badge_text`,
  `badge_color`,
  `show_on_menu`,
  `total_discount_given`,
  `total_revenue`,
  `terms_and_conditions`,
  `notes`,
  `metadata`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`,
  `max_order_amount_cents`,
  `total_discount_given_cents`,
  `total_revenue_cents`
FROM `partnership_plans__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'partnership_plans.final', (SELECT count(*) FROM `partnership_plans__component_rebuild_data`), (SELECT count(*) FROM `partnership_plans`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_code` ON `partnership_plans` (`partnership_id`,`restaurant_id`,`plan_code`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_partnership` ON `partnership_plans` (`partnership_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_restaurant` ON `partnership_plans` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_partnership_plans_valid_period` ON `partnership_plans` ("valid_from_ms","valid_to_ms");
--> statement-breakpoint

CREATE TRIGGER `partnership_plans_cents_sync_ai`
AFTER INSERT ON `partnership_plans`
FOR EACH ROW
BEGIN
  UPDATE `partnership_plans`
     SET `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` =
           CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` =
           CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END,
         `max_order_amount_cents` =
           CASE WHEN NEW.`max_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_order_amount` * 100) AS integer) END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `partnership_plans_cents_sync_au`
AFTER UPDATE OF `discount_type`, `discount_value`, `max_discount_amount`, `min_order_amount`, `max_order_amount`, `total_discount_given`, `total_revenue` ON `partnership_plans`
FOR EACH ROW
BEGIN
  UPDATE `partnership_plans`
     SET `discount_value_cents` =
           CASE WHEN NEW.`discount_type` = 'percentage' THEN NULL ELSE CAST(round(NEW.`discount_value` * 100) AS integer) END,
         `max_discount_amount_cents` =
           CASE WHEN NEW.`max_discount_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_discount_amount` * 100) AS integer) END,
         `min_order_amount_cents` =
           CASE WHEN NEW.`min_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`min_order_amount` * 100) AS integer) END,
         `max_order_amount_cents` =
           CASE WHEN NEW.`max_order_amount` IS NULL THEN NULL ELSE CAST(round(NEW.`max_order_amount` * 100) AS integer) END,
         `total_discount_given_cents` =
           CASE WHEN NEW.`total_discount_given` IS NULL THEN NULL ELSE CAST(round(NEW.`total_discount_given` * 100) AS integer) END,
         `total_revenue_cents` =
           CASE WHEN NEW.`total_revenue` IS NULL THEN NULL ELSE CAST(round(NEW.`total_revenue` * 100) AS integer) END
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `partnership_plans_restaurant_guard_bi`
BEFORE INSERT ON `partnership_plans`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_plans.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `partnership_plans_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `partnership_plans`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_plans.restaurant_id references missing restaurants.id');
END;
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
	`created_by` integer,
	`updated_by` integer,
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_types.final', (SELECT count(*) FROM `leave_types__component_rebuild_data`), (SELECT count(*) FROM `leave_types`);
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

CREATE TABLE `employee_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` integer NOT NULL,
	`shift_template_id` integer,
	`work_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_duration_minutes` integer DEFAULT 0,
	`clock_in_time_ms` integer,
	`clock_out_time_ms` integer,
	`scheduled_hours` real NOT NULL,
	`actual_hours` real DEFAULT 0,
	`overtime_hours` real DEFAULT 0,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`manager_notes` text,
	`confirmed_by` integer,
	`confirmed_at_ms` integer,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_template_id`) REFERENCES `shift_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `employee_schedules` (
  `id`,
  `restaurant_id`,
  `employee_id`,
  `shift_template_id`,
  `work_date`,
  `start_time`,
  `end_time`,
  `break_duration_minutes`,
  `clock_in_time_ms`,
  `clock_out_time_ms`,
  `scheduled_hours`,
  `actual_hours`,
  `overtime_hours`,
  `status`,
  `notes`,
  `manager_notes`,
  `confirmed_by`,
  `confirmed_at_ms`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
)
SELECT
  `id`,
  `restaurant_id`,
  `employee_id`,
  `shift_template_id`,
  `work_date`,
  `start_time`,
  `end_time`,
  `break_duration_minutes`,
  `clock_in_time_ms`,
  `clock_out_time_ms`,
  `scheduled_hours`,
  `actual_hours`,
  `overtime_hours`,
  `status`,
  `notes`,
  `manager_notes`,
  `confirmed_by`,
  `confirmed_at_ms`,
  `created_by`,
  `updated_by`,
  `created_at_ms`,
  `updated_at_ms`,
  `deleted_at_ms`
FROM `employee_schedules__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'employee_schedules.final', (SELECT count(*) FROM `employee_schedules__component_rebuild_data`), (SELECT count(*) FROM `employee_schedules`);
--> statement-breakpoint

CREATE INDEX `idx_employee_schedules_employee_date` ON `employee_schedules` (`employee_id`,`work_date`);
--> statement-breakpoint

CREATE INDEX `idx_employee_schedules_restaurant_date` ON `employee_schedules` (`restaurant_id`,`work_date`);
--> statement-breakpoint

CREATE INDEX `idx_employee_schedules_status_date` ON `employee_schedules` (`status`,`work_date`);
--> statement-breakpoint

CREATE TRIGGER `employee_schedules_restaurant_guard_bi`
BEFORE INSERT ON `employee_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `employee_schedules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`max_discount_amount` real,
	`min_order_amount` real DEFAULT 0,
	`applicable_menu_items` text,
	`applicable_categories` text,
	`usage_limit` integer,
	`usage_limit_per_user` integer,
	`used_count` integer DEFAULT 0,
	`valid_from` text NOT NULL,
	`valid_to` text NOT NULL,
	`is_active` integer DEFAULT true,
	`is_visible` integer DEFAULT true,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
	`created_by` integer,
	"deleted_at_ms" integer, `discount_value_cents` integer, `max_discount_amount_cents` integer, `min_order_amount_cents` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `coupons` (
  `id`,
  `restaurant_id`,
  `code`,
  `name`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `usage_limit`,
  `usage_limit_per_user`,
  `used_count`,
  `valid_from`,
  `valid_to`,
  `is_active`,
  `is_visible`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`
)
SELECT
  `id`,
  `restaurant_id`,
  `code`,
  `name`,
  `description`,
  `discount_type`,
  `discount_value`,
  `max_discount_amount`,
  `min_order_amount`,
  `applicable_menu_items`,
  `applicable_categories`,
  `usage_limit`,
  `usage_limit_per_user`,
  `used_count`,
  `valid_from`,
  `valid_to`,
  `is_active`,
  `is_visible`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`,
  `deleted_at_ms`,
  `discount_value_cents`,
  `max_discount_amount_cents`,
  `min_order_amount_cents`
FROM `coupons__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupons.final', (SELECT count(*) FROM `coupons__component_rebuild_data`), (SELECT count(*) FROM `coupons`);
--> statement-breakpoint

CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_code` ON `coupons` (`code`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_discount_type` ON `coupons` (`discount_type`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_restaurant_id` ON `coupons` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_status` ON `coupons` (`is_active`,`is_visible`);
--> statement-breakpoint

CREATE INDEX `idx_coupons_valid_period` ON `coupons` (`valid_from`,`valid_to`);
--> statement-breakpoint

CREATE TRIGGER `coupons_cents_sync_ai`
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

CREATE TRIGGER `coupons_cents_sync_au`
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

CREATE TRIGGER `coupons_restaurant_guard_bi`
BEFORE INSERT ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `coupons_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE "cash_shifts" (
	`id` text PRIMARY KEY NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` integer NOT NULL,
	`start_amount` real NOT NULL,
	`end_amount` real,
	`expected_amount` real NOT NULL,
	`actual_amount` real,
	`difference_amount` real DEFAULT 0 NOT NULL,
	`total_sales` real DEFAULT 0 NOT NULL,
	`total_refunds` real DEFAULT 0 NOT NULL,
	`cash_sales` real DEFAULT 0 NOT NULL,
	`card_sales` real DEFAULT 0 NOT NULL,
	`digital_sales` real DEFAULT 0 NOT NULL,
	`total_transactions` integer DEFAULT 0 NOT NULL,
	`started_at_ms` integer NOT NULL,
	`ended_at_ms` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`closing_notes` text,
	`start_amount_cents` integer,
	`end_amount_cents` integer,
	`expected_amount_cents` integer,
	`actual_amount_cents` integer,
	`difference_amount_cents` integer,
	`total_sales_cents` integer,
	`total_refunds_cents` integer,
	`cash_sales_cents` integer,
	`card_sales_cents` integer,
	`digital_sales_cents` integer,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `cash_shifts` (
  `id`,
  `register_id`,
  `operator_id`,
  `start_amount`,
  `end_amount`,
  `expected_amount`,
  `actual_amount`,
  `difference_amount`,
  `total_sales`,
  `total_refunds`,
  `cash_sales`,
  `card_sales`,
  `digital_sales`,
  `total_transactions`,
  `started_at_ms`,
  `ended_at_ms`,
  `status`,
  `notes`,
  `closing_notes`,
  `start_amount_cents`,
  `end_amount_cents`,
  `expected_amount_cents`,
  `actual_amount_cents`,
  `difference_amount_cents`,
  `total_sales_cents`,
  `total_refunds_cents`,
  `cash_sales_cents`,
  `card_sales_cents`,
  `digital_sales_cents`
)
SELECT
  `id`,
  `register_id`,
  `operator_id`,
  `start_amount`,
  `end_amount`,
  `expected_amount`,
  `actual_amount`,
  `difference_amount`,
  `total_sales`,
  `total_refunds`,
  `cash_sales`,
  `card_sales`,
  `digital_sales`,
  `total_transactions`,
  `started_at_ms`,
  `ended_at_ms`,
  `status`,
  `notes`,
  `closing_notes`,
  `start_amount_cents`,
  `end_amount_cents`,
  `expected_amount_cents`,
  `actual_amount_cents`,
  `difference_amount_cents`,
  `total_sales_cents`,
  `total_refunds_cents`,
  `cash_sales_cents`,
  `card_sales_cents`,
  `digital_sales_cents`
FROM `cash_shifts__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'cash_shifts.final', (SELECT count(*) FROM `cash_shifts__component_rebuild_data`), (SELECT count(*) FROM `cash_shifts`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_operator` ON `cash_shifts` (`operator_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_register` ON `cash_shifts` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_started` ON `cash_shifts` (`started_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_cash_shifts_status` ON `cash_shifts` (`register_id`,`status`);
--> statement-breakpoint

CREATE TRIGGER `cash_shifts_cents_sync_ai`
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

CREATE TRIGGER `cash_shifts_cents_sync_au`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'split_bills.final', (SELECT count(*) FROM `split_bills__component_rebuild_data`), (SELECT count(*) FROM `split_bills`);
--> statement-breakpoint

CREATE INDEX `idx_split_bills_group_order` ON `split_bills` (`group_order_id`);
--> statement-breakpoint

CREATE INDEX `idx_split_bills_member` ON `split_bills` (`member_id`);
--> statement-breakpoint

CREATE INDEX `idx_split_bills_payment_status` ON `split_bills` (`group_order_id`,`payment_status`);
--> statement-breakpoint
