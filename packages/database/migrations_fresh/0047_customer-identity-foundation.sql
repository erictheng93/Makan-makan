-- Customer Identity foundation.
-- Promotes customers.id to the canonical customer FK target and adds the
-- profile-depth tables needed by waiting-list push and marketplace follow.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE `customers__identity_rebuild` (
  `id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `primary_phone` text,
  `primary_email` text,
  `avatar_url` text,
  `locale` text,
  `status` text DEFAULT 'active' NOT NULL,
  `last_seen_at_ms` integer,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `deleted_at_ms` integer
);
--> statement-breakpoint

INSERT INTO `customers__identity_rebuild` (
  `id`,
  `display_name`,
  `primary_phone`,
  `primary_email`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `full_name`,
  `phone`,
  lower(`email`),
  `created_at_ms`,
  `updated_at_ms`
FROM `customers`;
--> statement-breakpoint

DROP TABLE `customers`;
--> statement-breakpoint
ALTER TABLE `customers__identity_rebuild` RENAME TO `customers`;
--> statement-breakpoint

CREATE UNIQUE INDEX `idx_customers_primary_phone` ON `customers` (`primary_phone`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customers_primary_email` ON `customers` (`primary_email`);
--> statement-breakpoint
CREATE INDEX `idx_customers_status_last_seen` ON `customers` (`status`, `last_seen_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_customers_created_at` ON `customers` (`created_at_ms`);
--> statement-breakpoint

CREATE TABLE `customer_preferences` (
  `customer_id` text PRIMARY KEY NOT NULL,
  `dietary_tags` text,
  `allergens` text,
  `default_party_size` integer,
  `marketing_opt_in` integer DEFAULT 0 NOT NULL,
  `waiting_list_opt_in` integer DEFAULT 1 NOT NULL,
  `promo_from_favorites_opt_in` integer DEFAULT 0 NOT NULL,
  `quiet_hours_start` text,
  `quiet_hours_end` text,
  `preferred_payment_method_id` text,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `customer_favorites` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `customer_id` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_favorites_customer_target_unique` ON `customer_favorites` (`customer_id`, `target_type`, `target_id`);
--> statement-breakpoint
CREATE INDEX `customer_favorites_customer_type_created_idx` ON `customer_favorites` (`customer_id`, `target_type`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX `customer_favorites_target_idx` ON `customer_favorites` (`target_type`, `target_id`);
--> statement-breakpoint

CREATE TABLE `customer_push_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` text NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh_key` text NOT NULL,
  `auth_key` text NOT NULL,
  `user_agent` text,
  `device_label` text,
  `last_used_at_ms` integer,
  `failure_count` integer DEFAULT 0 NOT NULL,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_push_subscriptions_customer_idx` ON `customer_push_subscriptions` (`customer_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_push_subscriptions_endpoint_unique` ON `customer_push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE INDEX `customer_push_subscriptions_last_used_idx` ON `customer_push_subscriptions` (`last_used_at_ms`);
--> statement-breakpoint

CREATE TABLE `customer_consents` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` text NOT NULL,
  `consent_type` text NOT NULL,
  `version` text NOT NULL,
  `granted` integer NOT NULL,
  `granted_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `revoked_at_ms` integer,
  `ip_address` text,
  `user_agent` text,
  `source` text,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_consents_customer_type_revoked_idx` ON `customer_consents` (`customer_id`, `consent_type`, `revoked_at_ms`);
--> statement-breakpoint
CREATE INDEX `customer_consents_type_version_idx` ON `customer_consents` (`consent_type`, `version`);
--> statement-breakpoint

CREATE TABLE `customer_phone_verification_tokens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `customer_id` text,
  `phone` text NOT NULL,
  `otp_code` text NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `used_at_ms` integer,
  `attempts` integer DEFAULT 0 NOT NULL,
  `ip_address` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_phone_tokens_phone_expiry_idx` ON `customer_phone_verification_tokens` (`phone`, `expires_at_ms`);
--> statement-breakpoint
CREATE INDEX `customer_phone_tokens_customer_idx` ON `customer_phone_verification_tokens` (`customer_id`);
--> statement-breakpoint

CREATE TABLE `customer_id_mapping__customer_identity` AS
SELECT
  `users`.`id` AS `old_user_id`,
  COALESCE(
    (
      SELECT `customers`.`id`
      FROM `customers`
      WHERE (`customers`.`primary_phone` IS NOT NULL AND `customers`.`primary_phone` = `users`.`phone`)
         OR (`customers`.`primary_email` IS NOT NULL AND `customers`.`primary_email` = lower(`users`.`email`))
      LIMIT 1
    ),
    lower(hex(randomblob(16)))
  ) AS `new_customer_id`
FROM `users`
WHERE `users`.`role` = 5 OR `users`.`role` IS NULL;
--> statement-breakpoint

INSERT INTO `customers` (
  `id`,
  `display_name`,
  `primary_phone`,
  `primary_email`,
  `created_at_ms`,
  `updated_at_ms`
)
SELECT
  `customer_id_mapping__customer_identity`.`new_customer_id`,
  `users`.`full_name`,
  `users`.`phone`,
  lower(`users`.`email`),
  `users`.`created_at_ms`,
  `users`.`updated_at_ms`
FROM `customer_id_mapping__customer_identity`
JOIN `users` ON `users`.`id` = `customer_id_mapping__customer_identity`.`old_user_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `customers`
  WHERE `customers`.`id` = `customer_id_mapping__customer_identity`.`new_customer_id`
);
--> statement-breakpoint

CREATE TABLE `orders__customer_identity_rebuild` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `restaurant_id` text NOT NULL,
  `table_id` integer,
  `customer_id` text,
  `order_number` text NOT NULL,
  `client_mutation_id` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `version` integer DEFAULT 0 NOT NULL,
  `order_type` text DEFAULT 'table',
  `order_source` text DEFAULT 'direct',
  `subtotal` real NOT NULL,
  `tax_amount` real DEFAULT 0 NOT NULL,
  `service_charge` real DEFAULT 0 NOT NULL,
  `discount_amount` real DEFAULT 0 NOT NULL,
  `total_amount` real NOT NULL,
  `subtotal_cents` integer,
  `tax_amount_cents` integer,
  `service_charge_cents` integer,
  `discount_amount_cents` integer,
  `total_amount_cents` integer,
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
  `refund_amount_cents` integer,
  `delivery_info` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `orders__customer_identity_rebuild`
SELECT
  `orders`.`id`,
  `orders`.`restaurant_id`,
  `orders`.`table_id`,
  `customer_id_mapping__customer_identity`.`new_customer_id`,
  `orders`.`order_number`,
  `orders`.`client_mutation_id`,
  `orders`.`status`,
  `orders`.`version`,
  `orders`.`order_type`,
  `orders`.`order_source`,
  `orders`.`subtotal`,
  `orders`.`tax_amount`,
  `orders`.`service_charge`,
  `orders`.`discount_amount`,
  `orders`.`total_amount`,
  `orders`.`subtotal_cents`,
  `orders`.`tax_amount_cents`,
  `orders`.`service_charge_cents`,
  `orders`.`discount_amount_cents`,
  `orders`.`total_amount_cents`,
  `orders`.`customer_info`,
  `orders`.`estimated_prep_time`,
  `orders`.`actual_prep_time`,
  `orders`.`confirmed_at_ms`,
  `orders`.`preparing_at_ms`,
  `orders`.`ready_at_ms`,
  `orders`.`delivered_at_ms`,
  `orders`.`paid_at_ms`,
  `orders`.`cancelled_at_ms`,
  `orders`.`payment_method`,
  `orders`.`payment_status`,
  `orders`.`payment_transaction_id`,
  `orders`.`coupon_code`,
  `orders`.`promotion_ids`,
  `orders`.`rating`,
  `orders`.`review_comment`,
  `orders`.`reviewed_at_ms`,
  `orders`.`notes`,
  `orders`.`internal_notes`,
  `orders`.`cancellation_reason`,
  `orders`.`refund_amount`,
  `orders`.`refund_amount_cents`,
  `orders`.`delivery_info`,
  `orders`.`created_at_ms`,
  `orders`.`updated_at_ms`
FROM `orders`
LEFT JOIN `customer_id_mapping__customer_identity` ON `orders`.`customer_id` = `customer_id_mapping__customer_identity`.`old_user_id`;
--> statement-breakpoint

DROP TABLE `orders`;
--> statement-breakpoint
ALTER TABLE `orders__customer_identity_rebuild` RENAME TO `orders`;
--> statement-breakpoint
CREATE INDEX `orders_restaurant_status_idx` ON `orders` (`restaurant_id`, `status`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX `orders_restaurant_table_idx` ON `orders` (`restaurant_id`, `table_id`, `status`);
--> statement-breakpoint
CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_client_mutation_unique` ON `orders` (`restaurant_id`, `client_mutation_id`);
--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX `orders_status_time_idx` ON `orders` (`status`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`, `paid_at_ms`);
--> statement-breakpoint
CREATE INDEX `orders_restaurant_payment_tx_idx` ON `orders` (`restaurant_id`, `payment_transaction_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_transaction_unique` ON `orders` (`payment_transaction_id`) WHERE `payment_transaction_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `orders_order_source_idx` ON `orders` (`restaurant_id`, `order_source`, `created_at_ms`);
--> statement-breakpoint

CREATE TABLE `waiting_list__customer_identity_rebuild` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL,
  `customer_id` text,
  `customer_name` text NOT NULL,
  `customer_phone` text NOT NULL,
  `party_size` integer NOT NULL,
  `preferred_table_type` text,
  `queue_number` integer NOT NULL,
  `queue_letter` text,
  `queue_date` text,
  `priority` integer DEFAULT 0 NOT NULL,
  `estimated_wait_minutes` integer,
  `table_id` integer,
  `status` text DEFAULT 'waiting' NOT NULL,
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
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `waiting_list__customer_identity_rebuild`
SELECT
  `waiting_list`.`id`,
  `waiting_list`.`restaurant_id`,
  `customer_id_mapping__customer_identity`.`new_customer_id`,
  `waiting_list`.`customer_name`,
  `waiting_list`.`customer_phone`,
  `waiting_list`.`party_size`,
  `waiting_list`.`preferred_table_type`,
  `waiting_list`.`queue_number`,
  `waiting_list`.`queue_letter`,
  `waiting_list`.`queue_date`,
  `waiting_list`.`priority`,
  `waiting_list`.`estimated_wait_minutes`,
  `waiting_list`.`table_id`,
  `waiting_list`.`status`,
  `waiting_list`.`notes`,
  `waiting_list`.`called_at`,
  `waiting_list`.`notified_at`,
  `waiting_list`.`confirmed_at`,
  `waiting_list`.`seated_at`,
  `waiting_list`.`cancelled_at`,
  `waiting_list`.`expired_at`,
  `waiting_list`.`timeout_at`,
  `waiting_list`.`created_at`,
  `waiting_list`.`updated_at`
FROM `waiting_list`
LEFT JOIN `customer_id_mapping__customer_identity` ON `waiting_list`.`customer_id` = `customer_id_mapping__customer_identity`.`old_user_id`;
--> statement-breakpoint
DROP TABLE `waiting_list`;
--> statement-breakpoint
ALTER TABLE `waiting_list__customer_identity_rebuild` RENAME TO `waiting_list`;
--> statement-breakpoint
CREATE INDEX `waiting_restaurant_status_idx` ON `waiting_list` (`restaurant_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `waiting_restaurant_queue_idx` ON `waiting_list` (`restaurant_id`, `queue_letter`, `queue_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `waiting_unique_queue_number_per_day_idx` ON `waiting_list` (`restaurant_id`, `queue_date`, `queue_letter`, `queue_number`);
--> statement-breakpoint
CREATE INDEX `waiting_customer_phone_active_idx` ON `waiting_list` (`restaurant_id`, `customer_phone`, `queue_date`, `status`);
--> statement-breakpoint
CREATE INDEX `waiting_customer_phone_idx` ON `waiting_list` (`customer_phone`);
--> statement-breakpoint

CREATE TABLE `reservations__customer_identity_rebuild` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL,
  `customer_id` text,
  `customer_name` text NOT NULL,
  `customer_phone` text NOT NULL,
  `customer_email` text,
  `party_size` integer NOT NULL,
  `reservation_date` text NOT NULL,
  `reservation_time` text NOT NULL,
  `duration_minutes` integer DEFAULT 90 NOT NULL,
  `table_id` integer,
  `special_requests` text,
  `status` text DEFAULT 'pending' NOT NULL,
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
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `reservations__customer_identity_rebuild`
SELECT
  `reservations`.`id`,
  `reservations`.`restaurant_id`,
  `customer_id_mapping__customer_identity`.`new_customer_id`,
  `reservations`.`customer_name`,
  `reservations`.`customer_phone`,
  `reservations`.`customer_email`,
  `reservations`.`party_size`,
  `reservations`.`reservation_date`,
  `reservations`.`reservation_time`,
  `reservations`.`duration_minutes`,
  `reservations`.`table_id`,
  `reservations`.`special_requests`,
  `reservations`.`status`,
  `reservations`.`confirmation_code`,
  `reservations`.`notes`,
  `reservations`.`confirmed_at`,
  `reservations`.`reminded_at`,
  `reservations`.`arrived_at`,
  `reservations`.`seated_at`,
  `reservations`.`completed_at`,
  `reservations`.`cancelled_at`,
  `reservations`.`no_show_at`,
  `reservations`.`created_at`,
  `reservations`.`updated_at`
FROM `reservations`
LEFT JOIN `customer_id_mapping__customer_identity` ON `reservations`.`customer_id` = `customer_id_mapping__customer_identity`.`old_user_id`;
--> statement-breakpoint
DROP TABLE `reservations`;
--> statement-breakpoint
ALTER TABLE `reservations__customer_identity_rebuild` RENAME TO `reservations`;
--> statement-breakpoint
CREATE INDEX `reservations_restaurant_status_date_idx` ON `reservations` (`restaurant_id`, `status`, `reservation_date`);
--> statement-breakpoint
CREATE INDEX `reservations_restaurant_date_time_idx` ON `reservations` (`restaurant_id`, `reservation_date`, `reservation_time`);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_confirmation_code_idx` ON `reservations` (`confirmation_code`);
--> statement-breakpoint
CREATE INDEX `reservations_customer_phone_idx` ON `reservations` (`customer_phone`);
--> statement-breakpoint
CREATE INDEX `reservations_table_idx` ON `reservations` (`table_id`);
--> statement-breakpoint

DROP TABLE `customer_id_mapping__customer_identity`;
