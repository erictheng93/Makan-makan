-- Stock movements for ingredients (#277).
--
-- `ingredient_definitions.current_stock` was a bare scalar that only ever
-- moved when an owner retyped it, so a stock figure could not be explained or
-- reconciled. This is the ledger those changes are recorded in; the scalar
-- stays as a read cache because the read paths are many (BOM explosion, the
-- procurement list, the low-stock badge and filter) and each would otherwise
-- have to aggregate.
--
-- STRICT is written by hand: drizzle-kit cannot emit the keyword, and without
-- it SQLite's flexible typing would silently accept TEXT in `delta`.
CREATE TABLE `ingredient_stock_movements` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  ingredient_id INTEGER NOT NULL,
  -- Signed: positive receives stock, negative consumes or writes it off.
  delta REAL NOT NULL,
  -- Stock after applying this movement, so the ledger can be read back
  -- without re-summing, and a drift between it and current_stock is visible.
  balance_after REAL NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient_definitions`(`id`) ON UPDATE no action ON DELETE cascade
) STRICT;
--> statement-breakpoint
-- The history drawer reads one ingredient newest-first.
CREATE INDEX ingredient_stock_movements_ingredient_idx
  ON ingredient_stock_movements (ingredient_id, created_at_ms);
--> statement-breakpoint
CREATE INDEX ingredient_stock_movements_restaurant_idx
  ON ingredient_stock_movements (restaurant_id, created_at_ms);
--> statement-breakpoint
-- Same guards every other restaurant-scoped table carries: the FK alone is not
-- enforced unless foreign_keys is on, and these fail loudly either way.
CREATE TRIGGER `ingredient_stock_movements_restaurant_guard_bi`
BEFORE INSERT ON `ingredient_stock_movements`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'ingredient_stock_movements.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER `ingredient_stock_movements_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `ingredient_stock_movements`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'ingredient_stock_movements.restaurant_id references missing restaurants.id');
END;
