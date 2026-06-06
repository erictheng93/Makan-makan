-- Full-text search index for cross-market dish/service discovery.
-- Uses FTS5 with the `trigram` tokenizer, which gives true SUBSTRING matching
-- for CJK text (e.g. searching "牛肉麵" matches "蕃茄牛肉麵") — something the
-- prefix-only LIKE search in DiscoveryService cannot do.
--
-- Trigram caveat: MATCH only works for queries of >= 3 characters. DiscoveryService
-- gates on this and falls back to LIKE for 1-2 character queries.
--
-- This is an EXTERNAL-CONTENT table (content='dish_search_index'): the FTS index
-- stores only the inverted index and reads column values from dish_search_index.
-- The triggers below keep it in sync, so SearchIndexSyncService needs no changes —
-- its existing delete/insert on dish_search_index maintains the FTS index for free.
CREATE VIRTUAL TABLE IF NOT EXISTS dish_search_fts USING fts5(
  dish_name,
  category_name,
  tags,
  content='dish_search_index',
  content_rowid='id',
  tokenize='trigram'
);
--> statement-breakpoint
-- Backfill the FTS index from existing dish_search_index rows.
INSERT INTO dish_search_fts(dish_search_fts) VALUES('rebuild');
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS dish_search_index_fts_ai
AFTER INSERT ON dish_search_index
BEGIN
  INSERT INTO dish_search_fts(rowid, dish_name, category_name, tags)
  VALUES (new.id, new.dish_name, new.category_name, new.tags);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS dish_search_index_fts_ad
AFTER DELETE ON dish_search_index
BEGIN
  INSERT INTO dish_search_fts(dish_search_fts, rowid, dish_name, category_name, tags)
  VALUES ('delete', old.id, old.dish_name, old.category_name, old.tags);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS dish_search_index_fts_au
AFTER UPDATE ON dish_search_index
BEGIN
  INSERT INTO dish_search_fts(dish_search_fts, rowid, dish_name, category_name, tags)
  VALUES ('delete', old.id, old.dish_name, old.category_name, old.tags);
  INSERT INTO dish_search_fts(rowid, dish_name, category_name, tags)
  VALUES (new.id, new.dish_name, new.category_name, new.tags);
END;
