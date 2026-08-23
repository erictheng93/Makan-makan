-- One member has one share in a group order. Existing duplicate rows are
-- reduced before enforcing that invariant so this migration is safe to apply
-- to databases created before the unique index existed.
DELETE FROM `split_bills`
WHERE `id` IN (
  SELECT `id`
  FROM (
    SELECT
      `id`,
      ROW_NUMBER() OVER (
        PARTITION BY `group_order_id`, `member_id`
        ORDER BY
          CASE WHEN `payment_status` = 'paid' THEN 1 ELSE 0 END DESC,
          `updated_at_ms` DESC,
          `id` DESC
      ) AS `duplicate_rank`
    FROM `split_bills`
  ) AS `ranked_split_bills`
  WHERE `duplicate_rank` > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_split_bills_group_order_member_unique`
  ON `split_bills` (`group_order_id`, `member_id`);
