-- ============================================================================
-- Migration: Fix FK Type Mismatches & Standardize Timestamp Column Names
-- ============================================================================
-- Part 1: FK type changes (TEXT → INTEGER) via table recreation
-- Part 2A: Simple renames (Group A) + seconds→ms data conversion
-- Part 2B: Rename _new→_ms + DROP legacy text columns (Group B)
-- Part 2C: TEXT → INTEGER type changes via table recreation (Group C)
-- Part 2D: Simple renames only (Group D)
-- ============================================================================

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- ============================================================================
-- PART 1: FK TYPE MISMATCHES (table recreation required)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. partnerships: created_by TEXT → INTEGER
-- ----------------------------------------------------------------------------
CREATE TABLE `__new_partnerships` (
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
	`contract_start_date` integer NOT NULL,
	`contract_end_date` integer NOT NULL,
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
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_partnerships`("id", "partner_code", "partner_name", "partner_name_en", "partner_type", "contact_person", "contact_title", "contact_phone", "contact_email", "address", "contract_number", "contract_start_date", "contract_end_date", "contract_document_url", "verification_method", "verification_config", "allowed_email_domains", "default_discount_type", "default_discount_value", "total_verified_members", "total_usage_count", "total_discount_given", "total_revenue", "status", "is_active", "logo_url", "description", "notes", "tags", "metadata", "created_at", "updated_at", "created_by")
SELECT "id", "partner_code", "partner_name", "partner_name_en", "partner_type", "contact_person", "contact_title", "contact_phone", "contact_email", "address", "contract_number", "contract_start_date", "contract_end_date", "contract_document_url", "verification_method", "verification_config", "allowed_email_domains", "default_discount_type", "default_discount_value", "total_verified_members", "total_usage_count", "total_discount_given", "total_revenue", "status", "is_active", "logo_url", "description", "notes", "tags", "metadata", "created_at", "updated_at", CAST("created_by" AS INTEGER)
FROM `partnerships`;
--> statement-breakpoint
DROP TABLE `partnerships`;
--> statement-breakpoint
ALTER TABLE `__new_partnerships` RENAME TO `partnerships`;
--> statement-breakpoint
CREATE UNIQUE INDEX `partnerships_partner_code_unique` ON `partnerships` (`partner_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `partnerships_contract_number_unique` ON `partnerships` (`contract_number`);
--> statement-breakpoint
CREATE INDEX `idx_partnerships_code` ON `partnerships` (`partner_code`);
--> statement-breakpoint
CREATE INDEX `idx_partnerships_type` ON `partnerships` (`partner_type`);
--> statement-breakpoint
CREATE INDEX `idx_partnerships_status` ON `partnerships` (`status`,`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_partnerships_contract_dates` ON `partnerships` (`contract_start_date`,`contract_end_date`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 1b. partnership_plans: created_by TEXT → INTEGER
-- ----------------------------------------------------------------------------
CREATE TABLE `__new_partnership_plans` (
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
	`valid_from` integer NOT NULL,
	`valid_to` integer NOT NULL,
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
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_partnership_plans`("id", "partnership_id", "restaurant_id", "plan_code", "plan_name", "plan_name_en", "description", "discount_type", "discount_value", "max_discount_amount", "min_order_amount", "max_order_amount", "applicable_menu_items", "applicable_categories", "excluded_menu_items", "excluded_categories", "applicable_days", "applicable_time_slots", "usage_limit_per_member", "usage_limit_per_day", "daily_usage_count", "total_usage_count", "valid_from", "valid_to", "priority", "can_combine_with_coupons", "can_combine_with_promotions", "is_active", "badge_text", "badge_color", "show_on_menu", "total_discount_given", "total_revenue", "terms_and_conditions", "notes", "metadata", "created_at", "updated_at", "created_by")
SELECT "id", "partnership_id", "restaurant_id", "plan_code", "plan_name", "plan_name_en", "description", "discount_type", "discount_value", "max_discount_amount", "min_order_amount", "max_order_amount", "applicable_menu_items", "applicable_categories", "excluded_menu_items", "excluded_categories", "applicable_days", "applicable_time_slots", "usage_limit_per_member", "usage_limit_per_day", "daily_usage_count", "total_usage_count", "valid_from", "valid_to", "priority", "can_combine_with_coupons", "can_combine_with_promotions", "is_active", "badge_text", "badge_color", "show_on_menu", "total_discount_given", "total_revenue", "terms_and_conditions", "notes", "metadata", "created_at", "updated_at", CAST("created_by" AS INTEGER)
FROM `partnership_plans`;
--> statement-breakpoint
DROP TABLE `partnership_plans`;
--> statement-breakpoint
ALTER TABLE `__new_partnership_plans` RENAME TO `partnership_plans`;
--> statement-breakpoint
CREATE INDEX `idx_partnership_plans_partnership` ON `partnership_plans` (`partnership_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_plans_restaurant` ON `partnership_plans` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_plans_code` ON `partnership_plans` (`partnership_id`,`restaurant_id`,`plan_code`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_plans_valid_period` ON `partnership_plans` (`valid_from`,`valid_to`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 1c. verified_members: verified_by TEXT → INTEGER
-- ----------------------------------------------------------------------------
CREATE TABLE `__new_verified_members` (
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
	`verified_at` integer,
	`verified_by` integer,
	`verification_expiry` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`total_usage_count` integer DEFAULT 0,
	`total_discount_received` real DEFAULT 0,
	`total_spending` real DEFAULT 0,
	`last_used_at` integer,
	`department` text,
	`grade_or_position` text,
	`student_id_photo_url` text,
	`notes` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_verified_members`("id", "partnership_id", "customer_id", "member_id", "member_type", "full_name", "email", "phone", "verification_method", "verification_document_url", "verified_at", "verified_by", "verification_expiry", "status", "rejection_reason", "total_usage_count", "total_discount_received", "total_spending", "last_used_at", "department", "grade_or_position", "student_id_photo_url", "notes", "metadata", "created_at", "updated_at")
SELECT "id", "partnership_id", "customer_id", "member_id", "member_type", "full_name", "email", "phone", "verification_method", "verification_document_url", "verified_at", CAST("verified_by" AS INTEGER), "verification_expiry", "status", "rejection_reason", "total_usage_count", "total_discount_received", "total_spending", "last_used_at", "department", "grade_or_position", "student_id_photo_url", "notes", "metadata", "created_at", "updated_at"
FROM `verified_members`;
--> statement-breakpoint
DROP TABLE `verified_members`;
--> statement-breakpoint
ALTER TABLE `__new_verified_members` RENAME TO `verified_members`;
--> statement-breakpoint
CREATE INDEX `idx_verified_members_partnership` ON `verified_members` (`partnership_id`);
--> statement-breakpoint
CREATE INDEX `idx_verified_members_customer` ON `verified_members` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `idx_verified_members_member_id` ON `verified_members` (`partnership_id`,`member_id`);
--> statement-breakpoint
CREATE INDEX `idx_verified_members_status` ON `verified_members` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_verified_members_email` ON `verified_members` (`email`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 1d. partnership_usage_logs: order_id TEXT → INTEGER, verified_by_user_id TEXT → INTEGER
-- ----------------------------------------------------------------------------
CREATE TABLE `__new_partnership_usage_logs` (
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
	`used_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`channel` text,
	`verification_method` text,
	`verified_by_user_id` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`refunded_at` integer,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `partnership_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `verified_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_partnership_usage_logs`("id", "partnership_id", "plan_id", "member_id", "order_id", "restaurant_id", "discount_type", "discount_value", "discount_amount", "original_amount", "final_amount", "order_items", "used_at", "channel", "verification_method", "verified_by_user_id", "status", "cancelled_at", "cancellation_reason", "refunded_at", "metadata", "created_at")
SELECT "id", "partnership_id", "plan_id", "member_id", CAST("order_id" AS INTEGER), "restaurant_id", "discount_type", "discount_value", "discount_amount", "original_amount", "final_amount", "order_items", "used_at", "channel", "verification_method", CAST("verified_by_user_id" AS INTEGER), "status", "cancelled_at", "cancellation_reason", "refunded_at", "metadata", "created_at"
FROM `partnership_usage_logs`;
--> statement-breakpoint
DROP TABLE `partnership_usage_logs`;
--> statement-breakpoint
ALTER TABLE `__new_partnership_usage_logs` RENAME TO `partnership_usage_logs`;
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_partnership` ON `partnership_usage_logs` (`partnership_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_plan` ON `partnership_usage_logs` (`plan_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_member` ON `partnership_usage_logs` (`member_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_order` ON `partnership_usage_logs` (`order_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_restaurant` ON `partnership_usage_logs` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_date` ON `partnership_usage_logs` (`used_at`);
--> statement-breakpoint
CREATE INDEX `idx_partnership_usage_logs_status` ON `partnership_usage_logs` (`status`);
--> statement-breakpoint

-- ============================================================================
-- PART 2A: GROUP A - Simple renames + seconds→ms data conversion
-- ============================================================================
-- These columns are INTEGER in the DB but stored seconds; rename to _ms and
-- multiply by 1000 to convert to milliseconds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- order_items: prepared_at → prepared_at_ms, served_at → served_at_ms,
--   cancelled_at → cancelled_at_ms, created_at → created_at_ms,
--   updated_at → updated_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `order_items` RENAME COLUMN `prepared_at` TO `prepared_at_ms`;
--> statement-breakpoint
ALTER TABLE `order_items` RENAME COLUMN `served_at` TO `served_at_ms`;
--> statement-breakpoint
ALTER TABLE `order_items` RENAME COLUMN `cancelled_at` TO `cancelled_at_ms`;
--> statement-breakpoint
ALTER TABLE `order_items` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `order_items` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint
UPDATE `order_items` SET `prepared_at_ms` = `prepared_at_ms` * 1000 WHERE `prepared_at_ms` IS NOT NULL AND `prepared_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `order_items` SET `served_at_ms` = `served_at_ms` * 1000 WHERE `served_at_ms` IS NOT NULL AND `served_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `order_items` SET `cancelled_at_ms` = `cancelled_at_ms` * 1000 WHERE `cancelled_at_ms` IS NOT NULL AND `cancelled_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `order_items` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `order_items` SET `updated_at_ms` = `updated_at_ms` * 1000 WHERE `updated_at_ms` IS NOT NULL AND `updated_at_ms` < 10000000000;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- seats: occupied_at → occupied_at_ms, created_at → created_at_ms,
--   updated_at → updated_at_ms, deleted_at → deleted_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `seats` RENAME COLUMN `occupied_at` TO `occupied_at_ms`;
--> statement-breakpoint
ALTER TABLE `seats` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `seats` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint
ALTER TABLE `seats` RENAME COLUMN `deleted_at` TO `deleted_at_ms`;
--> statement-breakpoint
UPDATE `seats` SET `occupied_at_ms` = `occupied_at_ms` * 1000 WHERE `occupied_at_ms` IS NOT NULL AND `occupied_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `seats` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `seats` SET `updated_at_ms` = `updated_at_ms` * 1000 WHERE `updated_at_ms` IS NOT NULL AND `updated_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `seats` SET `deleted_at_ms` = `deleted_at_ms` * 1000 WHERE `deleted_at_ms` IS NOT NULL AND `deleted_at_ms` < 10000000000;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- sessions: last_accessed_at → last_accessed_at_ms, expires_at → expires_at_ms,
--   created_at → created_at_ms, updated_at → updated_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `sessions` RENAME COLUMN `last_accessed_at` TO `last_accessed_at_ms`;
--> statement-breakpoint
ALTER TABLE `sessions` RENAME COLUMN `expires_at` TO `expires_at_ms`;
--> statement-breakpoint
ALTER TABLE `sessions` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `sessions` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint
UPDATE `sessions` SET `last_accessed_at_ms` = `last_accessed_at_ms` * 1000 WHERE `last_accessed_at_ms` IS NOT NULL AND `last_accessed_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `sessions` SET `expires_at_ms` = `expires_at_ms` * 1000 WHERE `expires_at_ms` IS NOT NULL AND `expires_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `sessions` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `sessions` SET `updated_at_ms` = `updated_at_ms` * 1000 WHERE `updated_at_ms` IS NOT NULL AND `updated_at_ms` < 10000000000;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- password_reset_tokens: expires_at → expires_at_ms, used_at → used_at_ms,
--   created_at → created_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `password_reset_tokens` RENAME COLUMN `expires_at` TO `expires_at_ms`;
--> statement-breakpoint
ALTER TABLE `password_reset_tokens` RENAME COLUMN `used_at` TO `used_at_ms`;
--> statement-breakpoint
ALTER TABLE `password_reset_tokens` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
UPDATE `password_reset_tokens` SET `expires_at_ms` = `expires_at_ms` * 1000 WHERE `expires_at_ms` IS NOT NULL AND `expires_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `password_reset_tokens` SET `used_at_ms` = `used_at_ms` * 1000 WHERE `used_at_ms` IS NOT NULL AND `used_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `password_reset_tokens` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- email_verification_tokens: expires_at → expires_at_ms,
--   verified_at → verified_at_ms, created_at → created_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `email_verification_tokens` RENAME COLUMN `expires_at` TO `expires_at_ms`;
--> statement-breakpoint
ALTER TABLE `email_verification_tokens` RENAME COLUMN `verified_at` TO `verified_at_ms`;
--> statement-breakpoint
ALTER TABLE `email_verification_tokens` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
UPDATE `email_verification_tokens` SET `expires_at_ms` = `expires_at_ms` * 1000 WHERE `expires_at_ms` IS NOT NULL AND `expires_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `email_verification_tokens` SET `verified_at_ms` = `verified_at_ms` * 1000 WHERE `verified_at_ms` IS NOT NULL AND `verified_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `email_verification_tokens` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- phone_verification_tokens: expires_at → expires_at_ms,
--   verified_at → verified_at_ms, created_at → created_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `phone_verification_tokens` RENAME COLUMN `expires_at` TO `expires_at_ms`;
--> statement-breakpoint
ALTER TABLE `phone_verification_tokens` RENAME COLUMN `verified_at` TO `verified_at_ms`;
--> statement-breakpoint
ALTER TABLE `phone_verification_tokens` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
UPDATE `phone_verification_tokens` SET `expires_at_ms` = `expires_at_ms` * 1000 WHERE `expires_at_ms` IS NOT NULL AND `expires_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `phone_verification_tokens` SET `verified_at_ms` = `verified_at_ms` * 1000 WHERE `verified_at_ms` IS NOT NULL AND `verified_at_ms` < 10000000000;
--> statement-breakpoint
UPDATE `phone_verification_tokens` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- password_change_logs: created_at → created_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `password_change_logs` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
UPDATE `password_change_logs` SET `created_at_ms` = `created_at_ms` * 1000 WHERE `created_at_ms` IS NOT NULL AND `created_at_ms` < 10000000000;
--> statement-breakpoint

-- ============================================================================
-- PART 2B: GROUP B - Rename _new → _ms + DROP legacy text columns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- qr_codes: created_at_new → created_at_ms, DROP created_at (text)
-- ----------------------------------------------------------------------------
ALTER TABLE `qr_codes` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `qr_codes` DROP COLUMN `created_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- qr_templates: created_at_new → created_at_ms, updated_at_new → updated_at_ms,
--   DROP created_at, DROP updated_at
-- ----------------------------------------------------------------------------
ALTER TABLE `qr_templates` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `qr_templates` RENAME COLUMN `updated_at_new` TO `updated_at_ms`;
--> statement-breakpoint
ALTER TABLE `qr_templates` DROP COLUMN `created_at`;
--> statement-breakpoint
ALTER TABLE `qr_templates` DROP COLUMN `updated_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- qr_downloads: downloaded_at_new → downloaded_at_ms, DROP downloaded_at
-- ----------------------------------------------------------------------------
ALTER TABLE `qr_downloads` RENAME COLUMN `downloaded_at_new` TO `downloaded_at_ms`;
--> statement-breakpoint
ALTER TABLE `qr_downloads` DROP COLUMN `downloaded_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- qr_batches: created_at_new → created_at_ms, completed_at_new → completed_at_ms,
--   DROP created_at, DROP completed_at
-- ----------------------------------------------------------------------------
ALTER TABLE `qr_batches` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `qr_batches` RENAME COLUMN `completed_at_new` TO `completed_at_ms`;
--> statement-breakpoint
ALTER TABLE `qr_batches` DROP COLUMN `created_at`;
--> statement-breakpoint
ALTER TABLE `qr_batches` DROP COLUMN `completed_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- images: uploaded_at_new → uploaded_at_ms, updated_at_new → updated_at_ms,
--   DROP uploaded_at, DROP updated_at
-- ----------------------------------------------------------------------------
ALTER TABLE `images` RENAME COLUMN `uploaded_at_new` TO `uploaded_at_ms`;
--> statement-breakpoint
ALTER TABLE `images` RENAME COLUMN `updated_at_new` TO `updated_at_ms`;
--> statement-breakpoint
ALTER TABLE `images` DROP COLUMN `uploaded_at`;
--> statement-breakpoint
ALTER TABLE `images` DROP COLUMN `updated_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- image_views: viewed_at_new → viewed_at_ms, DROP viewed_at
-- ----------------------------------------------------------------------------
ALTER TABLE `image_views` RENAME COLUMN `viewed_at_new` TO `viewed_at_ms`;
--> statement-breakpoint
ALTER TABLE `image_views` DROP COLUMN `viewed_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- image_processing_jobs: created_at_new → created_at_ms,
--   started_at_new → started_at_ms, completed_at_new → completed_at_ms,
--   DROP created_at, DROP started_at, DROP completed_at
-- ----------------------------------------------------------------------------
ALTER TABLE `image_processing_jobs` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `image_processing_jobs` RENAME COLUMN `started_at_new` TO `started_at_ms`;
--> statement-breakpoint
ALTER TABLE `image_processing_jobs` RENAME COLUMN `completed_at_new` TO `completed_at_ms`;
--> statement-breakpoint
ALTER TABLE `image_processing_jobs` DROP COLUMN `created_at`;
--> statement-breakpoint
ALTER TABLE `image_processing_jobs` DROP COLUMN `started_at`;
--> statement-breakpoint
ALTER TABLE `image_processing_jobs` DROP COLUMN `completed_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- coupons: created_at_new → created_at_ms, updated_at_new → updated_at_ms,
--   deleted_at → deleted_at_ms, DROP created_at (text), DROP updated_at (text)
-- ----------------------------------------------------------------------------
ALTER TABLE `coupons` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupons` RENAME COLUMN `updated_at_new` TO `updated_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupons` RENAME COLUMN `deleted_at` TO `deleted_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupons` DROP COLUMN `created_at`;
--> statement-breakpoint
ALTER TABLE `coupons` DROP COLUMN `updated_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- coupon_usage: used_at_new → used_at_ms, created_at_new → created_at_ms,
--   updated_at_new → updated_at_ms, DROP used_at, DROP created_at, DROP updated_at
-- ----------------------------------------------------------------------------
ALTER TABLE `coupon_usage` RENAME COLUMN `used_at_new` TO `used_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` RENAME COLUMN `updated_at_new` TO `updated_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` DROP COLUMN `used_at`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` DROP COLUMN `created_at`;
--> statement-breakpoint
ALTER TABLE `coupon_usage` DROP COLUMN `updated_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- coupon_distributions: distributed_at_new → distributed_at_ms,
--   expires_at_new → expires_at_ms, created_at_new → created_at_ms,
--   DROP distributed_at, DROP expires_at, DROP created_at
-- ----------------------------------------------------------------------------
ALTER TABLE `coupon_distributions` RENAME COLUMN `distributed_at_new` TO `distributed_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_distributions` RENAME COLUMN `expires_at_new` TO `expires_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_distributions` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_distributions` DROP COLUMN `distributed_at`;
--> statement-breakpoint
ALTER TABLE `coupon_distributions` DROP COLUMN `expires_at`;
--> statement-breakpoint
ALTER TABLE `coupon_distributions` DROP COLUMN `created_at`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- coupon_templates: created_at_new → created_at_ms,
--   updated_at_new → updated_at_ms, DROP created_at, DROP updated_at
-- ----------------------------------------------------------------------------
ALTER TABLE `coupon_templates` RENAME COLUMN `created_at_new` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_templates` RENAME COLUMN `updated_at_new` TO `updated_at_ms`;
--> statement-breakpoint
ALTER TABLE `coupon_templates` DROP COLUMN `created_at`;
--> statement-breakpoint
ALTER TABLE `coupon_templates` DROP COLUMN `updated_at`;
--> statement-breakpoint

-- ============================================================================
-- PART 2C: GROUP C - TEXT → INTEGER type changes (table recreation)
-- ============================================================================
-- error_reports and system_alerts have TEXT timestamp columns that need
-- to become INTEGER (milliseconds).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- error_reports: timestamp (text) → timestamp_ms (integer),
--   created_at (text) → created_at_ms (integer),
--   resolved_at (text) → resolved_at_ms (integer)
-- ----------------------------------------------------------------------------
CREATE TABLE `__new_error_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`restaurant_id` text,
	`error_type` text NOT NULL,
	`severity` text NOT NULL,
	`error_code` text,
	`error_message` text NOT NULL,
	`error_context` text,
	`original_error` text,
	`user_agent` text,
	`url` text,
	`timestamp_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer,
	`resolved_by` integer,
	`resolution_notes` text
);
--> statement-breakpoint
INSERT INTO `__new_error_reports`("id", "user_id", "restaurant_id", "error_type", "severity", "error_code", "error_message", "error_context", "original_error", "user_agent", "url", "timestamp_ms", "created_at_ms", "resolved_at_ms", "resolved_by", "resolution_notes")
SELECT "id", "user_id", "restaurant_id", "error_type", "severity", "error_code", "error_message", "error_context", "original_error", "user_agent", "url",
	CASE
		WHEN "timestamp" IS NOT NULL AND "timestamp" != '' THEN CAST(strftime('%s', "timestamp") AS INTEGER) * 1000
		ELSE NULL
	END,
	CASE
		WHEN "created_at" IS NOT NULL AND "created_at" != '' THEN CAST(strftime('%s', "created_at") AS INTEGER) * 1000
		ELSE NULL
	END,
	CASE
		WHEN "resolved_at" IS NOT NULL AND "resolved_at" != '' THEN CAST(strftime('%s', "resolved_at") AS INTEGER) * 1000
		ELSE NULL
	END,
	"resolved_by", "resolution_notes"
FROM `error_reports`;
--> statement-breakpoint
DROP TABLE `error_reports`;
--> statement-breakpoint
ALTER TABLE `__new_error_reports` RENAME TO `error_reports`;
--> statement-breakpoint
CREATE INDEX `idx_error_reports_user_id` ON `error_reports` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_restaurant_id` ON `error_reports` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_error_type` ON `error_reports` (`error_type`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_severity` ON `error_reports` (`severity`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_timestamp` ON `error_reports` (`timestamp_ms`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_created_at` ON `error_reports` (`created_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_type_severity` ON `error_reports` (`error_type`,`severity`);
--> statement-breakpoint
CREATE INDEX `idx_error_reports_restaurant_timestamp` ON `error_reports` (`restaurant_id`,`timestamp_ms`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- system_alerts: created_at (text) → created_at_ms (integer),
--   resolved_at (text) → resolved_at_ms (integer)
-- ----------------------------------------------------------------------------
CREATE TABLE `__new_system_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`alert_type` text NOT NULL,
	`restaurant_id` text,
	`affected_component` text,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer,
	`resolved_by` integer,
	`resolution_notes` text,
	`auto_resolved` integer DEFAULT false
);
--> statement-breakpoint
INSERT INTO `__new_system_alerts`("id", "title", "description", "severity", "alert_type", "restaurant_id", "affected_component", "created_at_ms", "resolved_at_ms", "resolved_by", "resolution_notes", "auto_resolved")
SELECT "id", "title", "description", "severity", "alert_type", "restaurant_id", "affected_component",
	CASE
		WHEN "created_at" IS NOT NULL AND "created_at" != '' THEN CAST(strftime('%s', "created_at") AS INTEGER) * 1000
		ELSE NULL
	END,
	CASE
		WHEN "resolved_at" IS NOT NULL AND "resolved_at" != '' THEN CAST(strftime('%s', "resolved_at") AS INTEGER) * 1000
		ELSE NULL
	END,
	"resolved_by", "resolution_notes", "auto_resolved"
FROM `system_alerts`;
--> statement-breakpoint
DROP TABLE `system_alerts`;
--> statement-breakpoint
ALTER TABLE `__new_system_alerts` RENAME TO `system_alerts`;
--> statement-breakpoint
CREATE INDEX `idx_system_alerts_severity` ON `system_alerts` (`severity`);
--> statement-breakpoint
CREATE INDEX `idx_system_alerts_restaurant_id` ON `system_alerts` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX `idx_system_alerts_created_at` ON `system_alerts` (`created_at_ms`);
--> statement-breakpoint

-- ============================================================================
-- PART 2D: GROUP D - Simple renames only (mode already correct)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- customers: created_at → created_at_ms, updated_at → updated_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `customers` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `customers` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- partnerships: contract_start_date → contract_start_date_ms,
--   contract_end_date → contract_end_date_ms,
--   created_at → created_at_ms, updated_at → updated_at_ms
-- (Note: partnerships was just recreated in Part 1; columns still have old names)
-- ----------------------------------------------------------------------------
ALTER TABLE `partnerships` RENAME COLUMN `contract_start_date` TO `contract_start_date_ms`;
--> statement-breakpoint
ALTER TABLE `partnerships` RENAME COLUMN `contract_end_date` TO `contract_end_date_ms`;
--> statement-breakpoint
ALTER TABLE `partnerships` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `partnerships` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- partnership_plans: valid_from → valid_from_ms, valid_to → valid_to_ms,
--   created_at → created_at_ms, updated_at → updated_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `partnership_plans` RENAME COLUMN `valid_from` TO `valid_from_ms`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` RENAME COLUMN `valid_to` TO `valid_to_ms`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `partnership_plans` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- verified_members: verified_at → verified_at_ms,
--   verification_expiry → verification_expiry_ms,
--   last_used_at → last_used_at_ms,
--   created_at → created_at_ms, updated_at → updated_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `verified_members` RENAME COLUMN `verified_at` TO `verified_at_ms`;
--> statement-breakpoint
ALTER TABLE `verified_members` RENAME COLUMN `verification_expiry` TO `verification_expiry_ms`;
--> statement-breakpoint
ALTER TABLE `verified_members` RENAME COLUMN `last_used_at` TO `last_used_at_ms`;
--> statement-breakpoint
ALTER TABLE `verified_members` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint
ALTER TABLE `verified_members` RENAME COLUMN `updated_at` TO `updated_at_ms`;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- partnership_usage_logs: used_at → used_at_ms, cancelled_at → cancelled_at_ms,
--   refunded_at → refunded_at_ms, created_at → created_at_ms
-- ----------------------------------------------------------------------------
ALTER TABLE `partnership_usage_logs` RENAME COLUMN `used_at` TO `used_at_ms`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` RENAME COLUMN `cancelled_at` TO `cancelled_at_ms`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` RENAME COLUMN `refunded_at` TO `refunded_at_ms`;
--> statement-breakpoint
ALTER TABLE `partnership_usage_logs` RENAME COLUMN `created_at` TO `created_at_ms`;
--> statement-breakpoint

-- ============================================================================
-- Re-enable foreign keys
-- ============================================================================
PRAGMA foreign_keys=ON;
