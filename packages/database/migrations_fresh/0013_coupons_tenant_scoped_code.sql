-- Coupon codes become unique per tenant instead of platform-wide (#269).
--
-- `coupons_code_unique` was a single-column unique index on `code`, so the
-- first restaurant to claim WELCOME10 locked every other restaurant out of
-- that code across the whole platform. Nothing about the product wants that:
-- a coupon belongs to one restaurant and is validated against it.
--
-- The replacement is two partial unique indexes rather than one composite:
-- SQLite treats NULLs as distinct inside a unique index, so a plain
-- UNIQUE(restaurant_id, code) would place no constraint at all on platform
-- coupons (restaurant_id IS NULL) and let duplicates of those through.
--
-- Both exclude soft-deleted rows. deleteCoupon sets deleted_at_ms instead of
-- removing the row, so without that predicate a deleted coupon would hold its
-- code hostage for good.
--
-- Widening a constraint never invalidates existing rows: everything legal
-- under the platform-wide index stays legal under these two.
DROP INDEX IF EXISTS `coupons_code_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_restaurant_code_unique` ON `coupons` (`restaurant_id`,`code`)
  WHERE `restaurant_id` IS NOT NULL AND `deleted_at_ms` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_platform_code_unique` ON `coupons` (`code`)
  WHERE `restaurant_id` IS NULL AND `deleted_at_ms` IS NULL;
