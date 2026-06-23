-- AI analytics tables, payment ledger, and data-integrity hardening.
-- This migration is intentionally in migrations_fresh because wrangler.toml
-- points D1 migrations at packages/database/migrations_fresh.

-- ---------------------------------------------------------------------------
-- AI analytics tables missing from migrations_fresh
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `ai_configurations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `restaurant_id` text NOT NULL,
  `provider` text NOT NULL,
  `api_key_encrypted` text NOT NULL,
  `model` text,
  `custom_base_url` text,
  `enabled` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ai_configurations_restaurant_idx`
  ON `ai_configurations` (`restaurant_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ai_usage_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `restaurant_id` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `operation` text NOT NULL,
  `tokens_used` integer DEFAULT 0 NOT NULL,
  `latency_ms` integer,
  `success` integer DEFAULT true NOT NULL,
  `error_message` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_usage_logs_restaurant_idx`
  ON `ai_usage_logs` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_usage_logs_provider_model_idx`
  ON `ai_usage_logs` (`provider`, `model`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_usage_logs_created_at_idx`
  ON `ai_usage_logs` (`created_at`);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Payment and refund ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `transaction_id` text NOT NULL,
  `order_id` TEXT NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS `payment_transactions_transaction_id_unique`
  ON `payment_transactions` (`transaction_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_transactions_order_idx`
  ON `payment_transactions` (`order_id`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_transactions_restaurant_status_idx`
  ON `payment_transactions` (`restaurant_id`, `status`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_transactions_idempotency_idx`
  ON `payment_transactions` (`idempotency_key`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `refund_transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `refund_id` text NOT NULL,
  `payment_transaction_id` text NOT NULL,
  `order_id` TEXT NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS `refund_transactions_refund_id_unique`
  ON `refund_transactions` (`refund_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `refund_transactions_payment_idx`
  ON `refund_transactions` (`payment_transaction_id`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `refund_transactions_order_idx`
  ON `refund_transactions` (`order_id`, `created_at_ms`);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Queue/coupon uniqueness and tenant lookup indexes
-- ---------------------------------------------------------------------------

ALTER TABLE `waiting_list` ADD COLUMN `queue_date` text;
--> statement-breakpoint
UPDATE `waiting_list`
   SET `queue_date` = date(`created_at` / 1000, 'unixepoch', 'localtime')
 WHERE `queue_date` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `waiting_unique_queue_number_per_day_idx`
  ON `waiting_list` (`restaurant_id`, `queue_date`, `queue_letter`, `queue_number`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `waiting_customer_phone_active_idx`
  ON `waiting_list` (`restaurant_id`, `customer_phone`, `queue_date`, `status`);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `coupon_usage_coupon_order_active_unique`
  ON `coupon_usage` (`coupon_id`, `order_id`)
  WHERE `status` IS NULL OR `status` != 'cancelled';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `users_restaurant_role_active_idx`
  ON `users` (`restaurant_id`, `role`, `is_active`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `restaurants_active_deleted_idx`
  ON `restaurants` (`is_active`, `deleted_at_ms`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_restaurant_payment_tx_idx`
  ON `orders` (`restaurant_id`, `payment_transaction_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `orders_payment_transaction_unique`
  ON `orders` (`payment_transaction_id`)
  WHERE `payment_transaction_id` IS NOT NULL;
