-- 0076_menu_name_en.sql
-- The admin menu forms have always had English-name inputs (item filters even
-- search on the item one), but no columns existed, so zod stripped the fields
-- and the values were discarded on every save. See issue #107.
ALTER TABLE menu_items ADD COLUMN name_en TEXT;
ALTER TABLE categories ADD COLUMN name_en TEXT;
