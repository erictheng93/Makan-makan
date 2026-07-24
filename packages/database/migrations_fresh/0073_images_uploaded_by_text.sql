-- 0073: images.uploaded_by INTEGER -> TEXT
--
-- users.id is TEXT UUID v7; uploaded_by must match so the image-processor
-- can record the uploading user (spec issue #56, W1/W2). SQLite cannot alter
-- a column type in place, so rebuild the table (same pattern as 0028).
--
-- Data note: legacy INTEGER uploaded_by values reference the retired integer
-- user ids and cannot be mapped to UUIDs; they are preserved as digit strings
-- for auditability. The table is expected to be empty in production (the
-- image-processor was never live before this change).
--
-- No other table declares a FK to images, and images carries no indexes;
-- only the two restaurant-guard triggers need recreating.

DROP TABLE IF EXISTS `images__uploaded_by_text`;
--> statement-breakpoint

CREATE TABLE `images__uploaded_by_text` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`category` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`uploaded_by` text,
	`cloudflare_image_id` text,
	`variants` text,
	`metadata` text,
	`is_active` integer DEFAULT true NOT NULL,
	`uploaded_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `images__uploaded_by_text` (
  `id`,
  `filename`,
  `original_filename`,
  `mime_type`,
  `size`,
  `width`,
  `height`,
  `category`,
  `restaurant_id`,
  `uploaded_by`,
  `cloudflare_image_id`,
  `variants`,
  `metadata`,
  `is_active`,
  `uploaded_at_ms`,
  `updated_at_ms`
)
SELECT
  `id`,
  `filename`,
  `original_filename`,
  `mime_type`,
  `size`,
  `width`,
  `height`,
  `category`,
  `restaurant_id`,
  CAST(`uploaded_by` AS TEXT),
  `cloudflare_image_id`,
  `variants`,
  `metadata`,
  `is_active`,
  `uploaded_at_ms`,
  `updated_at_ms`
FROM `images`;
--> statement-breakpoint

DROP TABLE `images`;
--> statement-breakpoint

ALTER TABLE `images__uploaded_by_text` RENAME TO `images`;
--> statement-breakpoint

CREATE TRIGGER `images_restaurant_guard_bi`
BEFORE INSERT ON `images`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'images.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER `images_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `images`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'images.restaurant_id references missing restaurants.id');
END;
