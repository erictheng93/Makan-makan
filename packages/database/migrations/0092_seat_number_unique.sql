-- Keep the newest usable row for each duplicate seat number before enforcing
-- the invariant. Duplicate rows were never a supported state and cannot be
-- addressed reliably by either the table or seat management UI.
DELETE FROM seats
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY table_id, seat_number
        ORDER BY
          CASE WHEN deleted_at_ms IS NULL THEN 0 ELSE 1 END,
          is_occupied DESC,
          is_active DESC,
          updated_at_ms DESC,
          id DESC
      ) AS duplicate_rank
    FROM seats
  )
  WHERE duplicate_rank > 1
);

UPDATE tables
SET seat_count = (
  SELECT COUNT(*)
  FROM seats
  WHERE seats.table_id = tables.id
)
WHERE qr_mode = 'seat';

DROP INDEX IF EXISTS seats_table_seat_number_idx;
CREATE UNIQUE INDEX seats_table_seat_number_idx
  ON seats(table_id, seat_number);
