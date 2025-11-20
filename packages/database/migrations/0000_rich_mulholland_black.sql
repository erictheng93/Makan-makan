CREATE TABLE `restaurants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_shop_qr_code_unique` ON `restaurants` (`shop_qr_code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`phone` text,
	`full_name` text NOT NULL,
	`password` text,
	`password_hash` text NOT NULL,
	`role` integer DEFAULT 5 NOT NULL,
	`restaurant_id` integer,
	`address` text,
	`date_of_birth` text,
	`profile_image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`preferences` text,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`total_spent` integer DEFAULT 0 NOT NULL,
	`last_login_at` integer,
	`password_changed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`image_url` text,
	`icon_url` text,
	`available_hours` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_restaurant_sort_idx` ON `categories` (`restaurant_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `categories_restaurant_active_idx` ON `categories` (`restaurant_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_items_restaurant_category_idx` ON `menu_items` (`restaurant_id`,`category_id`,`is_available`);--> statement-breakpoint
CREATE INDEX `menu_items_restaurant_featured_idx` ON `menu_items` (`restaurant_id`,`is_featured`,`is_available`);--> statement-breakpoint
CREATE INDEX `menu_items_restaurant_popular_idx` ON `menu_items` (`restaurant_id`,`is_popular`,`order_count`);--> statement-breakpoint
CREATE INDEX `menu_items_price_range_idx` ON `menu_items` (`restaurant_id`,`price`);--> statement-breakpoint
CREATE INDEX `menu_items_availability_idx` ON `menu_items` (`is_available`,`inventory_count`);--> statement-breakpoint
CREATE TABLE `tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`occupied_at` integer,
	`occupied_by` text,
	`estimated_free_at` integer,
	`last_cleaned_at` integer,
	`maintenance_notes` text,
	`total_usage` integer DEFAULT 0 NOT NULL,
	`average_occupancy_minutes` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tables_qr_code_unique` ON `tables` (`qr_code`);--> statement-breakpoint
CREATE INDEX `tables_restaurant_number_idx` ON `tables` (`restaurant_id`,`number`);--> statement-breakpoint
CREATE INDEX `tables_restaurant_status_idx` ON `tables` (`restaurant_id`,`is_occupied`,`is_active`);--> statement-breakpoint
CREATE INDEX `tables_qr_code_idx` ON `tables` (`qr_code`);--> statement-breakpoint
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
	`occupied_at` integer,
	`occupied_by` text,
	`total_usage` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seats_qr_code_unique` ON `seats` (`qr_code`);--> statement-breakpoint
CREATE INDEX `seats_table_id_idx` ON `seats` (`table_id`);--> statement-breakpoint
CREATE INDEX `seats_qr_code_idx` ON `seats` (`qr_code`);--> statement-breakpoint
CREATE INDEX `seats_table_seat_number_idx` ON `seats` (`table_id`,`seat_number`);--> statement-breakpoint
CREATE INDEX `seats_is_occupied_idx` ON `seats` (`is_occupied`);--> statement-breakpoint
CREATE INDEX `seats_is_active_idx` ON `seats` (`is_active`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`table_id` integer NOT NULL,
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
	`confirmed_at` integer,
	`preparing_at` integer,
	`ready_at` integer,
	`delivered_at` integer,
	`paid_at` integer,
	`cancelled_at` integer,
	`payment_method` text,
	`payment_status` text DEFAULT 'pending',
	`payment_transaction_id` text,
	`coupon_code` text,
	`promotion_ids` text,
	`rating` integer,
	`review_comment` text,
	`reviewed_at` integer,
	`notes` text,
	`internal_notes` text,
	`cancellation_reason` text,
	`refund_amount` real,
	`delivery_info` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_restaurant_status_idx` ON `orders` (`restaurant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_restaurant_table_idx` ON `orders` (`restaurant_id`,`table_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_time_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`,`paid_at`);--> statement-breakpoint
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
	`prepared_at` integer,
	`served_at` integer,
	`notes` text,
	`kitchen_notes` text,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `order_items_order_status_idx` ON `order_items` (`order_id`,`status`);--> statement-breakpoint
CREATE INDEX `order_items_menu_item_idx` ON `order_items` (`menu_item_id`,`created_at`);--> statement-breakpoint
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
	`last_accessed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_refresh_token_unique` ON `sessions` (`refresh_token`);--> statement-breakpoint
CREATE INDEX `sessions_user_active_idx` ON `sessions` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `sessions_token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`restaurant_id` integer,
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
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_action_idx` ON `audit_logs` (`user_id`,`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_restaurant_action_idx` ON `audit_logs` (`restaurant_id`,`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource`,`resource_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_time_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `error_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`restaurant_id` integer,
	`error_type` text NOT NULL,
	`severity` text NOT NULL,
	`error_code` text,
	`error_message` text NOT NULL,
	`error_context` text,
	`original_error` text,
	`user_agent` text,
	`url` text,
	`timestamp` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	`resolved_by` integer,
	`resolution_notes` text
);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_user_id` ON `error_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_restaurant_id` ON `error_reports` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_error_type` ON `error_reports` (`error_type`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_severity` ON `error_reports` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_timestamp` ON `error_reports` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_created_at` ON `error_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_type_severity` ON `error_reports` (`error_type`,`severity`);--> statement-breakpoint
CREATE INDEX `idx_error_reports_restaurant_timestamp` ON `error_reports` (`restaurant_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `system_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`alert_type` text NOT NULL,
	`restaurant_id` integer,
	`affected_component` text,
	`created_at` text NOT NULL,
	`resolved_at` text,
	`resolved_by` integer,
	`resolution_notes` text,
	`auto_resolved` integer DEFAULT false
);
--> statement-breakpoint
CREATE INDEX `idx_system_alerts_severity` ON `system_alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_system_alerts_restaurant_id` ON `system_alerts` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_system_alerts_created_at` ON `system_alerts` (`created_at`);--> statement-breakpoint
CREATE TABLE `qr_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`restaurant_id` integer NOT NULL,
	`total_codes` integer NOT NULL,
	`generated_codes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_batches_batch_id_unique` ON `qr_batches` (`batch_id`);--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`style_json` text,
	`format` text DEFAULT 'png' NOT NULL,
	`url` text,
	`metadata_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qr_downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`qr_code_id` text NOT NULL,
	`format` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`downloaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qr_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`style_json` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `image_processing_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_id` text NOT NULL,
	`job_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input_params` text,
	`output_data` text,
	`error` text,
	`priority` integer DEFAULT 5 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `image_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_id` text NOT NULL,
	`variant` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`referer` text,
	`viewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`category` text NOT NULL,
	`restaurant_id` integer NOT NULL,
	`uploaded_by` integer,
	`cloudflare_image_id` text,
	`variants` text,
	`metadata` text,
	`is_active` integer DEFAULT true NOT NULL,
	`uploaded_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupon_distributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`distribution_type` text NOT NULL,
	`target_type` text,
	`target_criteria` text,
	`total_distributed` integer DEFAULT 0,
	`total_used` integer DEFAULT 0,
	`distributed_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`expires_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`created_by` integer,
	`notes` text,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_coupon_distributions_coupon_id` ON `coupon_distributions` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_distributions_type` ON `coupon_distributions` (`distribution_type`);--> statement-breakpoint
CREATE INDEX `idx_coupon_distributions_distributed_at` ON `coupon_distributions` (`distributed_at`);--> statement-breakpoint
CREATE TABLE `coupon_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`name` text NOT NULL,
	`description` text,
	`template_data` text NOT NULL,
	`usage_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`is_system_template` integer DEFAULT false,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`created_by` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_coupon_templates_restaurant_id` ON `coupon_templates` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_templates_active` ON `coupon_templates` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_coupon_templates_system` ON `coupon_templates` (`is_system_template`);--> statement-breakpoint
CREATE TABLE `coupon_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`user_id` integer,
	`discount_amount` real NOT NULL,
	`original_amount` real NOT NULL,
	`final_amount` real NOT NULL,
	`used_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`status` text DEFAULT 'active',
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_coupon_usage_coupon_id` ON `coupon_usage` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_usage_order_id` ON `coupon_usage` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_usage_user_id` ON `coupon_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_usage_used_at` ON `coupon_usage` (`used_at`);--> statement-breakpoint
CREATE INDEX `idx_coupon_usage_status` ON `coupon_usage` (`status`);--> statement-breakpoint
CREATE INDEX `idx_coupon_usage_unique` ON `coupon_usage` (`coupon_id`,`order_id`);--> statement-breakpoint
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
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`created_by` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `idx_coupons_code` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `idx_coupons_restaurant_id` ON `coupons` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_coupons_valid_period` ON `coupons` (`valid_from`,`valid_to`);--> statement-breakpoint
CREATE INDEX `idx_coupons_status` ON `coupons` (`is_active`,`is_visible`);--> statement-breakpoint
CREATE INDEX `idx_coupons_discount_type` ON `coupons` (`discount_type`);--> statement-breakpoint
CREATE TABLE `employee_leave_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`leave_type_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`year` integer NOT NULL,
	`total_days` real DEFAULT 0 NOT NULL,
	`used_days` real DEFAULT 0 NOT NULL,
	`pending_days` real DEFAULT 0 NOT NULL,
	`carryover_from_previous` real DEFAULT 0,
	`carryover_to_next` real DEFAULT 0,
	`carryover_expires_at` integer,
	`manual_adjustment` real DEFAULT 0,
	`adjustment_reason` text,
	`adjusted_by` integer,
	`adjusted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_updated_by` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjusted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_approval_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`escalation_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer,
	`name` text NOT NULL,
	`description` text,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurrence_pattern` text,
	`is_working_day` integer DEFAULT false NOT NULL,
	`compensatory_for` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` integer,
	`color` text,
	`icon` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`final_approved_at` integer,
	`rejected_by` integer,
	`rejected_at` integer,
	`rejection_reason` text,
	`cancelled_by` integer,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`affected_schedule_ids` text,
	`replacement_notified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`submitted_at` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`final_approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employee_availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `employee_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`shift_template_id` integer,
	`work_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_duration_minutes` integer DEFAULT 0,
	`clock_in_time` integer,
	`clock_out_time` integer,
	`scheduled_hours` real NOT NULL,
	`actual_hours` real DEFAULT 0,
	`overtime_hours` real DEFAULT 0,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`manager_notes` text,
	`confirmed_by` integer,
	`confirmed_at` integer,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_template_id`) REFERENCES `shift_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedule_swap_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`accepted_at` integer,
	`approved_by` integer,
	`approved_at` integer,
	`rejected_by` integer,
	`rejected_at` integer,
	`rejection_reason` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_schedule_id`) REFERENCES `employee_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_schedule_id`) REFERENCES `employee_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scheduling_conflicts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`conflict_type` text NOT NULL,
	`severity` text NOT NULL,
	`schedule_ids` text NOT NULL,
	`employee_ids` text NOT NULL,
	`rule_id` integer,
	`message` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'unresolved' NOT NULL,
	`resolved_by` integer,
	`resolved_at` integer,
	`resolution_notes` text,
	`detected_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `scheduling_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scheduling_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shift_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_movements` (
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
	`created_at` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_registers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`restaurant_id` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`current_shift_id` text,
	`hardware_config` text DEFAULT '{}' NOT NULL,
	`peripherals` text DEFAULT '{}' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`last_maintenance_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_shifts` (
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
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`closing_notes` text,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receipts` (
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
	`printed_at` integer,
	`reprinted_count` integer DEFAULT 0 NOT NULL,
	`last_reprint_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `receipts` (`receipt_number`);--> statement-breakpoint
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
	`processed_at` integer,
	`completed_at` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`original_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refunds_refund_number_unique` ON `refunds` (`refund_number`);--> statement-breakpoint
CREATE TABLE `shift_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`register_id` text NOT NULL,
	`operator_id` integer NOT NULL,
	`report_data` text NOT NULL,
	`summary_data` text NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`group_order_id` text NOT NULL,
	`member_id` text,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action
);
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
	`added_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_members` (
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
	`joined_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`share_code` text NOT NULL,
	`master_order_id` integer,
	`created_by` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`table_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`split_type` text DEFAULT 'individual' NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`service_charge` real DEFAULT 0 NOT NULL,
	`final_amount` real DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`locked_at` integer,
	`completed_at` integer,
	`settings` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_orders_share_code_unique` ON `group_orders` (`share_code`);--> statement-breakpoint
CREATE TABLE `share_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_by` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`usage_limit` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_codes_code_unique` ON `share_codes` (`code`);--> statement-breakpoint
CREATE TABLE `split_bills` (
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
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_order_id`) REFERENCES `group_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action
);
