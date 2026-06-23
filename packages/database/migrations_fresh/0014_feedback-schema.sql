-- 店家反饋模組 (Shop Feedback Module)
-- Migration: 0014_feedback-schema

CREATE TABLE IF NOT EXISTS `shop_feedback` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `restaurant_id` text NOT NULL,
  `user_id` TEXT NOT NULL,
  `category` text NOT NULL,
  `priority` text DEFAULT 'medium' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `related_module` text DEFAULT 'other' NOT NULL,
  `subject` text NOT NULL,
  `description` text NOT NULL,
  `attachment_urls` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `resolved_at_ms` integer,
  `resolved_by` TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feedback_responses` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `feedback_id` integer NOT NULL,
  `user_id` TEXT NOT NULL,
  `message` text NOT NULL,
  `is_internal` integer DEFAULT false NOT NULL,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_restaurant_id` ON `shop_feedback` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_user_id` ON `shop_feedback` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_status` ON `shop_feedback` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_category` ON `shop_feedback` (`category`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_created_at` ON `shop_feedback` (`created_at_ms`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_restaurant_status` ON `shop_feedback` (`restaurant_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_feedback_category_status` ON `shop_feedback` (`category`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_feedback_responses_feedback_id` ON `feedback_responses` (`feedback_id`);
