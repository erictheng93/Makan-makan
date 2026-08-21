-- Print dispatch moves from register-scoped to restaurant-scoped.
--
-- print_agents now holds restaurant_id directly instead of deriving it by
-- joining cash_registers, and register_id becomes optional: an agent with no
-- register serves the shop rather than a till, which is what a kitchen printer
-- is. Receipts match agents on (restaurant, register) with NULL matching NULL,
-- so a till agent takes that till's receipts and a shop agent takes the
-- register-less ones.
--
-- printers_total / printers_online are reported by the agent on each poll, so
-- the back office can tell "the agent is gone" from "the agent is alive and the
-- printer is unplugged" — last_seen_at_ms alone only shows the former.
--
-- SQLite cannot add a NOT NULL column or relax one in place, so both tables are
-- recreated. The staging tables carry STRICT: renaming a non-STRICT table over
-- a STRICT one drops the constraint with no visible diff.
CREATE TABLE `__new_print_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`register_id` text,
	`label` text NOT NULL,
	`key_hash` text NOT NULL,
	`printers_total` integer,
	`printers_online` integer,
	`last_seen_at_ms` integer,
	`revoked_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_print_agents` (
	`id`, `restaurant_id`, `register_id`, `label`, `key_hash`,
	`last_seen_at_ms`, `revoked_at_ms`, `created_at_ms`, `updated_at_ms`
)
SELECT
	`pa`.`id`, `cr`.`restaurant_id`, `pa`.`register_id`, `pa`.`label`, `pa`.`key_hash`,
	`pa`.`last_seen_at_ms`, `pa`.`revoked_at_ms`, `pa`.`created_at_ms`, `pa`.`updated_at_ms`
FROM `print_agents` `pa`
JOIN `cash_registers` `cr` ON `cr`.`id` = `pa`.`register_id`;
--> statement-breakpoint
DROP TABLE `print_agents`;
--> statement-breakpoint
ALTER TABLE `__new_print_agents` RENAME TO `print_agents`;
--> statement-breakpoint
CREATE UNIQUE INDEX `print_agents_key_hash_unique` ON `print_agents` (`key_hash`);
--> statement-breakpoint
CREATE INDEX `idx_print_agents_restaurant` ON `print_agents` (`restaurant_id`);
--> statement-breakpoint
CREATE INDEX `idx_print_agents_register` ON `print_agents` (`register_id`);
--> statement-breakpoint
CREATE TABLE `__new_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` TEXT NOT NULL,
	`register_id` text,
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
	`printed_at_ms` integer,
	`reprinted_count` integer DEFAULT 0 NOT NULL,
	`last_reprint_at_ms` integer,
	`claimed_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_receipts` (
	`id`, `order_id`, `register_id`, `shift_id`, `receipt_number`, `receipt_type`,
	`template_name`, `content`, `raw_content`, `print_status`, `print_attempts`,
	`printer_name`, `printer_response`, `printed_at_ms`, `reprinted_count`,
	`last_reprint_at_ms`, `claimed_at_ms`, `created_at_ms`
)
SELECT
	`id`, `order_id`, `register_id`, `shift_id`, `receipt_number`, `receipt_type`,
	`template_name`, `content`, `raw_content`, `print_status`, `print_attempts`,
	`printer_name`, `printer_response`, `printed_at_ms`, `reprinted_count`,
	`last_reprint_at_ms`, `claimed_at_ms`, `created_at_ms`
FROM `receipts`;
--> statement-breakpoint
DROP TABLE `receipts`;
--> statement-breakpoint
ALTER TABLE `__new_receipts` RENAME TO `receipts`;
--> statement-breakpoint
CREATE INDEX `idx_receipts_order` ON `receipts` (`order_id`);
--> statement-breakpoint
CREATE INDEX `idx_receipts_print_status` ON `receipts` (`print_status`);
--> statement-breakpoint
CREATE INDEX `idx_receipts_register` ON `receipts` (`register_id`);
--> statement-breakpoint
CREATE INDEX `idx_receipts_shift` ON `receipts` (`shift_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `receipts` (`receipt_number`);
