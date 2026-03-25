-- Reservations and Reservation Slots tables
-- Completes the reservation management feature (schema was missing while service/routes/UI were already implemented)

CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`customer_id` integer,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_email` text,
	`party_size` integer NOT NULL,
	`reservation_date` text NOT NULL,
	`reservation_time` text NOT NULL,
	`duration_minutes` integer NOT NULL DEFAULT 90,
	`table_id` integer,
	`special_requests` text,
	`status` text NOT NULL DEFAULT 'pending',
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
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `reservations_restaurant_status_date_idx` ON `reservations` (`restaurant_id`, `status`, `reservation_date`);
CREATE INDEX `reservations_restaurant_date_time_idx` ON `reservations` (`restaurant_id`, `reservation_date`, `reservation_time`);
CREATE UNIQUE INDEX `reservations_confirmation_code_idx` ON `reservations` (`confirmation_code`);
CREATE INDEX `reservations_customer_phone_idx` ON `reservations` (`customer_phone`);
CREATE INDEX `reservations_table_idx` ON `reservations` (`table_id`);

CREATE TABLE `reservation_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`date` text NOT NULL,
	`time_slot` text NOT NULL,
	`max_capacity` integer NOT NULL,
	`max_tables` integer NOT NULL,
	`current_reservations` integer NOT NULL DEFAULT 0,
	`current_capacity` integer NOT NULL DEFAULT 0,
	`is_available` integer NOT NULL DEFAULT 1,
	`block_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `slots_restaurant_date_slot_idx` ON `reservation_slots` (`restaurant_id`, `date`, `time_slot`);
CREATE INDEX `slots_restaurant_date_avail_idx` ON `reservation_slots` (`restaurant_id`, `date`, `is_available`);
