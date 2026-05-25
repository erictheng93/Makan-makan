ALTER TABLE orders ADD COLUMN waiting_list_id TEXT REFERENCES waiting_list(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_waiting_list_idx ON orders(waiting_list_id);

CREATE UNIQUE INDEX IF NOT EXISTS orders_waiting_list_unique
  ON orders(waiting_list_id)
  WHERE waiting_list_id IS NOT NULL AND status NOT IN ('cancelled', 'refunded');
