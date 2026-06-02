CREATE TABLE `customer_recent_markets` (
  `customer_id` text NOT NULL,
  `market_id` text NOT NULL,
  `visited_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_recent_markets_customer_unique`
  ON `customer_recent_markets` (`customer_id`, `market_id`);
--> statement-breakpoint
CREATE INDEX `customer_recent_markets_customer_visited_idx`
  ON `customer_recent_markets` (`customer_id`, `visited_at_ms`);
--> statement-breakpoint
CREATE INDEX `customer_recent_markets_market_idx`
  ON `customer_recent_markets` (`market_id`);
