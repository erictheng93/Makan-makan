-- Audit guard for the users public_id bridge.
--
-- This is intentionally non-destructive. It blocks later auth-principal or
-- primary-key rebuild work if bridge identifiers are missing, duplicated, or
-- malformed.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'users_public_id_bridge',
  'users',
  'public_id',
  'public_id_missing',
  'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `users`
     WHERE `public_id` IS NULL
     ORDER BY `id`
     LIMIT 5
  )),
  'Every users row must have public_id before staff JWT principals or users.id dependent FKs can be rebuilt.'
FROM `users`
WHERE `public_id` IS NULL;
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'users_public_id_bridge',
  'users',
  'public_id',
  'public_id_duplicate',
  'error',
  count(*),
  (SELECT group_concat(`public_id`, ',') FROM (
    SELECT `public_id`
      FROM `users`
     WHERE `public_id` IS NOT NULL
     GROUP BY `public_id`
    HAVING count(*) > 1
     ORDER BY `public_id`
     LIMIT 5
  )),
  'users.public_id must remain unique before it can replace integer staff user ids in auth contracts.'
FROM (
  SELECT `public_id`
    FROM `users`
   WHERE `public_id` IS NOT NULL
   GROUP BY `public_id`
  HAVING count(*) > 1
);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'users_public_id_bridge',
  'users',
  'public_id',
  'public_id_invalid_format',
  'error',
  count(*),
  (SELECT group_concat(`id` || ':' || COALESCE(`public_id`, '<null>'), ',') FROM (
    SELECT `id`, `public_id`
      FROM `users`
     WHERE `public_id` IS NOT NULL
       AND NOT (
         length(`public_id`) = 36
         AND lower(`public_id`) = `public_id`
         AND substr(`public_id`, 9, 1) = '-'
         AND substr(`public_id`, 14, 1) = '-'
         AND substr(`public_id`, 15, 1) = '7'
         AND substr(`public_id`, 19, 1) = '-'
         AND substr(`public_id`, 20, 1) IN ('8', '9', 'a', 'b')
         AND substr(`public_id`, 24, 1) = '-'
         AND replace(`public_id`, '-', '') NOT GLOB '*[^0-9a-f]*'
       )
     ORDER BY `id`
     LIMIT 5
  )),
  'users.public_id must be lowercase UUID-v7-shaped text before staff UUID principals become authoritative.'
FROM `users`
WHERE `public_id` IS NOT NULL
  AND NOT (
    length(`public_id`) = 36
    AND lower(`public_id`) = `public_id`
    AND substr(`public_id`, 9, 1) = '-'
    AND substr(`public_id`, 14, 1) = '-'
    AND substr(`public_id`, 15, 1) = '7'
    AND substr(`public_id`, 19, 1) = '-'
    AND substr(`public_id`, 20, 1) IN ('8', '9', 'a', 'b')
    AND substr(`public_id`, 24, 1) = '-'
    AND replace(`public_id`, '-', '') NOT GLOB '*[^0-9a-f]*'
  );
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_users_public_id_audit_guard`;
--> statement-breakpoint
CREATE TABLE `_migration_assert_users_public_id_audit_guard` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT INTO `_migration_assert_users_public_id_audit_guard`
SELECT `check_name`, `violation_count`
FROM `data_integrity_audit`
WHERE `scope` = 'users_public_id_bridge'
  AND `table_name` = 'users'
  AND `column_name` = 'public_id'
  AND `severity` = 'error';
--> statement-breakpoint

DROP TABLE `_migration_assert_users_public_id_audit_guard`;
