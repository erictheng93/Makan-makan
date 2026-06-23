PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scheduling_conflicts` (
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
	`resolved_by` TEXT,
	`resolved_at_ms` integer,
	`resolution_notes` text,
	`detected_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `scheduling_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scheduling_conflicts`("id", "restaurant_id", "conflict_type", "severity", "schedule_ids", "employee_ids", "rule_id", "message", "details", "status", "resolved_by", "resolved_at_ms", "resolution_notes", "detected_at_ms", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "conflict_type", "severity", "schedule_ids", "employee_ids", "rule_id", "message", "details", "status", "resolved_by", "resolved_at_ms", "resolution_notes", "detected_at_ms", "created_at_ms", "updated_at_ms" FROM `scheduling_conflicts`;--> statement-breakpoint
DROP TABLE `scheduling_conflicts`;--> statement-breakpoint
ALTER TABLE `__new_scheduling_conflicts` RENAME TO `scheduling_conflicts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_scheduling_conflicts_restaurant_status` ON `scheduling_conflicts` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_scheduling_conflicts_detected_at_ms` ON `scheduling_conflicts` (`detected_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` TEXT PRIMARY KEY NOT NULL,
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
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "restaurant_id", "table_id", "customer_id", "order_number", "status", "order_type", "subtotal", "tax_amount", "service_charge", "discount_amount", "total_amount", "customer_info", "estimated_prep_time", "actual_prep_time", "confirmed_at_ms", "preparing_at_ms", "ready_at_ms", "delivered_at_ms", "paid_at_ms", "cancelled_at_ms", "payment_method", "payment_status", "payment_transaction_id", "coupon_code", "promotion_ids", "rating", "review_comment", "reviewed_at_ms", "notes", "internal_notes", "cancellation_reason", "refund_amount", "delivery_info", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "table_id", "customer_id", "order_number", "status", "order_type", "subtotal", "tax_amount", "service_charge", "discount_amount", "total_amount", "customer_info", "estimated_prep_time", "actual_prep_time", "confirmed_at_ms", "preparing_at_ms", "ready_at_ms", "delivered_at_ms", "paid_at_ms", "cancelled_at_ms", "payment_method", "payment_status", "payment_transaction_id", "coupon_code", "promotion_ids", "rating", "review_comment", "reviewed_at_ms", "notes", "internal_notes", "cancellation_reason", "refund_amount", "delivery_info", "created_at_ms", "updated_at_ms" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_restaurant_status_idx` ON `orders` (`restaurant_id`,`status`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `orders_restaurant_table_idx` ON `orders` (`restaurant_id`,`table_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `orders_status_time_idx` ON `orders` (`status`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`,`paid_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` TEXT,
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
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_audit_logs`("id", "user_id", "restaurant_id", "action", "resource", "resource_id", "description", "changes", "ip_address", "user_agent", "success", "error_message", "execution_time_ms", "created_at_ms") SELECT "id", "user_id", "restaurant_id", "action", "resource", "resource_id", "description", "changes", "ip_address", "user_agent", "success", "error_message", "execution_time_ms", "created_at_ms" FROM `audit_logs`;--> statement-breakpoint
DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_audit_logs` RENAME TO `audit_logs`;--> statement-breakpoint
CREATE INDEX `audit_logs_user_action_idx` ON `audit_logs` (`user_id`,`action`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `audit_logs_restaurant_action_idx` ON `audit_logs` (`restaurant_id`,`action`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource`,`resource_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `audit_logs_time_idx` ON `audit_logs` (`created_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_cash_movements` (
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
	`recorded_by` TEXT NOT NULL,
	`approved_by` TEXT,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`receipt_number` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cash_movements`("id", "shift_id", "register_id", "type", "amount", "description", "reference_id", "reference_type", "payment_method", "denomination_breakdown", "recorded_by", "approved_by", "approval_status", "receipt_number", "metadata", "created_at_ms") SELECT "id", "shift_id", "register_id", "type", "amount", "description", "reference_id", "reference_type", "payment_method", "denomination_breakdown", "recorded_by", "approved_by", "approval_status", "receipt_number", "metadata", "created_at_ms" FROM `cash_movements`;--> statement-breakpoint
DROP TABLE `cash_movements`;--> statement-breakpoint
ALTER TABLE `__new_cash_movements` RENAME TO `cash_movements`;--> statement-breakpoint
CREATE INDEX `idx_cash_movements_shift` ON `cash_movements` (`shift_id`);--> statement-breakpoint
CREATE INDEX `idx_cash_movements_register` ON `cash_movements` (`register_id`);--> statement-breakpoint
CREATE INDEX `idx_cash_movements_type` ON `cash_movements` (`shift_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_cash_movements_created` ON `cash_movements` (`created_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_cash_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` TEXT NOT NULL,
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
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cash_shifts`("id", "register_id", "operator_id", "start_amount", "end_amount", "expected_amount", "actual_amount", "difference_amount", "total_sales", "total_refunds", "cash_sales", "card_sales", "digital_sales", "total_transactions", "started_at_ms", "ended_at_ms", "status", "notes", "closing_notes") SELECT "id", "register_id", "operator_id", "start_amount", "end_amount", "expected_amount", "actual_amount", "difference_amount", "total_sales", "total_refunds", "cash_sales", "card_sales", "digital_sales", "total_transactions", "started_at_ms", "ended_at_ms", "status", "notes", "closing_notes" FROM `cash_shifts`;--> statement-breakpoint
DROP TABLE `cash_shifts`;--> statement-breakpoint
ALTER TABLE `__new_cash_shifts` RENAME TO `cash_shifts`;--> statement-breakpoint
CREATE INDEX `idx_cash_shifts_register` ON `cash_shifts` (`register_id`);--> statement-breakpoint
CREATE INDEX `idx_cash_shifts_operator` ON `cash_shifts` (`operator_id`);--> statement-breakpoint
CREATE INDEX `idx_cash_shifts_status` ON `cash_shifts` (`register_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cash_shifts_started` ON `cash_shifts` (`started_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_shift_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` TEXT NOT NULL,
	`report_data` text NOT NULL,
	`summary_data` text NOT NULL,
	`generated_at_ms` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shift_reports`("id", "shift_id", "register_id", "operator_id", "report_data", "summary_data", "generated_at_ms") SELECT "id", "shift_id", "register_id", "operator_id", "report_data", "summary_data", "generated_at_ms" FROM `shift_reports`;--> statement-breakpoint
DROP TABLE `shift_reports`;--> statement-breakpoint
ALTER TABLE `__new_shift_reports` RENAME TO `shift_reports`;--> statement-breakpoint
CREATE INDEX `idx_shift_reports_shift` ON `shift_reports` (`shift_id`);--> statement-breakpoint
CREATE INDEX `idx_shift_reports_register` ON `shift_reports` (`register_id`);--> statement-breakpoint
CREATE INDEX `idx_shift_reports_operator` ON `shift_reports` (`operator_id`);--> statement-breakpoint
CREATE INDEX `idx_shift_reports_generated` ON `shift_reports` (`generated_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_group_activity_logs` (
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
INSERT INTO `__new_group_activity_logs`("id", "group_order_id", "member_id", "action", "description", "metadata", "created_at_ms") SELECT "id", "group_order_id", "member_id", "action", "description", "metadata", "created_at_ms" FROM `group_activity_logs`;--> statement-breakpoint
DROP TABLE `group_activity_logs`;--> statement-breakpoint
ALTER TABLE `__new_group_activity_logs` RENAME TO `group_activity_logs`;--> statement-breakpoint
CREATE INDEX `idx_group_activity_logs_group_order` ON `group_activity_logs` (`group_order_id`);--> statement-breakpoint
CREATE INDEX `idx_group_activity_logs_action` ON `group_activity_logs` (`group_order_id`,`action`);--> statement-breakpoint
CREATE INDEX `idx_group_activity_logs_created` ON `group_activity_logs` (`created_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_group_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`share_code` text NOT NULL,
	`master_order_id` TEXT,
	`created_by` TEXT NOT NULL,
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
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_group_orders`("id", "share_code", "master_order_id", "created_by", "restaurant_id", "table_id", "status", "split_type", "total_amount", "tax_amount", "service_charge", "final_amount", "expires_at_ms", "locked_at_ms", "completed_at_ms", "settings", "notes", "created_at_ms", "updated_at_ms") SELECT "id", "share_code", "master_order_id", "created_by", "restaurant_id", "table_id", "status", "split_type", "total_amount", "tax_amount", "service_charge", "final_amount", "expires_at_ms", "locked_at_ms", "completed_at_ms", "settings", "notes", "created_at_ms", "updated_at_ms" FROM `group_orders`;--> statement-breakpoint
DROP TABLE `group_orders`;--> statement-breakpoint
ALTER TABLE `__new_group_orders` RENAME TO `group_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `group_orders_share_code_unique` ON `group_orders` (`share_code`);--> statement-breakpoint
CREATE INDEX `idx_group_orders_restaurant_status` ON `group_orders` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_group_orders_status_created` ON `group_orders` (`status`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `idx_group_orders_table` ON `group_orders` (`table_id`);--> statement-breakpoint
CREATE INDEX `idx_group_orders_expires` ON `group_orders` (`expires_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_share_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_by` TEXT NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`usage_limit` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_share_codes`("id", "code", "type", "resource_id", "created_by", "expires_at_ms", "is_active", "usage_count", "usage_limit", "metadata", "created_at_ms") SELECT "id", "code", "type", "resource_id", "created_by", "expires_at_ms", "is_active", "usage_count", "usage_limit", "metadata", "created_at_ms" FROM `share_codes`;--> statement-breakpoint
DROP TABLE `share_codes`;--> statement-breakpoint
ALTER TABLE `__new_share_codes` RENAME TO `share_codes`;--> statement-breakpoint
CREATE UNIQUE INDEX `share_codes_code_unique` ON `share_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_share_codes_type_resource` ON `share_codes` (`type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_share_codes_active_expires` ON `share_codes` (`is_active`,`expires_at_ms`);--> statement-breakpoint
CREATE TABLE `__new_restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`address` text NOT NULL,
	`district` text NOT NULL,
	`city` text DEFAULT '台中市' NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`website` text,
	`business_hours` text,
	`is_available` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`logo_url` text,
	`banner_url` text,
	`image_urls` text,
	`shop_qr_code` text,
	`shop_qr_code_image_url` text,
	`enable_shop_mode` integer DEFAULT false NOT NULL,
	`shop_qr_settings` text,
	`shop_qr_version` integer DEFAULT 1 NOT NULL,
	`settings` text,
	`rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0 NOT NULL,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer
);
--> statement-breakpoint
INSERT INTO `__new_restaurants`("id", "name", "type", "category", "description", "address", "district", "city", "phone", "email", "website", "business_hours", "is_available", "is_active", "logo_url", "banner_url", "image_urls", "shop_qr_code", "shop_qr_code_image_url", "enable_shop_mode", "shop_qr_settings", "shop_qr_version", "settings", "rating", "review_count", "total_orders", "created_at_ms", "updated_at_ms", "deleted_at_ms") SELECT "id", "name", "type", "category", "description", "address", "district", "city", "phone", "email", "website", "business_hours", "is_available", "is_active", "logo_url", "banner_url", "image_urls", "shop_qr_code", "shop_qr_code_image_url", "enable_shop_mode", "shop_qr_settings", "shop_qr_version", "settings", "rating", "review_count", "total_orders", "created_at_ms", "updated_at_ms", "deleted_at_ms" FROM `restaurants`;--> statement-breakpoint
DROP TABLE `restaurants`;--> statement-breakpoint
ALTER TABLE `__new_restaurants` RENAME TO `restaurants`;--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_shop_qr_code_unique` ON `restaurants` (`shop_qr_code`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` TEXT PRIMARY KEY NOT NULL,
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
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "email", "phone", "full_name", "password_hash", "role", "restaurant_id", "address", "date_of_birth", "profile_image_url", "is_active", "is_verified", "preferences", "total_orders", "total_spent", "last_login_at_ms", "password_changed_at_ms", "email_verified_at_ms", "phone_verified_at_ms", "created_at_ms", "updated_at_ms", "deleted_at_ms") SELECT "id", "username", "email", "phone", "full_name", "password_hash", "role", "restaurant_id", "address", "date_of_birth", "profile_image_url", "is_active", "is_verified", "preferences", "total_orders", "total_spent", "last_login_at_ms", "password_changed_at_ms", "email_verified_at_ms", "phone_verified_at_ms", "created_at_ms", "updated_at_ms", "deleted_at_ms" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `__new_categories` (
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
	`deleted_at_ms` integer
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "restaurant_id", "name", "description", "sort_order", "is_active", "is_visible", "image_url", "icon_url", "available_hours", "item_count", "created_at_ms", "updated_at_ms", "deleted_at_ms") SELECT "id", "restaurant_id", "name", "description", "sort_order", "is_active", "is_visible", "image_url", "icon_url", "available_hours", "item_count", "created_at_ms", "updated_at_ms", "deleted_at_ms" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE INDEX `categories_restaurant_sort_idx` ON `categories` (`restaurant_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `categories_restaurant_active_idx` ON `categories` (`restaurant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_menu_items` (
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_menu_items`("id", "restaurant_id", "category_id", "name", "description", "ingredients", "price", "original_price", "cost_price", "image_url", "image_variants", "is_available", "is_featured", "is_popular", "sort_order", "inventory_count", "min_inventory_alert", "spice_level", "preparation_time", "calories", "dietary_info", "allergens", "options", "available_hours", "order_count", "rating", "review_count", "view_count", "tags", "keywords", "created_at_ms", "updated_at_ms", "deleted_at_ms") SELECT "id", "restaurant_id", "category_id", "name", "description", "ingredients", "price", "original_price", "cost_price", "image_url", "image_variants", "is_available", "is_featured", "is_popular", "sort_order", "inventory_count", "min_inventory_alert", "spice_level", "preparation_time", "calories", "dietary_info", "allergens", "options", "available_hours", "order_count", "rating", "review_count", "view_count", "tags", "keywords", "created_at_ms", "updated_at_ms", "deleted_at_ms" FROM `menu_items`;--> statement-breakpoint
DROP TABLE `menu_items`;--> statement-breakpoint
ALTER TABLE `__new_menu_items` RENAME TO `menu_items`;--> statement-breakpoint
CREATE INDEX `menu_items_restaurant_category_idx` ON `menu_items` (`restaurant_id`,`category_id`,`is_available`);--> statement-breakpoint
CREATE INDEX `menu_items_restaurant_featured_idx` ON `menu_items` (`restaurant_id`,`is_featured`,`is_available`);--> statement-breakpoint
CREATE INDEX `menu_items_restaurant_popular_idx` ON `menu_items` (`restaurant_id`,`is_popular`,`order_count`);--> statement-breakpoint
CREATE INDEX `menu_items_price_range_idx` ON `menu_items` (`restaurant_id`,`price`);--> statement-breakpoint
CREATE INDEX `menu_items_availability_idx` ON `menu_items` (`is_available`,`inventory_count`);--> statement-breakpoint
CREATE TABLE `__new_tables` (
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
	`current_order_id` TEXT,
	`occupied_at_ms` integer,
	`occupied_by` text,
	`estimated_free_at_ms` integer,
	`last_cleaned_at_ms` integer,
	`maintenance_notes` text,
	`total_usage` integer DEFAULT 0 NOT NULL,
	`average_occupancy_minutes` integer DEFAULT 0,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer
);
--> statement-breakpoint
INSERT INTO `__new_tables`("id", "restaurant_id", "number", "name", "capacity", "location", "floor", "section", "qr_code", "qr_code_image_url", "qr_code_version", "qr_mode", "seat_count", "seat_layout", "seat_numbering_style", "is_occupied", "is_active", "is_reservable", "features", "current_order_id", "occupied_at_ms", "occupied_by", "estimated_free_at_ms", "last_cleaned_at_ms", "maintenance_notes", "total_usage", "average_occupancy_minutes", "created_at_ms", "updated_at_ms", "deleted_at_ms") SELECT "id", "restaurant_id", "number", "name", "capacity", "location", "floor", "section", "qr_code", "qr_code_image_url", "qr_code_version", "qr_mode", "seat_count", "seat_layout", "seat_numbering_style", "is_occupied", "is_active", "is_reservable", "features", "current_order_id", "occupied_at_ms", "occupied_by", "estimated_free_at_ms", "last_cleaned_at_ms", "maintenance_notes", "total_usage", "average_occupancy_minutes", "created_at_ms", "updated_at_ms", "deleted_at_ms" FROM `tables`;--> statement-breakpoint
DROP TABLE `tables`;--> statement-breakpoint
ALTER TABLE `__new_tables` RENAME TO `tables`;--> statement-breakpoint
CREATE UNIQUE INDEX `tables_qr_code_unique` ON `tables` (`qr_code`);--> statement-breakpoint
CREATE INDEX `tables_restaurant_number_idx` ON `tables` (`restaurant_id`,`number`);--> statement-breakpoint
CREATE INDEX `tables_restaurant_status_idx` ON `tables` (`restaurant_id`,`is_occupied`,`is_active`);--> statement-breakpoint
CREATE INDEX `tables_qr_code_idx` ON `tables` (`qr_code`);--> statement-breakpoint
CREATE TABLE `__new_employee_leave_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` TEXT NOT NULL,
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
	`adjusted_by` TEXT,
	`adjusted_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`last_updated_by` TEXT,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjusted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_employee_leave_balances`("id", "employee_id", "leave_type_id", "restaurant_id", "year", "total_days", "used_days", "pending_days", "carryover_from_previous", "carryover_to_next", "carryover_expires_at_ms", "manual_adjustment", "adjustment_reason", "adjusted_by", "adjusted_at_ms", "created_at_ms", "updated_at_ms", "last_updated_by") SELECT "id", "employee_id", "leave_type_id", "restaurant_id", "year", "total_days", "used_days", "pending_days", "carryover_from_previous", "carryover_to_next", "carryover_expires_at_ms", "manual_adjustment", "adjustment_reason", "adjusted_by", "adjusted_at_ms", "created_at_ms", "updated_at_ms", "last_updated_by" FROM `employee_leave_balances`;--> statement-breakpoint
DROP TABLE `employee_leave_balances`;--> statement-breakpoint
ALTER TABLE `__new_employee_leave_balances` RENAME TO `employee_leave_balances`;--> statement-breakpoint
CREATE INDEX `idx_employee_leave_balances_employee_year` ON `employee_leave_balances` (`employee_id`,`year`);--> statement-breakpoint
CREATE INDEX `idx_employee_leave_balances_restaurant_year_type` ON `employee_leave_balances` (`restaurant_id`,`year`,`leave_type_id`);--> statement-breakpoint
CREATE TABLE `__new_leave_approval_rules` (
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
	`escalation_to_user_id` TEXT,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` TEXT NOT NULL,
	`updated_by` TEXT,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`escalation_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_leave_approval_rules`("id", "restaurant_id", "leave_type_id", "name", "description", "approval_level", "approver_type", "approver_role_ids", "approver_user_ids", "enable_auto_approval", "auto_approval_conditions", "enable_auto_escalation", "escalation_timeout_hours", "escalation_to_user_id", "priority", "is_active", "created_at_ms", "updated_at_ms", "created_by", "updated_by") SELECT "id", "restaurant_id", "leave_type_id", "name", "description", "approval_level", "approver_type", "approver_role_ids", "approver_user_ids", "enable_auto_approval", "auto_approval_conditions", "enable_auto_escalation", "escalation_timeout_hours", "escalation_to_user_id", "priority", "is_active", "created_at_ms", "updated_at_ms", "created_by", "updated_by" FROM `leave_approval_rules`;--> statement-breakpoint
DROP TABLE `leave_approval_rules`;--> statement-breakpoint
ALTER TABLE `__new_leave_approval_rules` RENAME TO `leave_approval_rules`;--> statement-breakpoint
CREATE INDEX `idx_leave_approval_rules_restaurant_type` ON `leave_approval_rules` (`restaurant_id`,`leave_type_id`);--> statement-breakpoint
CREATE INDEX `idx_leave_approval_rules_level_active` ON `leave_approval_rules` (`approval_level`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_leave_calendar_events` (
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
	`created_by` TEXT,
	`color` text,
	`icon` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_leave_calendar_events`("id", "restaurant_id", "name", "description", "event_type", "event_date", "is_recurring", "recurrence_pattern", "is_working_day", "compensatory_for", "created_at_ms", "updated_at_ms", "created_by", "color", "icon") SELECT "id", "restaurant_id", "name", "description", "event_type", "event_date", "is_recurring", "recurrence_pattern", "is_working_day", "compensatory_for", "created_at_ms", "updated_at_ms", "created_by", "color", "icon" FROM `leave_calendar_events`;--> statement-breakpoint
DROP TABLE `leave_calendar_events`;--> statement-breakpoint
ALTER TABLE `__new_leave_calendar_events` RENAME TO `leave_calendar_events`;--> statement-breakpoint
CREATE INDEX `idx_leave_calendar_events_restaurant_date` ON `leave_calendar_events` (`restaurant_id`,`event_date`);--> statement-breakpoint
CREATE INDEX `idx_leave_calendar_events_type` ON `leave_calendar_events` (`event_type`);--> statement-breakpoint
CREATE TABLE `__new_leave_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` TEXT NOT NULL,
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
	`final_approver_id` TEXT,
	`final_approved_at_ms` integer,
	`rejected_by` TEXT,
	`rejected_at_ms` integer,
	`rejection_reason` text,
	`cancelled_by` TEXT,
	`cancelled_at_ms` integer,
	`cancellation_reason` text,
	`affected_schedule_ids` text,
	`replacement_notified` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`submitted_at_ms` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`final_approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_leave_requests`("id", "restaurant_id", "employee_id", "leave_type_id", "start_date", "end_date", "start_period", "end_period", "total_days", "reason", "attachment_url", "emergency_contact", "status", "approval_chain", "current_approval_level", "final_approver_id", "final_approved_at_ms", "rejected_by", "rejected_at_ms", "rejection_reason", "cancelled_by", "cancelled_at_ms", "cancellation_reason", "affected_schedule_ids", "replacement_notified", "created_at_ms", "updated_at_ms", "submitted_at_ms") SELECT "id", "restaurant_id", "employee_id", "leave_type_id", "start_date", "end_date", "start_period", "end_period", "total_days", "reason", "attachment_url", "emergency_contact", "status", "approval_chain", "current_approval_level", "final_approver_id", "final_approved_at_ms", "rejected_by", "rejected_at_ms", "rejection_reason", "cancelled_by", "cancelled_at_ms", "cancellation_reason", "affected_schedule_ids", "replacement_notified", "created_at_ms", "updated_at_ms", "submitted_at_ms" FROM `leave_requests`;--> statement-breakpoint
DROP TABLE `leave_requests`;--> statement-breakpoint
ALTER TABLE `__new_leave_requests` RENAME TO `leave_requests`;--> statement-breakpoint
CREATE INDEX `idx_leave_requests_restaurant_status` ON `leave_requests` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_leave_requests_employee_date` ON `leave_requests` (`employee_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_leave_requests_status_date` ON `leave_requests` (`status`,`start_date`);--> statement-breakpoint
CREATE TABLE `__new_leave_types` (
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
	`created_by` TEXT,
	`updated_by` TEXT,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_leave_types`("id", "restaurant_id", "code", "name", "description", "accrual_type", "accrual_amount", "accrual_based_on_seniority", "requires_approval", "required_approval_levels", "min_notice_days", "max_consecutive_days", "can_carryover", "carryover_max_days", "carryover_expiry_months", "requires_documentation", "documentation_required_after_days", "is_paid", "payment_rate", "allow_half_day", "gender", "applicable_to_roles", "max_usage_per_year", "is_system_defined", "is_active", "sort_order", "color", "icon", "created_at_ms", "updated_at_ms", "created_by", "updated_by") SELECT "id", "restaurant_id", "code", "name", "description", "accrual_type", "accrual_amount", "accrual_based_on_seniority", "requires_approval", "required_approval_levels", "min_notice_days", "max_consecutive_days", "can_carryover", "carryover_max_days", "carryover_expiry_months", "requires_documentation", "documentation_required_after_days", "is_paid", "payment_rate", "allow_half_day", "gender", "applicable_to_roles", "max_usage_per_year", "is_system_defined", "is_active", "sort_order", "color", "icon", "created_at_ms", "updated_at_ms", "created_by", "updated_by" FROM `leave_types`;--> statement-breakpoint
DROP TABLE `leave_types`;--> statement-breakpoint
ALTER TABLE `__new_leave_types` RENAME TO `leave_types`;--> statement-breakpoint
CREATE INDEX `idx_leave_types_restaurant_code` ON `leave_types` (`restaurant_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_leave_types_restaurant_active` ON `leave_types` (`restaurant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_employee_availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` TEXT NOT NULL,
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
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_employee_availability`("id", "restaurant_id", "employee_id", "availability_type", "day_of_week", "start_time", "end_time", "start_date", "end_date", "preference_type", "priority", "notes", "is_active", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "employee_id", "availability_type", "day_of_week", "start_time", "end_time", "start_date", "end_date", "preference_type", "priority", "notes", "is_active", "created_at_ms", "updated_at_ms" FROM `employee_availability`;--> statement-breakpoint
DROP TABLE `employee_availability`;--> statement-breakpoint
ALTER TABLE `__new_employee_availability` RENAME TO `employee_availability`;--> statement-breakpoint
CREATE INDEX `idx_employee_availability_restaurant_employee` ON `employee_availability` (`restaurant_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_employee_availability_day_preference` ON `employee_availability` (`day_of_week`,`preference_type`);--> statement-breakpoint
CREATE TABLE `__new_employee_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`employee_id` TEXT NOT NULL,
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
	`confirmed_by` TEXT,
	`confirmed_at_ms` integer,
	`created_by` TEXT NOT NULL,
	`updated_by` TEXT,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_template_id`) REFERENCES `shift_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_employee_schedules`("id", "restaurant_id", "employee_id", "shift_template_id", "work_date", "start_time", "end_time", "break_duration_minutes", "clock_in_time_ms", "clock_out_time_ms", "scheduled_hours", "actual_hours", "overtime_hours", "status", "notes", "manager_notes", "confirmed_by", "confirmed_at_ms", "created_by", "updated_by", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "employee_id", "shift_template_id", "work_date", "start_time", "end_time", "break_duration_minutes", "clock_in_time_ms", "clock_out_time_ms", "scheduled_hours", "actual_hours", "overtime_hours", "status", "notes", "manager_notes", "confirmed_by", "confirmed_at_ms", "created_by", "updated_by", "created_at_ms", "updated_at_ms" FROM `employee_schedules`;--> statement-breakpoint
DROP TABLE `employee_schedules`;--> statement-breakpoint
ALTER TABLE `__new_employee_schedules` RENAME TO `employee_schedules`;--> statement-breakpoint
CREATE INDEX `idx_employee_schedules_restaurant_date` ON `employee_schedules` (`restaurant_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_employee_schedules_employee_date` ON `employee_schedules` (`employee_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_employee_schedules_status_date` ON `employee_schedules` (`status`,`work_date`);--> statement-breakpoint
CREATE TABLE `__new_schedule_swap_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text NOT NULL,
	`requester_employee_id` TEXT NOT NULL,
	`requester_schedule_id` integer NOT NULL,
	`target_employee_id` TEXT,
	`target_schedule_id` integer,
	`request_type` text NOT NULL,
	`reason` text NOT NULL,
	`urgency` text DEFAULT 'normal',
	`is_open_request` integer DEFAULT false,
	`status` text DEFAULT 'pending' NOT NULL,
	`accepted_by` TEXT,
	`accepted_at_ms` integer,
	`approved_by` TEXT,
	`approved_at_ms` integer,
	`rejected_by` TEXT,
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
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_schedule_swap_requests`("id", "restaurant_id", "requester_employee_id", "requester_schedule_id", "target_employee_id", "target_schedule_id", "request_type", "reason", "urgency", "is_open_request", "status", "accepted_by", "accepted_at_ms", "approved_by", "approved_at_ms", "rejected_by", "rejected_at_ms", "rejection_reason", "expires_at_ms", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "requester_employee_id", "requester_schedule_id", "target_employee_id", "target_schedule_id", "request_type", "reason", "urgency", "is_open_request", "status", "accepted_by", "accepted_at_ms", "approved_by", "approved_at_ms", "rejected_by", "rejected_at_ms", "rejection_reason", "expires_at_ms", "created_at_ms", "updated_at_ms" FROM `schedule_swap_requests`;--> statement-breakpoint
DROP TABLE `schedule_swap_requests`;--> statement-breakpoint
ALTER TABLE `__new_schedule_swap_requests` RENAME TO `schedule_swap_requests`;--> statement-breakpoint
CREATE INDEX `idx_schedule_swap_requests_restaurant_status` ON `schedule_swap_requests` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_schedule_swap_requests_requester_status` ON `schedule_swap_requests` (`requester_employee_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_scheduling_rules` (
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
	`created_by` TEXT NOT NULL,
	`updated_by` TEXT,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scheduling_rules`("id", "restaurant_id", "name", "description", "rule_type", "rule_config", "applies_to_roles", "applies_to_employees", "priority", "severity", "is_system_rule", "is_active", "created_by", "updated_by", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "name", "description", "rule_type", "rule_config", "applies_to_roles", "applies_to_employees", "priority", "severity", "is_system_rule", "is_active", "created_by", "updated_by", "created_at_ms", "updated_at_ms" FROM `scheduling_rules`;--> statement-breakpoint
DROP TABLE `scheduling_rules`;--> statement-breakpoint
ALTER TABLE `__new_scheduling_rules` RENAME TO `scheduling_rules`;--> statement-breakpoint
CREATE INDEX `idx_scheduling_rules_restaurant_type_active` ON `scheduling_rules` (`restaurant_id`,`rule_type`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_shift_templates` (
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
	`created_by` TEXT,
	`updated_by` TEXT,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shift_templates`("id", "restaurant_id", "name", "description", "shift_type", "start_time", "end_time", "duration_minutes", "is_split_shift", "break_start_time", "break_end_time", "break_duration_minutes", "applicable_days", "min_employees", "max_employees", "hourly_rate", "overtime_multiplier", "color_code", "icon", "sort_order", "is_active", "created_by", "updated_by", "created_at_ms", "updated_at_ms") SELECT "id", "restaurant_id", "name", "description", "shift_type", "start_time", "end_time", "duration_minutes", "is_split_shift", "break_start_time", "break_end_time", "break_duration_minutes", "applicable_days", "min_employees", "max_employees", "hourly_rate", "overtime_multiplier", "color_code", "icon", "sort_order", "is_active", "created_by", "updated_by", "created_at_ms", "updated_at_ms" FROM `shift_templates`;--> statement-breakpoint
DROP TABLE `shift_templates`;--> statement-breakpoint
ALTER TABLE `__new_shift_templates` RENAME TO `shift_templates`;--> statement-breakpoint
CREATE INDEX `idx_shift_templates_restaurant_active` ON `shift_templates` (`restaurant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_cash_registers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`restaurant_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`current_shift_id` text,
	`hardware_config` text DEFAULT '{}' NOT NULL,
	`peripherals` text DEFAULT '{}' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`last_maintenance_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_cash_registers`("id", "name", "location", "restaurant_id", "is_active", "current_shift_id", "hardware_config", "peripherals", "settings", "last_maintenance_at_ms", "created_at_ms", "updated_at_ms") SELECT "id", "name", "location", "restaurant_id", "is_active", "current_shift_id", "hardware_config", "peripherals", "settings", "last_maintenance_at_ms", "created_at_ms", "updated_at_ms" FROM `cash_registers`;--> statement-breakpoint
DROP TABLE `cash_registers`;--> statement-breakpoint
ALTER TABLE `__new_cash_registers` RENAME TO `cash_registers`;--> statement-breakpoint
CREATE INDEX `idx_cash_registers_restaurant` ON `cash_registers` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_cash_registers_active` ON `cash_registers` (`restaurant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` TEXT NOT NULL,
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
INSERT INTO `__new_receipts`("id", "order_id", "register_id", "shift_id", "receipt_number", "receipt_type", "template_name", "content", "raw_content", "print_status", "print_attempts", "printer_name", "printer_response", "printed_at_ms", "reprinted_count", "last_reprint_at_ms", "created_at_ms") SELECT "id", "order_id", "register_id", "shift_id", "receipt_number", "receipt_type", "template_name", "content", "raw_content", "print_status", "print_attempts", "printer_name", "printer_response", "printed_at_ms", "reprinted_count", "last_reprint_at_ms", "created_at_ms" FROM `receipts`;--> statement-breakpoint
DROP TABLE `receipts`;--> statement-breakpoint
ALTER TABLE `__new_receipts` RENAME TO `receipts`;--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `receipts` (`receipt_number`);--> statement-breakpoint
CREATE INDEX `idx_receipts_order` ON `receipts` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_receipts_register` ON `receipts` (`register_id`);--> statement-breakpoint
CREATE INDEX `idx_receipts_shift` ON `receipts` (`shift_id`);--> statement-breakpoint
CREATE INDEX `idx_receipts_print_status` ON `receipts` (`print_status`);--> statement-breakpoint
CREATE TABLE `__new_group_cart_items` (
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
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_group_cart_items`("id", "group_order_id", "member_id", "menu_item_id", "quantity", "unit_price", "total_price", "customizations", "special_instructions", "status", "added_at_ms", "updated_at_ms") SELECT "id", "group_order_id", "member_id", "menu_item_id", "quantity", "unit_price", "total_price", "customizations", "special_instructions", "status", "added_at_ms", "updated_at_ms" FROM `group_cart_items`;--> statement-breakpoint
DROP TABLE `group_cart_items`;--> statement-breakpoint
ALTER TABLE `__new_group_cart_items` RENAME TO `group_cart_items`;--> statement-breakpoint
CREATE INDEX `idx_group_cart_items_group_order` ON `group_cart_items` (`group_order_id`);--> statement-breakpoint
CREATE INDEX `idx_group_cart_items_member` ON `group_cart_items` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_group_cart_items_status` ON `group_cart_items` (`group_order_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_order_id` text NOT NULL,
	`user_id` TEXT,
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
INSERT INTO `__new_group_members`("id", "group_order_id", "user_id", "session_id", "name", "phone", "email", "avatar_url", "role", "permissions", "joined_at_ms", "last_active_at_ms", "is_active", "left_at_ms") SELECT "id", "group_order_id", "user_id", "session_id", "name", "phone", "email", "avatar_url", "role", "permissions", "joined_at_ms", "last_active_at_ms", "is_active", "left_at_ms" FROM `group_members`;--> statement-breakpoint
DROP TABLE `group_members`;--> statement-breakpoint
ALTER TABLE `__new_group_members` RENAME TO `group_members`;--> statement-breakpoint
CREATE INDEX `idx_group_members_group_order` ON `group_members` (`group_order_id`);--> statement-breakpoint
CREATE INDEX `idx_group_members_session` ON `group_members` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_group_members_user` ON `group_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_group_members_active` ON `group_members` (`group_order_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_split_bills` (
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
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_split_bills`("id", "group_order_id", "member_id", "subtotal", "tax_amount", "service_charge", "discount_amount", "tip_amount", "total_amount", "items", "payment_status", "payment_method", "payment_reference", "paid_at_ms", "created_at_ms", "updated_at_ms") SELECT "id", "group_order_id", "member_id", "subtotal", "tax_amount", "service_charge", "discount_amount", "tip_amount", "total_amount", "items", "payment_status", "payment_method", "payment_reference", "paid_at_ms", "created_at_ms", "updated_at_ms" FROM `split_bills`;--> statement-breakpoint
DROP TABLE `split_bills`;--> statement-breakpoint
ALTER TABLE `__new_split_bills` RENAME TO `split_bills`;--> statement-breakpoint
CREATE INDEX `idx_split_bills_group_order` ON `split_bills` (`group_order_id`);--> statement-breakpoint
CREATE INDEX `idx_split_bills_member` ON `split_bills` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_split_bills_payment_status` ON `split_bills` (`group_order_id`,`payment_status`);--> statement-breakpoint
ALTER TABLE `refunds` DROP COLUMN `processed_at`;--> statement-breakpoint
ALTER TABLE `refunds` DROP COLUMN `completed_at`;