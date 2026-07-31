-- Two-phase QR rotation (#114).
--
-- A rotation stores the next signed code alongside the live one so the sticker
-- already on the table or seat keeps working while replacements are printed.
-- Activation moves pending -> live per entity, which is what lets a venue swap
-- stickers gradually without any window where a revoked code still verifies.
--
-- Nothing verifies against these columns. They are staging only.

ALTER TABLE tables ADD COLUMN pending_qr_code TEXT;
ALTER TABLE tables ADD COLUMN pending_qr_code_version INTEGER;
ALTER TABLE tables ADD COLUMN pending_qr_prepared_at_ms INTEGER;

ALTER TABLE seats ADD COLUMN pending_qr_code TEXT;
ALTER TABLE seats ADD COLUMN pending_qr_code_version INTEGER;
ALTER TABLE seats ADD COLUMN pending_qr_prepared_at_ms INTEGER;

-- Partial unique: many rows sit with NULL pending, but a prepared code must be
-- as unique as a live one, since activation promotes it into qr_code.
CREATE UNIQUE INDEX tables_pending_qr_code_unique
  ON tables(pending_qr_code) WHERE pending_qr_code IS NOT NULL;
CREATE UNIQUE INDEX seats_pending_qr_code_unique
  ON seats(pending_qr_code) WHERE pending_qr_code IS NOT NULL;
