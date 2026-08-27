-- #278: a cancellation must put back exactly what the order took, and the
-- recipe it was computed from can change in between. Recording the order on
-- the movement lets the reversal read the ledger instead of re-deriving the
-- amount from a BOM that has since moved.
--
-- ALTER TABLE ADD COLUMN keeps the table STRICT; no recreation is involved.
ALTER TABLE `ingredient_stock_movements` ADD COLUMN `order_id` TEXT;
--> statement-breakpoint
CREATE INDEX `ingredient_stock_movements_order_idx`
  ON `ingredient_stock_movements` (`order_id`);
