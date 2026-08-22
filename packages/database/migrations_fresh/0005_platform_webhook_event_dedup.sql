ALTER TABLE `platform_webhook_logs`
  ADD COLUMN `platform_event_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_webhook_logs_event_unique`
  ON `platform_webhook_logs` (`platform`, `platform_event_id`)
  WHERE `platform_event_id` IS NOT NULL;
