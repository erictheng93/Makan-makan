ALTER TABLE orders ADD COLUMN delivery_assigned_to TEXT;
ALTER TABLE orders ADD COLUMN delivery_start_time_ms INTEGER;

CREATE INDEX IF NOT EXISTS orders_ready_delivery_claim_idx
  ON orders (restaurant_id, status, delivery_assigned_to, ready_at_ms);
