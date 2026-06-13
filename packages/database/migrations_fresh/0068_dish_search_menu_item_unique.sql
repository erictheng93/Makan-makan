-- At-least-once search sync may redeliver the same menu-item job.
-- Keep one materialized search row per menu item.
DELETE FROM dish_search_index
WHERE id NOT IN (
  SELECT MIN(id)
  FROM dish_search_index
  GROUP BY menu_item_id
);

CREATE UNIQUE INDEX IF NOT EXISTS dish_search_menu_item_unique
  ON dish_search_index(menu_item_id);
