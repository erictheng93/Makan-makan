CREATE UNIQUE INDEX IF NOT EXISTS option_groups_restaurant_public_id_unique
  ON option_groups (restaurant_id, public_id)
  WHERE deleted_at_ms IS NULL;
