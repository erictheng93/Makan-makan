-- Optimistic-lock column for orders. Status updates bump this via
-- `SET version = version + 1` and guards use
-- `WHERE id = ? AND version = ?` so two concurrent actors (chef vs
-- service, manager delegation, etc.) get one success + one 409 conflict.
-- (Tier 2 Batch C — H2 / X6 / X11 release gates.)
ALTER TABLE orders
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
