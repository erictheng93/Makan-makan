-- coupons.valid_from / valid_to become INTEGER Unix milliseconds (#271).
--
-- Every other timestamp on this table is already `_ms` INTEGER. These two were
-- left as TEXT with a comment claiming `YYYY-MM-DD`, which is not what the API
-- writes: `createCouponSchema` uses `z.iso.datetime()`, so production rows hold
-- full ISO-8601 instants (`2026-08-26T14:56:00.000Z`). The comment described a
-- format the API rejects.
--
-- The format mattered because two different comparisons ran against these
-- columns. `assertCouponRedeemable` parsed them with `new Date()`; three query
-- paths compared them lexicographically against `new Date().toISOString()`.
-- Those agree only while every row is a fixed-width Z-suffixed ISO string, and
-- nothing in the database enforced that -- `text` with no CHECK, and STRICT only
-- polices the storage class, not the contents. A row shaped like the schema
-- comment (`valid_to = '2026-08-25'`) sorts *before* `'2026-08-25T15:20:00.000Z'`,
-- so `valid_to >= now` is false and the coupon reads as expired for the whole of
-- its last valid day; a value with a `+08:00` offset misorders outright, since
-- `+` sorts below every digit. Test fixtures already mixed both shapes.
--
-- As INTEGER ms both comparisons are numeric and the invariant is the column
-- type rather than an undocumented convention. `partnership_plans` already
-- stores the same concept as `valid_from_ms` / `valid_to_ms` INTEGER NOT NULL.
--
-- Recreate rather than ADD/DROP COLUMN: the target is NOT NULL, which SQLite
-- cannot add in place without a default, and `valid_from` is indexed, which
-- blocks DROP COLUMN. `__new_coupons` carries `) STRICT` by hand -- drizzle-kit
-- cannot emit the keyword, and renaming a non-STRICT staging table over a STRICT
-- one drops the constraint with no visible diff.
--
-- Backfill via `strftime('%s', ...)`, which parses both the ISO instants the API
-- writes and the bare dates some local fixtures hold. An unparseable value
-- yields NULL and trips NOT NULL, failing the migration loudly instead of
-- writing a silent epoch-0 coupon. Production `coupons` is empty (measured
-- 2026-09-05), so there is nothing to convert there and this is the cheapest
-- window the change will ever have.
--
-- The guard below turns that measurement into a precondition the database
-- checks for itself at apply time. `DROP TABLE coupons` is not inert: three
-- tables reference `coupons(id)` ON DELETE CASCADE (`coupon_usage`,
-- `coupon_distributions`, `user_coupons`) and one ON DELETE SET NULL
-- (`service_bookings`). Verified against D1's local runtime -- dropping a
-- parent that still has referencing rows deletes them, silently and without
-- error. `PRAGMA foreign_keys = OFF` is not an escape: SQLite ignores it inside
-- a transaction, which is where wrangler runs a migration.
--
-- So the safe window is "no dependent rows", and an INSERT into a CHECK-only
-- table asserts exactly that before anything destructive runs. Empty means the
-- whole file is a definition change; non-empty aborts the migration untouched,
-- and that database needs a redemption-history-preserving plan instead.
--
-- Production caveat: `makanmasak-prod` was built from the legacy track, not
-- this baseline, so its `coupons` column set is not guaranteed to match the
-- staging table below and it is almost certainly not yet STRICT (this migration
-- makes it so). The column lists are explicit on both sides of the
-- INSERT ... SELECT, so a column production lacks aborts the file before the
-- DROP -- but a *surplus* legacy column would be dropped silently. Run the
-- CLAUDE.md pre-flight first: rebuild the schema from prod's `sqlite_master`
-- (`d1 export` fails on this database -- fts5 virtual tables), replay this file
-- against that copy, and diff the resulting `coupons` DDL before
-- `pnpm db:migrate:prod`.
CREATE TABLE `__coupon_cascade_guard` (
	`dependents` integer NOT NULL CHECK (`dependents` = 0)
) STRICT;
--> statement-breakpoint
INSERT INTO `__coupon_cascade_guard` (`dependents`)
SELECT (SELECT count(*) FROM `coupon_usage`)
     + (SELECT count(*) FROM `coupon_distributions`)
     + (SELECT count(*) FROM `user_coupons`)
     + (SELECT count(*) FROM `service_bookings` WHERE `coupon_id` IS NOT NULL);
--> statement-breakpoint
DROP TABLE `__coupon_cascade_guard`;
--> statement-breakpoint
CREATE TABLE `__new_coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`discount_type` text NOT NULL,
	`applicable_menu_items` text,
	`applicable_categories` text,
	`usage_limit` integer,
	`usage_limit_per_user` integer,
	`used_count` integer DEFAULT 0,
	`valid_from_ms` integer NOT NULL,
	`valid_to_ms` integer NOT NULL,
	`is_active` integer DEFAULT true,
	`is_visible` integer DEFAULT true,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` TEXT,
	`deleted_at_ms` integer,
	`discount_value_cents` integer,
	`max_discount_amount_cents` integer,
	`min_order_amount_cents` integer,
	`discount_percentage_bps` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_coupons` (
	`id`, `restaurant_id`, `code`, `name`, `description`, `discount_type`,
	`applicable_menu_items`, `applicable_categories`, `usage_limit`,
	`usage_limit_per_user`, `used_count`, `valid_from_ms`, `valid_to_ms`,
	`is_active`, `is_visible`, `created_at_ms`, `updated_at_ms`, `created_by`,
	`deleted_at_ms`, `discount_value_cents`, `max_discount_amount_cents`,
	`min_order_amount_cents`, `discount_percentage_bps`
)
SELECT
	`id`, `restaurant_id`, `code`, `name`, `description`, `discount_type`,
	`applicable_menu_items`, `applicable_categories`, `usage_limit`,
	`usage_limit_per_user`, `used_count`,
	CAST(strftime('%s', `valid_from`) AS INTEGER) * 1000,
	CAST(strftime('%s', `valid_to`) AS INTEGER) * 1000,
	`is_active`, `is_visible`, `created_at_ms`, `updated_at_ms`, `created_by`,
	`deleted_at_ms`, `discount_value_cents`, `max_discount_amount_cents`,
	`min_order_amount_cents`, `discount_percentage_bps`
FROM `coupons`;
--> statement-breakpoint
DROP TABLE `coupons`;
--> statement-breakpoint
ALTER TABLE `__new_coupons` RENAME TO `coupons`;
--> statement-breakpoint
CREATE INDEX `idx_coupons_code` ON `coupons` (`code`);
--> statement-breakpoint
CREATE INDEX `idx_coupons_restaurant_id` ON `coupons` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX `idx_coupons_valid_period` ON `coupons` (`valid_from_ms`,`valid_to_ms`);
--> statement-breakpoint
CREATE INDEX `idx_coupons_status` ON `coupons` (`is_active`,`is_visible`);
--> statement-breakpoint
CREATE INDEX `idx_coupons_discount_type` ON `coupons` (`discount_type`);
--> statement-breakpoint
-- Tenant-scoped code uniqueness, from 0013. DROP TABLE took the indexes with
-- it, so they are recreated here rather than left silently missing.
CREATE UNIQUE INDEX `coupons_restaurant_code_unique` ON `coupons` (`restaurant_id`,`code`)
  WHERE `restaurant_id` IS NOT NULL AND `deleted_at_ms` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_platform_code_unique` ON `coupons` (`code`)
  WHERE `restaurant_id` IS NULL AND `deleted_at_ms` IS NULL;
--> statement-breakpoint
-- Same reason: triggers live on the table and died with it.
CREATE TRIGGER `coupons_restaurant_guard_bi`
BEFORE INSERT ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER `coupons_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupons`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupons.restaurant_id references missing restaurants.id');
END;
