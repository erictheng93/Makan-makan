-- Per-agent print credentials, replacing the single PRINT_AGENT_API_KEY worker
-- secret. Tenant scope is derived by joining register_id -> cash_registers, so
-- an agent can no longer name the restaurant it wants receipts for.
CREATE TABLE IF NOT EXISTS `print_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`register_id` text NOT NULL,
	`label` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_seen_at_ms` integer,
	`revoked_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `print_agents_key_hash_unique` ON `print_agents` (`key_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_print_agents_register` ON `print_agents` (`register_id`);
--> statement-breakpoint
-- When the agent claimed the job. A claim whose agent died before
-- acknowledging is otherwise indistinguishable from one still printing, and
-- stays "printing" forever with nothing to re-queue it.
ALTER TABLE `receipts` ADD COLUMN `claimed_at_ms` integer;
