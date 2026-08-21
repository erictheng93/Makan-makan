-- The nightly TTL sweep in apps/api/src/workers/usage-events-ttl.ts deletes on
--   WHERE occurred_at_ms < ? AND aggregated_at_ms IS NOT NULL
-- and no existing index could serve it:
--
--   usage_events_pending_idx          partial ON (aggregated_at_ms) WHERE
--                                     aggregated_at_ms IS NULL — the exact
--                                     complement of the sweep's predicate.
--   usage_events_restaurant_meter_time_idx
--                                     leads with restaurant_id, so a bare
--                                     time-range predicate cannot seek into it.
--
-- So the sweep full-scanned usage_events every night. usageTracker writes one
-- row per API request and retention is 90 days (USAGE_EVENTS_TTL_DAYS), which
-- puts tens of millions of rows in the table — all of them read, every run, at
-- D1's rows-read rate, to delete a thin tail.
--
-- Partial on IS NOT NULL so the index only carries already-aggregated rows: it
-- stays small, and inserts (which write aggregated_at_ms as NULL) do not pay an
-- extra index write. An index costs one additional written row whenever a write
-- touches an indexed column, so keeping this one off the insert path matters at
-- per-request write volume.
CREATE INDEX IF NOT EXISTS `usage_events_ttl_idx`
  ON `usage_events` (`occurred_at_ms`)
  WHERE `aggregated_at_ms` IS NOT NULL;
