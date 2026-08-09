-- Phase A backfills one independent group set per menu item. That means many
-- items in the same restaurant can legitimately have a group public_id such as
-- "spice"; the stable public_id is part of the customer cart contract, not a
-- restaurant-level uniqueness key.
DROP INDEX IF EXISTS `option_groups_public_id_unique`;
