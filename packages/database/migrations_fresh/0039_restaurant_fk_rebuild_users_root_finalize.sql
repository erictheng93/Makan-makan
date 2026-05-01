-- 0039 restaurant FK rebuild for users root component final apply phase.
-- Continues 0038 by finishing dependent table rebuilds and cleanup.
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

CREATE TABLE "shift_reports" (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` integer NOT NULL,
	`report_data` text NOT NULL,
	`summary_data` text NOT NULL,
	`generated_at_ms` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `shift_reports` (
  `id`,
  `shift_id`,
  `register_id`,
  `operator_id`,
  `report_data`,
  `summary_data`,
  `generated_at_ms`
)
SELECT
  `id`,
  `shift_id`,
  `register_id`,
  `operator_id`,
  `report_data`,
  `summary_data`,
  `generated_at_ms`
FROM `shift_reports__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'shift_reports.final', (SELECT count(*) FROM `shift_reports__component_rebuild_data`), (SELECT count(*) FROM `shift_reports`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_generated` ON `shift_reports` (`generated_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_operator` ON `shift_reports` (`operator_id`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_register` ON `shift_reports` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_shift_reports_shift` ON `shift_reports` (`shift_id`);
--> statement-breakpoint

CREATE TABLE "share_codes" (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_by` integer NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`usage_limit` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `share_codes` (
  `id`,
  `code`,
  `type`,
  `resource_id`,
  `created_by`,
  `expires_at_ms`,
  `is_active`,
  `usage_count`,
  `usage_limit`,
  `metadata`,
  `created_at_ms`
)
SELECT
  `id`,
  `code`,
  `type`,
  `resource_id`,
  `created_by`,
  `expires_at_ms`,
  `is_active`,
  `usage_count`,
  `usage_limit`,
  `metadata`,
  `created_at_ms`
FROM `share_codes__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'share_codes.final', (SELECT count(*) FROM `share_codes__component_rebuild_data`), (SELECT count(*) FROM `share_codes`);
--> statement-breakpoint

CREATE INDEX `idx_share_codes_active_expires` ON `share_codes` (`is_active`,`expires_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_share_codes_type_resource` ON `share_codes` (`type`,`resource_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `share_codes_code_unique` ON `share_codes` (`code`);
--> statement-breakpoint

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`refresh_token` text,
	`user_agent` text,
	`ip_address` text,
	`device_info` text,
	`location` text,
	`is_active` integer DEFAULT true NOT NULL,
	"last_accessed_at_ms" integer NOT NULL,
	"expires_at_ms" integer NOT NULL,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `sessions` (
  `id`,
  `user_id`,
  `token`,
  `refresh_token`,
  `user_agent`,
  `ip_address`,
  `device_info`,
  `location`,
  `is_active`,
  `last_accessed_at_ms`,
  `expires_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `user_id`,
  `token`,
  `refresh_token`,
  `user_agent`,
  `ip_address`,
  `device_info`,
  `location`,
  `is_active`,
  `last_accessed_at_ms`,
  `expires_at_ms`,
  `created_at_ms`,
  `updated_at_ms`
FROM `sessions__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'sessions.final', (SELECT count(*) FROM `sessions__component_rebuild_data`), (SELECT count(*) FROM `sessions`);
--> statement-breakpoint

CREATE INDEX `sessions_expires_idx` ON `sessions` ("expires_at_ms");
--> statement-breakpoint

CREATE UNIQUE INDEX `sessions_refresh_token_unique` ON `sessions` (`refresh_token`);
--> statement-breakpoint

CREATE INDEX `sessions_token_idx` ON `sessions` (`token`);
--> statement-breakpoint

CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);
--> statement-breakpoint

CREATE INDEX `sessions_user_active_idx` ON `sessions` (`user_id`,`is_active`);
--> statement-breakpoint

CREATE TABLE "scheduling_conflicts" (
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

INSERT INTO `scheduling_conflicts` (
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
FROM `scheduling_conflicts__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'scheduling_conflicts.final', (SELECT count(*) FROM `scheduling_conflicts__component_rebuild_data`), (SELECT count(*) FROM `scheduling_conflicts`);
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

CREATE TABLE `schedule_swap_requests` (
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

INSERT INTO `schedule_swap_requests` (
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
FROM `schedule_swap_requests__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'schedule_swap_requests.final', (SELECT count(*) FROM `schedule_swap_requests__component_rebuild_data`), (SELECT count(*) FROM `schedule_swap_requests`);
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

CREATE TABLE `phone_verification_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`phone` text NOT NULL,
	`otp_code` text NOT NULL,
	"expires_at_ms" integer NOT NULL,
	"verified_at_ms" integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`ip_address` text,
	"created_at_ms" integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `phone_verification_tokens` (
  `id`,
  `user_id`,
  `phone`,
  `otp_code`,
  `expires_at_ms`,
  `verified_at_ms`,
  `attempt_count`,
  `ip_address`,
  `created_at_ms`
)
SELECT
  `id`,
  `user_id`,
  `phone`,
  `otp_code`,
  `expires_at_ms`,
  `verified_at_ms`,
  `attempt_count`,
  `ip_address`,
  `created_at_ms`
FROM `phone_verification_tokens__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'phone_verification_tokens.final', (SELECT count(*) FROM `phone_verification_tokens__component_rebuild_data`), (SELECT count(*) FROM `phone_verification_tokens`);
--> statement-breakpoint

CREATE INDEX `idx_phone_verification_otp_expires` ON `phone_verification_tokens` (`otp_code`,"expires_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_phone_verification_user_phone` ON `phone_verification_tokens` (`user_id`,`phone`);
--> statement-breakpoint

CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`token_type` text DEFAULT 'email' NOT NULL,
	`otp_code` text,
	"expires_at_ms" integer NOT NULL,
	"used_at_ms" integer,
	`ip_address` text,
	`user_agent` text,
	"created_at_ms" integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `password_reset_tokens` (
  `id`,
  `user_id`,
  `token`,
  `token_type`,
  `otp_code`,
  `expires_at_ms`,
  `used_at_ms`,
  `ip_address`,
  `user_agent`,
  `created_at_ms`
)
SELECT
  `id`,
  `user_id`,
  `token`,
  `token_type`,
  `otp_code`,
  `expires_at_ms`,
  `used_at_ms`,
  `ip_address`,
  `user_agent`,
  `created_at_ms`
FROM `password_reset_tokens__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'password_reset_tokens.final', (SELECT count(*) FROM `password_reset_tokens__component_rebuild_data`), (SELECT count(*) FROM `password_reset_tokens`);
--> statement-breakpoint

CREATE INDEX `idx_password_reset_expires` ON `password_reset_tokens` ("expires_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_password_reset_token` ON `password_reset_tokens` (`token`);
--> statement-breakpoint

CREATE INDEX `idx_password_reset_user_expires` ON `password_reset_tokens` (`user_id`,"expires_at_ms");
--> statement-breakpoint

CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token`);
--> statement-breakpoint

CREATE TABLE `password_change_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`change_method` text NOT NULL,
	`success` integer DEFAULT true NOT NULL,
	`failure_reason` text,
	`ip_address` text NOT NULL,
	`user_agent` text,
	"created_at_ms" integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `password_change_logs` (
  `id`,
  `user_id`,
  `change_method`,
  `success`,
  `failure_reason`,
  `ip_address`,
  `user_agent`,
  `created_at_ms`
)
SELECT
  `id`,
  `user_id`,
  `change_method`,
  `success`,
  `failure_reason`,
  `ip_address`,
  `user_agent`,
  `created_at_ms`
FROM `password_change_logs__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'password_change_logs.final', (SELECT count(*) FROM `password_change_logs__component_rebuild_data`), (SELECT count(*) FROM `password_change_logs`);
--> statement-breakpoint

CREATE INDEX `idx_password_change_created` ON `password_change_logs` ("created_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_password_change_user_created` ON `password_change_logs` (`user_id`,"created_at_ms");
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

CREATE TABLE "leave_requests" (
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
	`submitted_at_ms` integer,
	`deleted_at_ms` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`final_approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `leave_requests` (
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
FROM `leave_requests__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_requests.final', (SELECT count(*) FROM `leave_requests__component_rebuild_data`), (SELECT count(*) FROM `leave_requests`);
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

CREATE TABLE "leave_calendar_events" (
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

INSERT INTO `leave_calendar_events` (
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
FROM `leave_calendar_events__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_calendar_events.final', (SELECT count(*) FROM `leave_calendar_events__component_rebuild_data`), (SELECT count(*) FROM `leave_calendar_events`);
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

CREATE TABLE "leave_approval_rules" (
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

INSERT INTO `leave_approval_rules` (
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
FROM `leave_approval_rules__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_approval_rules.final', (SELECT count(*) FROM `leave_approval_rules__component_rebuild_data`), (SELECT count(*) FROM `leave_approval_rules`);
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'group_activity_logs.final', (SELECT count(*) FROM `group_activity_logs__component_rebuild_data`), (SELECT count(*) FROM `group_activity_logs`);
--> statement-breakpoint

CREATE INDEX `idx_group_activity_logs_action` ON `group_activity_logs` (`group_order_id`,`action`);
--> statement-breakpoint

CREATE INDEX `idx_group_activity_logs_created` ON `group_activity_logs` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_group_activity_logs_group_order` ON `group_activity_logs` (`group_order_id`);
--> statement-breakpoint

CREATE TABLE "employee_leave_balances" (
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

INSERT INTO `employee_leave_balances` (
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
FROM `employee_leave_balances__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'employee_leave_balances.final', (SELECT count(*) FROM `employee_leave_balances__component_rebuild_data`), (SELECT count(*) FROM `employee_leave_balances`);
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

CREATE TABLE "employee_availability" (
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

INSERT INTO `employee_availability` (
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
FROM `employee_availability__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'employee_availability.final', (SELECT count(*) FROM `employee_availability__component_rebuild_data`), (SELECT count(*) FROM `employee_availability`);
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

CREATE TABLE `email_verification_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`email` text NOT NULL,
	"expires_at_ms" integer NOT NULL,
	"verified_at_ms" integer,
	`ip_address` text,
	"created_at_ms" integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `email_verification_tokens` (
  `id`,
  `user_id`,
  `token`,
  `email`,
  `expires_at_ms`,
  `verified_at_ms`,
  `ip_address`,
  `created_at_ms`
)
SELECT
  `id`,
  `user_id`,
  `token`,
  `email`,
  `expires_at_ms`,
  `verified_at_ms`,
  `ip_address`,
  `created_at_ms`
FROM `email_verification_tokens__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'email_verification_tokens.final', (SELECT count(*) FROM `email_verification_tokens__component_rebuild_data`), (SELECT count(*) FROM `email_verification_tokens`);
--> statement-breakpoint

CREATE UNIQUE INDEX `email_verification_tokens_token_unique` ON `email_verification_tokens` (`token`);
--> statement-breakpoint

CREATE INDEX `idx_email_verification_expires` ON `email_verification_tokens` ("expires_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_email_verification_token` ON `email_verification_tokens` (`token`);
--> statement-breakpoint

CREATE INDEX `idx_email_verification_user` ON `email_verification_tokens` (`user_id`);
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

INSERT INTO `_migration_assert_users_root_component_counts_0037`
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

CREATE TABLE "coupon_templates" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`name` text NOT NULL,
	`description` text,
	`template_data` text NOT NULL,
	`usage_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`is_system_template` integer DEFAULT false,
	"created_at_ms" integer NOT NULL,
	"updated_at_ms" integer NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `coupon_templates` (
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `template_data`,
  `usage_count`,
  `is_active`,
  `is_system_template`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`
)
SELECT
  `id`,
  `restaurant_id`,
  `name`,
  `description`,
  `template_data`,
  `usage_count`,
  `is_active`,
  `is_system_template`,
  `created_at_ms`,
  `updated_at_ms`,
  `created_by`
FROM `coupon_templates__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupon_templates.final', (SELECT count(*) FROM `coupon_templates__component_rebuild_data`), (SELECT count(*) FROM `coupon_templates`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_templates_active` ON `coupon_templates` (`is_active`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_templates_restaurant_id` ON `coupon_templates` (`restaurant_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_templates_system` ON `coupon_templates` (`is_system_template`);
--> statement-breakpoint

CREATE TRIGGER `coupon_templates_restaurant_guard_bi`
BEFORE INSERT ON `coupon_templates`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupon_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `coupon_templates_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupon_templates`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupon_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TABLE `coupon_distributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`distribution_type` text NOT NULL,
	`target_type` text,
	`target_criteria` text,
	`total_distributed` integer DEFAULT 0,
	`total_used` integer DEFAULT 0,
	"distributed_at_ms" integer NOT NULL,
	"expires_at_ms" integer,
	"created_at_ms" integer NOT NULL,
	`created_by` integer,
	`notes` text,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `coupon_distributions` (
  `id`,
  `coupon_id`,
  `distribution_type`,
  `target_type`,
  `target_criteria`,
  `total_distributed`,
  `total_used`,
  `distributed_at_ms`,
  `expires_at_ms`,
  `created_at_ms`,
  `created_by`,
  `notes`
)
SELECT
  `id`,
  `coupon_id`,
  `distribution_type`,
  `target_type`,
  `target_criteria`,
  `total_distributed`,
  `total_used`,
  `distributed_at_ms`,
  `expires_at_ms`,
  `created_at_ms`,
  `created_by`,
  `notes`
FROM `coupon_distributions__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupon_distributions.final', (SELECT count(*) FROM `coupon_distributions__component_rebuild_data`), (SELECT count(*) FROM `coupon_distributions`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_distributions_coupon_id` ON `coupon_distributions` (`coupon_id`);
--> statement-breakpoint

CREATE INDEX `idx_coupon_distributions_distributed_at` ON `coupon_distributions` ("distributed_at_ms");
--> statement-breakpoint

CREATE INDEX `idx_coupon_distributions_type` ON `coupon_distributions` (`distribution_type`);
--> statement-breakpoint

CREATE TABLE "cash_movements" (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`register_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`reference_id` integer,
	`reference_type` text,
	`payment_method` text,
	`denomination_breakdown` text DEFAULT '{}' NOT NULL,
	`recorded_by` integer NOT NULL,
	`approved_by` integer,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`receipt_number` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`amount_cents` integer,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `cash_movements` (
  `id`,
  `shift_id`,
  `register_id`,
  `type`,
  `amount`,
  `description`,
  `reference_id`,
  `reference_type`,
  `payment_method`,
  `denomination_breakdown`,
  `recorded_by`,
  `approved_by`,
  `approval_status`,
  `receipt_number`,
  `metadata`,
  `created_at_ms`,
  `amount_cents`
)
SELECT
  `id`,
  `shift_id`,
  `register_id`,
  `type`,
  `amount`,
  `description`,
  `reference_id`,
  `reference_type`,
  `payment_method`,
  `denomination_breakdown`,
  `recorded_by`,
  `approved_by`,
  `approval_status`,
  `receipt_number`,
  `metadata`,
  `created_at_ms`,
  `amount_cents`
FROM `cash_movements__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'cash_movements.final', (SELECT count(*) FROM `cash_movements__component_rebuild_data`), (SELECT count(*) FROM `cash_movements`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_created` ON `cash_movements` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_register` ON `cash_movements` (`register_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_shift` ON `cash_movements` (`shift_id`);
--> statement-breakpoint

CREATE INDEX `idx_cash_movements_type` ON `cash_movements` (`shift_id`,`type`);
--> statement-breakpoint

CREATE TRIGGER `cash_movements_cents_sync_ai`
AFTER INSERT ON `cash_movements`
FOR EACH ROW
BEGIN
  UPDATE `cash_movements`
     SET `amount_cents` = CAST(round(NEW.`amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TRIGGER `cash_movements_cents_sync_au`
AFTER UPDATE OF `amount` ON `cash_movements`
FOR EACH ROW
BEGIN
  UPDATE `cash_movements`
     SET `amount_cents` = CAST(round(NEW.`amount` * 100) AS integer)
   WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint

CREATE TABLE "audit_logs" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`restaurant_id` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text,
	`description` text NOT NULL,
	`changes` text,
	`ip_address` text,
	`user_agent` text,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	`execution_time_ms` integer,
	`created_at_ms` integer NOT NULL, on_behalf_of_user_id INTEGER REFERENCES users(id),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `audit_logs` (
  `id`,
  `user_id`,
  `restaurant_id`,
  `action`,
  `resource`,
  `resource_id`,
  `description`,
  `changes`,
  `ip_address`,
  `user_agent`,
  `success`,
  `error_message`,
  `execution_time_ms`,
  `created_at_ms`,
  `on_behalf_of_user_id`
)
SELECT
  `id`,
  `user_id`,
  `restaurant_id`,
  `action`,
  `resource`,
  `resource_id`,
  `description`,
  `changes`,
  `ip_address`,
  `user_agent`,
  `success`,
  `error_message`,
  `execution_time_ms`,
  `created_at_ms`,
  `on_behalf_of_user_id`
FROM `audit_logs__component_rebuild_data`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'audit_logs.final', (SELECT count(*) FROM `audit_logs__component_rebuild_data`), (SELECT count(*) FROM `audit_logs`);
--> statement-breakpoint

CREATE INDEX audit_logs_on_behalf_of_idx
  ON audit_logs(on_behalf_of_user_id, created_at_ms);
--> statement-breakpoint

CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource`,`resource_id`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `audit_logs_restaurant_action_idx` ON `audit_logs` (`restaurant_id`,`action`,`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `audit_logs_time_idx` ON `audit_logs` (`created_at_ms`);
--> statement-breakpoint

CREATE INDEX `audit_logs_user_action_idx` ON `audit_logs` (`user_id`,`action`,`created_at_ms`);
--> statement-breakpoint

CREATE TRIGGER `audit_logs_restaurant_guard_bi`
BEFORE INSERT ON `audit_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `audit_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `audit_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

DROP TABLE `audit_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `cash_movements__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `cash_shifts__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupon_distributions__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupon_templates__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `coupons__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `email_verification_tokens__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `employee_availability__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `employee_leave_balances__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `employee_schedules__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_activity_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_cart_items__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_members__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `group_orders__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_approval_rules__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_calendar_events__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_requests__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `leave_types__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `order_items__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `orders__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `partnership_plans__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `partnerships__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `password_change_logs__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `password_reset_tokens__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `payment_transactions__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `phone_verification_tokens__component_rebuild_data`;
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

DROP TABLE `schedule_swap_requests__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `scheduling_conflicts__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `scheduling_rules__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `sessions__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `share_codes__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `shift_reports__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `shift_templates__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `split_bills__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `users__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `verified_members__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `waiting_list__component_rebuild_data`;
--> statement-breakpoint

DROP TABLE `_migration_assert_users_root_component_counts_0037`;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
VALUES
  ('restaurant_fk', 'users', 'restaurant_id', 'physical_fk_rebuild', 'info', 0, NULL, 'users was rebuilt with a physical nullable restaurant_id FK in 0039 using a D1-safe root component rebuild.');
--> statement-breakpoint
