-- Add current_stock column to ingredient_definitions for inventory tracking
ALTER TABLE ingredient_definitions ADD COLUMN current_stock REAL;
