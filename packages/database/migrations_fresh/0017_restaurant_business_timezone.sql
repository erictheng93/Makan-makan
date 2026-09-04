-- Cut each restaurant's business day at its own timezone (#329).
--
-- Every revenue and report bucket on the platform was a hardcoded '+8 hours',
-- so a GMT+9 shop's 00:30 order landed in the previous business day and a
-- GMT+7 shop's 23:30 order landed in the next one. The owner reconciling
-- against the till had no way to see why -- the timezone they picked was
-- displayed back to them intact.
--
-- ALTER TABLE ADD COLUMN rather than a recreate: `restaurants` predates the
-- STRICT policy on the production lineage and is the target of foreign keys
-- from most of the schema, so recreating it is a far larger change than this
-- needs. NOT NULL with a default keeps existing rows on exactly the boundary
-- they were already being bucketed at.
ALTER TABLE `restaurants` ADD COLUMN `timezone` TEXT NOT NULL DEFAULT 'Asia/Taipei';
--> statement-breakpoint
-- Backfill the value #309 started persisting into `settings`, but only where
-- the platform can actually bucket by it. The old selector also offered
-- America/New_York and America/Los_Angeles, whose offsets move twice a year
-- and cannot be written as a SQLite date modifier; those rows keep the
-- default rather than acquiring a boundary the SQL layer would ignore.
UPDATE `restaurants`
SET `timezone` = json_extract(`settings`, '$.timezone')
WHERE json_valid(`settings`)
  AND json_extract(`settings`, '$.timezone') IN (
    'Asia/Taipei',
    'Asia/Kuala_Lumpur',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Ho_Chi_Minh',
    'Asia/Jakarta'
  );
--> statement-breakpoint
-- ...then drop the settings copy. Leaving both would put the day boundary in
-- two places with nothing keeping them equal.
UPDATE `restaurants`
SET `settings` = json_remove(`settings`, '$.timezone')
WHERE json_valid(`settings`)
  AND json_extract(`settings`, '$.timezone') IS NOT NULL;
