ALTER TABLE markets ADD COLUMN platform_fee_rate_bps INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE market_checkout_sessions ADD COLUMN platform_fee_rate_bps INTEGER NOT NULL DEFAULT 0;
