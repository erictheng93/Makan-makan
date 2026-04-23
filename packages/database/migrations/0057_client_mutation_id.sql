ALTER TABLE orders
  ADD COLUMN client_mutation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_client_mutation_unique
  ON orders(restaurant_id, client_mutation_id);
