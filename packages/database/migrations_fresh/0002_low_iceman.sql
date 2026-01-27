PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_restaurants`("id", "name", "type", "category", "description", "address", "district", "city", "phone", "email", "website", "business_hours", "is_available", "is_active", "logo_url", "banner_url", "image_urls", "shop_qr_code", "shop_qr_code_image_url", "enable_shop_mode", "shop_qr_settings", "shop_qr_version", "settings", "rating", "review_count", "total_orders", "created_at", "updated_at", "deleted_at") SELECT "id", "name", "type", "category", "description", "address", "district", "city", "phone", "email", "website", "business_hours", "is_available", "is_active", "logo_url", "banner_url", "image_urls", "shop_qr_code", "shop_qr_code_image_url", "enable_shop_mode", "shop_qr_settings", "shop_qr_version", "settings", "rating", "review_count", "total_orders", "created_at", "updated_at", "deleted_at" FROM `restaurants`;--> statement-breakpoint
DROP TABLE `restaurants`;--> statement-breakpoint
ALTER TABLE `__new_restaurants` RENAME TO `restaurants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_shop_qr_code_unique` ON `restaurants` (`shop_qr_code`);