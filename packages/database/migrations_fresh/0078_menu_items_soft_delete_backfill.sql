-- 0078_menu_items_soft_delete_backfill.sql
-- Menu item deletion used to be signalled by sort_order = -1 (+ is_available 0)
-- while deleted_at_ms sat unwritten. Deletion now writes deleted_at_ms and
-- every item read filters on it, so rows deleted under the old convention must
-- be moved over — otherwise they would resurface in the admin list the moment
-- the sortOrder filter is removed. sort_order is reset to the 0 default; the
-- update schema (min 0) could never have produced -1, so -1 is a reliable
-- marker of the old delete path. See issue #80.
UPDATE menu_items
SET
  deleted_at_ms = COALESCE(deleted_at_ms, updated_at_ms, unixepoch('now') * 1000),
  sort_order = 0
WHERE
  sort_order = -1;
