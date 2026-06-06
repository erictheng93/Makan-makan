ALTER TABLE coupon_usage ADD COLUMN refund_count_released_at_ms INTEGER;
--> statement-breakpoint
UPDATE coupon_usage
   SET refund_count_released_at_ms = coalesce(updated_at_ms, unixepoch('now') * 1000)
 WHERE status = 'refunded'
   AND refund_count_released_at_ms IS NULL;
