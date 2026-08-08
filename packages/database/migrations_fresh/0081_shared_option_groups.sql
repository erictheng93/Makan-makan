-- 0081: shared customization option groups
--
-- menu_items.options is free-form JSON owned by one item, so "every drink needs
-- the same 甜度" meant rebuilding the same group per item and editing it 20
-- times. These tables make a group a restaurant-level entity that items
-- reference, with per-item overrides so "this one but no 半糖" stays possible
-- without forking the group.
--
-- READ CONTRACT IS UNCHANGED. The API assembles the same
-- {sizes, customizations, addOns} shape it emits today; `public_id` is what
-- goes out as each `id`, so carts already in a customer's localStorage and the
-- order-time validator keep matching on the strings they know.
--
-- sizes/addOns/customizations are all rows here, told apart by `kind` — they
-- are the same shape (a named thing with a price delta) and splitting them
-- into separate tables would only duplicate every query.

CREATE TABLE `option_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	-- Emitted as the group's `id` in the assembled JSON. Stable across edits.
	`public_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'single' NOT NULL,
	`required` integer DEFAULT 0 NOT NULL,
	`max_selections` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`deleted_at_ms` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `option_choices` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`price_adjustment_cents` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	-- The manual sold-out switch. Shared: 珍珠 selling out is true for every
	-- drink that offers it. "This drink never offers 珍珠" is a per-item
	-- override instead — see menu_item_option_choice_overrides.is_hidden.
	`is_available` integer DEFAULT 1 NOT NULL,
	-- Per-order cap, kind='addon' only.
	`max_quantity` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `menu_item_option_groups` (
	`menu_item_id` integer NOT NULL,
	`group_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	-- NULL means inherit from the group. Set means this item disagrees.
	`required_override` integer,
	`max_selections_override` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	PRIMARY KEY (`menu_item_id`, `group_id`),
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `menu_item_option_choice_overrides` (
	`menu_item_id` integer NOT NULL,
	`choice_id` text NOT NULL,
	`is_hidden` integer DEFAULT 0 NOT NULL,
	-- NULL means inherit the group's price for this choice.
	`price_adjustment_cents` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	PRIMARY KEY (`menu_item_id`, `choice_id`),
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`choice_id`) REFERENCES `option_choices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- D1 bills rows *scanned*, not rows returned, so these indexes are the whole
-- cost story: without the group_id index, assembling one menu scans the entire
-- option_choices table per request.
CREATE INDEX `option_groups_restaurant_idx` ON `option_groups` (`restaurant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_public_id_unique` ON `option_groups` (`restaurant_id`, `public_id`) WHERE `deleted_at_ms` IS NULL;--> statement-breakpoint
CREATE INDEX `option_choices_group_idx` ON `option_choices` (`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `option_choices_public_id_unique` ON `option_choices` (`group_id`, `public_id`);--> statement-breakpoint
-- The composite primary keys already index by menu_item_id (leading column);
-- these cover the reverse direction — "which items use this group/choice",
-- which is what an edit needs in order to invalidate their caches.
CREATE INDEX `menu_item_option_groups_group_idx` ON `menu_item_option_groups` (`group_id`);--> statement-breakpoint
CREATE INDEX `menu_item_option_choice_overrides_choice_idx` ON `menu_item_option_choice_overrides` (`choice_id`);
