-- Waiting List table
-- Completes the waiting list / queue management feature

CREATE TABLE `waiting_list` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`customer_id` integer,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`party_size` integer NOT NULL,
	`preferred_table_type` text,
	`queue_number` integer NOT NULL,
	`queue_letter` text,
	`priority` integer NOT NULL DEFAULT 0,
	`estimated_wait_minutes` integer,
	`table_id` integer,
	`status` text NOT NULL DEFAULT 'waiting',
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
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `waiting_restaurant_status_idx` ON `waiting_list` (`restaurant_id`, `status`, `created_at`);
CREATE INDEX `waiting_restaurant_queue_idx` ON `waiting_list` (`restaurant_id`, `queue_letter`, `queue_number`);
CREATE INDEX `waiting_customer_phone_idx` ON `waiting_list` (`customer_phone`);
