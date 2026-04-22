-- 店家訂閱與模組管理 (Shop Subscriptions & Module Gate)
-- Migration: 0015_shop-subscriptions

CREATE TABLE IF NOT EXISTS `shop_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL UNIQUE,
  `plan_tier` text DEFAULT 'trial' NOT NULL,
  `module_overrides` text DEFAULT '{}',
  `is_active` integer DEFAULT true NOT NULL,
  `trial_ends_at_ms` integer,
  `billing_cycle_start_at_ms` integer,
  `billing_cycle_end_at_ms` integer,
  `notes` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_subscriptions_restaurant_id` ON `shop_subscriptions` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_subscriptions_plan_tier` ON `shop_subscriptions` (`plan_tier`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shop_subscriptions_is_active` ON `shop_subscriptions` (`is_active`);
