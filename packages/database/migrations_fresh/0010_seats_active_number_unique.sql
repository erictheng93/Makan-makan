DROP INDEX IF EXISTS seats_table_seat_number_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX seats_table_seat_number_idx
  ON seats (table_id, seat_number)
  WHERE deleted_at_ms IS NULL;
