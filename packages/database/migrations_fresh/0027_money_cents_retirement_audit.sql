-- Pre-retirement audit for legacy REAL money columns.
--
-- 0023/0025 backfilled integer cents columns and installed sync triggers.
-- This migration records whether the legacy REAL values and the cents columns
-- are aligned before any future destructive table rebuild removes legacy money
-- columns. Percentage/rate/ratio REAL fields are intentionally excluded.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'orders', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `orders`
     WHERE (`subtotal_cents` IS NULL OR `subtotal_cents` != CAST(round(`subtotal` * 100) AS integer))
        OR (`tax_amount_cents` IS NULL OR `tax_amount_cents` != CAST(round(`tax_amount` * 100) AS integer))
        OR (`service_charge_cents` IS NULL OR `service_charge_cents` != CAST(round(`service_charge` * 100) AS integer))
        OR (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
        OR (`total_amount_cents` IS NULL OR `total_amount_cents` != CAST(round(`total_amount` * 100) AS integer))
        OR (`refund_amount` IS NULL AND `refund_amount_cents` IS NOT NULL)
        OR (`refund_amount` IS NOT NULL AND (`refund_amount_cents` IS NULL OR `refund_amount_cents` != CAST(round(`refund_amount` * 100) AS integer)))
     LIMIT 5
  )),
  'All orders money cents fields must match rounded legacy REAL values before REAL column retirement.'
FROM `orders`
WHERE (`subtotal_cents` IS NULL OR `subtotal_cents` != CAST(round(`subtotal` * 100) AS integer))
   OR (`tax_amount_cents` IS NULL OR `tax_amount_cents` != CAST(round(`tax_amount` * 100) AS integer))
   OR (`service_charge_cents` IS NULL OR `service_charge_cents` != CAST(round(`service_charge` * 100) AS integer))
   OR (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
   OR (`total_amount_cents` IS NULL OR `total_amount_cents` != CAST(round(`total_amount` * 100) AS integer))
   OR (`refund_amount` IS NULL AND `refund_amount_cents` IS NOT NULL)
   OR (`refund_amount` IS NOT NULL AND (`refund_amount_cents` IS NULL OR `refund_amount_cents` != CAST(round(`refund_amount` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'order_items', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `order_items`
     WHERE (`unit_price_cents` IS NULL OR `unit_price_cents` != CAST(round(`unit_price` * 100) AS integer))
        OR (`total_price_cents` IS NULL OR `total_price_cents` != CAST(round(`total_price` * 100) AS integer))
     LIMIT 5
  )),
  'order_items unit/total cents must match rounded legacy REAL values before REAL column retirement.'
FROM `order_items`
WHERE (`unit_price_cents` IS NULL OR `unit_price_cents` != CAST(round(`unit_price` * 100) AS integer))
   OR (`total_price_cents` IS NULL OR `total_price_cents` != CAST(round(`total_price` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'menu_items', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `menu_items`
     WHERE (`price_cents` IS NULL OR `price_cents` != CAST(round(`price` * 100) AS integer))
        OR (`original_price` IS NULL AND `original_price_cents` IS NOT NULL)
        OR (`original_price` IS NOT NULL AND (`original_price_cents` IS NULL OR `original_price_cents` != CAST(round(`original_price` * 100) AS integer)))
        OR (`cost_price` IS NULL AND `cost_price_cents` IS NOT NULL)
        OR (`cost_price` IS NOT NULL AND (`cost_price_cents` IS NULL OR `cost_price_cents` != CAST(round(`cost_price` * 100) AS integer)))
     LIMIT 5
  )),
  'menu_items price cents must match rounded legacy REAL values before REAL column retirement.'
FROM `menu_items`
WHERE (`price_cents` IS NULL OR `price_cents` != CAST(round(`price` * 100) AS integer))
   OR (`original_price` IS NULL AND `original_price_cents` IS NOT NULL)
   OR (`original_price` IS NOT NULL AND (`original_price_cents` IS NULL OR `original_price_cents` != CAST(round(`original_price` * 100) AS integer)))
   OR (`cost_price` IS NULL AND `cost_price_cents` IS NOT NULL)
   OR (`cost_price` IS NOT NULL AND (`cost_price_cents` IS NULL OR `cost_price_cents` != CAST(round(`cost_price` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'coupons', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `coupons`
     WHERE (`discount_type` != 'percentage' AND (`discount_value_cents` IS NULL OR `discount_value_cents` != CAST(round(`discount_value` * 100) AS integer)))
        OR (`max_discount_amount` IS NULL AND `max_discount_amount_cents` IS NOT NULL)
        OR (`max_discount_amount` IS NOT NULL AND (`max_discount_amount_cents` IS NULL OR `max_discount_amount_cents` != CAST(round(`max_discount_amount` * 100) AS integer)))
        OR (`min_order_amount` IS NULL AND `min_order_amount_cents` IS NOT NULL)
        OR (`min_order_amount` IS NOT NULL AND (`min_order_amount_cents` IS NULL OR `min_order_amount_cents` != CAST(round(`min_order_amount` * 100) AS integer)))
     LIMIT 5
  )),
  'Fixed coupon money cents must match rounded legacy REAL values; percentage discount_value rows are excluded.'
FROM `coupons`
WHERE (`discount_type` != 'percentage' AND (`discount_value_cents` IS NULL OR `discount_value_cents` != CAST(round(`discount_value` * 100) AS integer)))
   OR (`max_discount_amount` IS NULL AND `max_discount_amount_cents` IS NOT NULL)
   OR (`max_discount_amount` IS NOT NULL AND (`max_discount_amount_cents` IS NULL OR `max_discount_amount_cents` != CAST(round(`max_discount_amount` * 100) AS integer)))
   OR (`min_order_amount` IS NULL AND `min_order_amount_cents` IS NOT NULL)
   OR (`min_order_amount` IS NOT NULL AND (`min_order_amount_cents` IS NULL OR `min_order_amount_cents` != CAST(round(`min_order_amount` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'coupon_usage', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `coupon_usage`
     WHERE (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
        OR (`original_amount_cents` IS NULL OR `original_amount_cents` != CAST(round(`original_amount` * 100) AS integer))
        OR (`final_amount_cents` IS NULL OR `final_amount_cents` != CAST(round(`final_amount` * 100) AS integer))
     LIMIT 5
  )),
  'coupon_usage cents must match rounded legacy REAL values before REAL column retirement.'
FROM `coupon_usage`
WHERE (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
   OR (`original_amount_cents` IS NULL OR `original_amount_cents` != CAST(round(`original_amount` * 100) AS integer))
   OR (`final_amount_cents` IS NULL OR `final_amount_cents` != CAST(round(`final_amount` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'group_orders', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `group_orders`
     WHERE (`total_amount_cents` IS NULL OR `total_amount_cents` != CAST(round(`total_amount` * 100) AS integer))
        OR (`tax_amount_cents` IS NULL OR `tax_amount_cents` != CAST(round(`tax_amount` * 100) AS integer))
        OR (`service_charge_cents` IS NULL OR `service_charge_cents` != CAST(round(`service_charge` * 100) AS integer))
        OR (`final_amount_cents` IS NULL OR `final_amount_cents` != CAST(round(`final_amount` * 100) AS integer))
     LIMIT 5
  )),
  'group_orders cents must match rounded legacy REAL values before REAL column retirement.'
FROM `group_orders`
WHERE (`total_amount_cents` IS NULL OR `total_amount_cents` != CAST(round(`total_amount` * 100) AS integer))
   OR (`tax_amount_cents` IS NULL OR `tax_amount_cents` != CAST(round(`tax_amount` * 100) AS integer))
   OR (`service_charge_cents` IS NULL OR `service_charge_cents` != CAST(round(`service_charge` * 100) AS integer))
   OR (`final_amount_cents` IS NULL OR `final_amount_cents` != CAST(round(`final_amount` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'group_cart_items', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `group_cart_items`
     WHERE (`unit_price_cents` IS NULL OR `unit_price_cents` != CAST(round(`unit_price` * 100) AS integer))
        OR (`total_price_cents` IS NULL OR `total_price_cents` != CAST(round(`total_price` * 100) AS integer))
     LIMIT 5
  )),
  'group_cart_items cents must match rounded legacy REAL values before REAL column retirement.'
FROM `group_cart_items`
WHERE (`unit_price_cents` IS NULL OR `unit_price_cents` != CAST(round(`unit_price` * 100) AS integer))
   OR (`total_price_cents` IS NULL OR `total_price_cents` != CAST(round(`total_price` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'split_bills', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `split_bills`
     WHERE (`subtotal_cents` IS NULL OR `subtotal_cents` != CAST(round(`subtotal` * 100) AS integer))
        OR (`tax_amount_cents` IS NULL OR `tax_amount_cents` != CAST(round(`tax_amount` * 100) AS integer))
        OR (`service_charge_cents` IS NULL OR `service_charge_cents` != CAST(round(`service_charge` * 100) AS integer))
        OR (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
        OR (`tip_amount_cents` IS NULL OR `tip_amount_cents` != CAST(round(`tip_amount` * 100) AS integer))
        OR (`total_amount_cents` IS NULL OR `total_amount_cents` != CAST(round(`total_amount` * 100) AS integer))
     LIMIT 5
  )),
  'split_bills cents must match rounded legacy REAL values before REAL column retirement.'
FROM `split_bills`
WHERE (`subtotal_cents` IS NULL OR `subtotal_cents` != CAST(round(`subtotal` * 100) AS integer))
   OR (`tax_amount_cents` IS NULL OR `tax_amount_cents` != CAST(round(`tax_amount` * 100) AS integer))
   OR (`service_charge_cents` IS NULL OR `service_charge_cents` != CAST(round(`service_charge` * 100) AS integer))
   OR (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
   OR (`tip_amount_cents` IS NULL OR `tip_amount_cents` != CAST(round(`tip_amount` * 100) AS integer))
   OR (`total_amount_cents` IS NULL OR `total_amount_cents` != CAST(round(`total_amount` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'cash_shifts', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `cash_shifts`
     WHERE (`start_amount_cents` IS NULL OR `start_amount_cents` != CAST(round(`start_amount` * 100) AS integer))
        OR (`end_amount` IS NULL AND `end_amount_cents` IS NOT NULL)
        OR (`end_amount` IS NOT NULL AND (`end_amount_cents` IS NULL OR `end_amount_cents` != CAST(round(`end_amount` * 100) AS integer)))
        OR (`expected_amount_cents` IS NULL OR `expected_amount_cents` != CAST(round(`expected_amount` * 100) AS integer))
        OR (`actual_amount` IS NULL AND `actual_amount_cents` IS NOT NULL)
        OR (`actual_amount` IS NOT NULL AND (`actual_amount_cents` IS NULL OR `actual_amount_cents` != CAST(round(`actual_amount` * 100) AS integer)))
        OR (`difference_amount_cents` IS NULL OR `difference_amount_cents` != CAST(round(`difference_amount` * 100) AS integer))
        OR (`total_sales_cents` IS NULL OR `total_sales_cents` != CAST(round(`total_sales` * 100) AS integer))
        OR (`total_refunds_cents` IS NULL OR `total_refunds_cents` != CAST(round(`total_refunds` * 100) AS integer))
        OR (`cash_sales_cents` IS NULL OR `cash_sales_cents` != CAST(round(`cash_sales` * 100) AS integer))
        OR (`card_sales_cents` IS NULL OR `card_sales_cents` != CAST(round(`card_sales` * 100) AS integer))
        OR (`digital_sales_cents` IS NULL OR `digital_sales_cents` != CAST(round(`digital_sales` * 100) AS integer))
     LIMIT 5
  )),
  'cash_shifts cents must match rounded legacy REAL values before REAL column retirement.'
FROM `cash_shifts`
WHERE (`start_amount_cents` IS NULL OR `start_amount_cents` != CAST(round(`start_amount` * 100) AS integer))
   OR (`end_amount` IS NULL AND `end_amount_cents` IS NOT NULL)
   OR (`end_amount` IS NOT NULL AND (`end_amount_cents` IS NULL OR `end_amount_cents` != CAST(round(`end_amount` * 100) AS integer)))
   OR (`expected_amount_cents` IS NULL OR `expected_amount_cents` != CAST(round(`expected_amount` * 100) AS integer))
   OR (`actual_amount` IS NULL AND `actual_amount_cents` IS NOT NULL)
   OR (`actual_amount` IS NOT NULL AND (`actual_amount_cents` IS NULL OR `actual_amount_cents` != CAST(round(`actual_amount` * 100) AS integer)))
   OR (`difference_amount_cents` IS NULL OR `difference_amount_cents` != CAST(round(`difference_amount` * 100) AS integer))
   OR (`total_sales_cents` IS NULL OR `total_sales_cents` != CAST(round(`total_sales` * 100) AS integer))
   OR (`total_refunds_cents` IS NULL OR `total_refunds_cents` != CAST(round(`total_refunds` * 100) AS integer))
   OR (`cash_sales_cents` IS NULL OR `cash_sales_cents` != CAST(round(`cash_sales` * 100) AS integer))
   OR (`card_sales_cents` IS NULL OR `card_sales_cents` != CAST(round(`card_sales` * 100) AS integer))
   OR (`digital_sales_cents` IS NULL OR `digital_sales_cents` != CAST(round(`digital_sales` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'cash_movements', 'amount', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `cash_movements`
     WHERE `amount_cents` IS NULL OR `amount_cents` != CAST(round(`amount` * 100) AS integer)
     LIMIT 5
  )),
  'cash_movements.amount_cents must match rounded legacy amount before REAL column retirement.'
FROM `cash_movements`
WHERE `amount_cents` IS NULL OR `amount_cents` != CAST(round(`amount` * 100) AS integer);
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'refunds', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `refunds`
     WHERE (`original_amount_cents` IS NULL OR `original_amount_cents` != CAST(round(`original_amount` * 100) AS integer))
        OR (`refund_amount_cents` IS NULL OR `refund_amount_cents` != CAST(round(`refund_amount` * 100) AS integer))
     LIMIT 5
  )),
  'refunds cents must match rounded legacy REAL values before REAL column retirement.'
FROM `refunds`
WHERE (`original_amount_cents` IS NULL OR `original_amount_cents` != CAST(round(`original_amount` * 100) AS integer))
   OR (`refund_amount_cents` IS NULL OR `refund_amount_cents` != CAST(round(`refund_amount` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'dish_search_index', 'price', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `dish_search_index`
     WHERE (`price` IS NULL AND `price_cents` IS NOT NULL)
        OR (`price` IS NOT NULL AND (`price_cents` IS NULL OR `price_cents` != CAST(round(`price` * 100) AS integer)))
     LIMIT 5
  )),
  'dish_search_index.price_cents must match rounded legacy price before REAL column retirement.'
FROM `dish_search_index`
WHERE (`price` IS NULL AND `price_cents` IS NOT NULL)
   OR (`price` IS NOT NULL AND (`price_cents` IS NULL OR `price_cents` != CAST(round(`price` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'ingredient_definitions', 'cost_per_unit', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `ingredient_definitions`
     WHERE (`cost_per_unit` IS NULL AND `cost_per_unit_cents` IS NOT NULL)
        OR (`cost_per_unit` IS NOT NULL AND (`cost_per_unit_cents` IS NULL OR `cost_per_unit_cents` != CAST(round(`cost_per_unit` * 100) AS integer)))
     LIMIT 5
  )),
  'ingredient_definitions.cost_per_unit_cents must match rounded legacy cost before REAL column retirement.'
FROM `ingredient_definitions`
WHERE (`cost_per_unit` IS NULL AND `cost_per_unit_cents` IS NOT NULL)
   OR (`cost_per_unit` IS NOT NULL AND (`cost_per_unit_cents` IS NULL OR `cost_per_unit_cents` != CAST(round(`cost_per_unit` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'shift_templates', 'hourly_rate', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `shift_templates`
     WHERE (`hourly_rate` IS NULL AND `hourly_rate_cents` IS NOT NULL)
        OR (`hourly_rate` IS NOT NULL AND (`hourly_rate_cents` IS NULL OR `hourly_rate_cents` != CAST(round(`hourly_rate` * 100) AS integer)))
     LIMIT 5
  )),
  'shift_templates.hourly_rate_cents must match rounded legacy hourly_rate before REAL column retirement.'
FROM `shift_templates`
WHERE (`hourly_rate` IS NULL AND `hourly_rate_cents` IS NOT NULL)
   OR (`hourly_rate` IS NOT NULL AND (`hourly_rate_cents` IS NULL OR `hourly_rate_cents` != CAST(round(`hourly_rate` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'partnerships', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `partnerships`
     WHERE (`default_discount_type` != 'percentage' AND `default_discount_value` IS NOT NULL AND (`default_discount_value_cents` IS NULL OR `default_discount_value_cents` != CAST(round(`default_discount_value` * 100) AS integer)))
        OR (`default_discount_value` IS NULL AND `default_discount_value_cents` IS NOT NULL)
        OR (`total_discount_given` IS NULL AND `total_discount_given_cents` IS NOT NULL)
        OR (`total_discount_given` IS NOT NULL AND (`total_discount_given_cents` IS NULL OR `total_discount_given_cents` != CAST(round(`total_discount_given` * 100) AS integer)))
        OR (`total_revenue` IS NULL AND `total_revenue_cents` IS NOT NULL)
        OR (`total_revenue` IS NOT NULL AND (`total_revenue_cents` IS NULL OR `total_revenue_cents` != CAST(round(`total_revenue` * 100) AS integer)))
     LIMIT 5
  )),
  'partnerships fixed money cents must match rounded legacy REAL values; percentage default discounts are excluded.'
FROM `partnerships`
WHERE (`default_discount_type` != 'percentage' AND `default_discount_value` IS NOT NULL AND (`default_discount_value_cents` IS NULL OR `default_discount_value_cents` != CAST(round(`default_discount_value` * 100) AS integer)))
   OR (`default_discount_value` IS NULL AND `default_discount_value_cents` IS NOT NULL)
   OR (`total_discount_given` IS NULL AND `total_discount_given_cents` IS NOT NULL)
   OR (`total_discount_given` IS NOT NULL AND (`total_discount_given_cents` IS NULL OR `total_discount_given_cents` != CAST(round(`total_discount_given` * 100) AS integer)))
   OR (`total_revenue` IS NULL AND `total_revenue_cents` IS NOT NULL)
   OR (`total_revenue` IS NOT NULL AND (`total_revenue_cents` IS NULL OR `total_revenue_cents` != CAST(round(`total_revenue` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'partnership_plans', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `partnership_plans`
     WHERE (`discount_type` != 'percentage' AND (`discount_value_cents` IS NULL OR `discount_value_cents` != CAST(round(`discount_value` * 100) AS integer)))
        OR (`max_discount_amount` IS NULL AND `max_discount_amount_cents` IS NOT NULL)
        OR (`max_discount_amount` IS NOT NULL AND (`max_discount_amount_cents` IS NULL OR `max_discount_amount_cents` != CAST(round(`max_discount_amount` * 100) AS integer)))
        OR (`min_order_amount` IS NULL AND `min_order_amount_cents` IS NOT NULL)
        OR (`min_order_amount` IS NOT NULL AND (`min_order_amount_cents` IS NULL OR `min_order_amount_cents` != CAST(round(`min_order_amount` * 100) AS integer)))
        OR (`max_order_amount` IS NULL AND `max_order_amount_cents` IS NOT NULL)
        OR (`max_order_amount` IS NOT NULL AND (`max_order_amount_cents` IS NULL OR `max_order_amount_cents` != CAST(round(`max_order_amount` * 100) AS integer)))
        OR (`total_discount_given` IS NULL AND `total_discount_given_cents` IS NOT NULL)
        OR (`total_discount_given` IS NOT NULL AND (`total_discount_given_cents` IS NULL OR `total_discount_given_cents` != CAST(round(`total_discount_given` * 100) AS integer)))
        OR (`total_revenue` IS NULL AND `total_revenue_cents` IS NOT NULL)
        OR (`total_revenue` IS NOT NULL AND (`total_revenue_cents` IS NULL OR `total_revenue_cents` != CAST(round(`total_revenue` * 100) AS integer)))
     LIMIT 5
  )),
  'partnership_plans fixed money cents must match rounded legacy REAL values; percentage discount_value rows are excluded.'
FROM `partnership_plans`
WHERE (`discount_type` != 'percentage' AND (`discount_value_cents` IS NULL OR `discount_value_cents` != CAST(round(`discount_value` * 100) AS integer)))
   OR (`max_discount_amount` IS NULL AND `max_discount_amount_cents` IS NOT NULL)
   OR (`max_discount_amount` IS NOT NULL AND (`max_discount_amount_cents` IS NULL OR `max_discount_amount_cents` != CAST(round(`max_discount_amount` * 100) AS integer)))
   OR (`min_order_amount` IS NULL AND `min_order_amount_cents` IS NOT NULL)
   OR (`min_order_amount` IS NOT NULL AND (`min_order_amount_cents` IS NULL OR `min_order_amount_cents` != CAST(round(`min_order_amount` * 100) AS integer)))
   OR (`max_order_amount` IS NULL AND `max_order_amount_cents` IS NOT NULL)
   OR (`max_order_amount` IS NOT NULL AND (`max_order_amount_cents` IS NULL OR `max_order_amount_cents` != CAST(round(`max_order_amount` * 100) AS integer)))
   OR (`total_discount_given` IS NULL AND `total_discount_given_cents` IS NOT NULL)
   OR (`total_discount_given` IS NOT NULL AND (`total_discount_given_cents` IS NULL OR `total_discount_given_cents` != CAST(round(`total_discount_given` * 100) AS integer)))
   OR (`total_revenue` IS NULL AND `total_revenue_cents` IS NOT NULL)
   OR (`total_revenue` IS NOT NULL AND (`total_revenue_cents` IS NULL OR `total_revenue_cents` != CAST(round(`total_revenue` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'partnership_usage_logs', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `partnership_usage_logs`
     WHERE (`discount_type` != 'percentage' AND (`discount_value_cents` IS NULL OR `discount_value_cents` != CAST(round(`discount_value` * 100) AS integer)))
        OR (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
        OR (`original_amount_cents` IS NULL OR `original_amount_cents` != CAST(round(`original_amount` * 100) AS integer))
        OR (`final_amount_cents` IS NULL OR `final_amount_cents` != CAST(round(`final_amount` * 100) AS integer))
     LIMIT 5
  )),
  'partnership_usage_logs fixed money cents must match rounded legacy REAL values; percentage discount_value rows are excluded.'
FROM `partnership_usage_logs`
WHERE (`discount_type` != 'percentage' AND (`discount_value_cents` IS NULL OR `discount_value_cents` != CAST(round(`discount_value` * 100) AS integer)))
   OR (`discount_amount_cents` IS NULL OR `discount_amount_cents` != CAST(round(`discount_amount` * 100) AS integer))
   OR (`original_amount_cents` IS NULL OR `original_amount_cents` != CAST(round(`original_amount` * 100) AS integer))
   OR (`final_amount_cents` IS NULL OR `final_amount_cents` != CAST(round(`final_amount` * 100) AS integer));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement', 'verified_members', 'amounts', 'real_cents_mismatch', 'error',
  count(*),
  (SELECT group_concat(`id`, ',') FROM (
    SELECT `id`
      FROM `verified_members`
     WHERE (`total_discount_received` IS NULL AND `total_discount_received_cents` IS NOT NULL)
        OR (`total_discount_received` IS NOT NULL AND (`total_discount_received_cents` IS NULL OR `total_discount_received_cents` != CAST(round(`total_discount_received` * 100) AS integer)))
        OR (`total_spending` IS NULL AND `total_spending_cents` IS NOT NULL)
        OR (`total_spending` IS NOT NULL AND (`total_spending_cents` IS NULL OR `total_spending_cents` != CAST(round(`total_spending` * 100) AS integer)))
     LIMIT 5
  )),
  'verified_members cents must match rounded legacy REAL values before REAL column retirement.'
FROM `verified_members`
WHERE (`total_discount_received` IS NULL AND `total_discount_received_cents` IS NOT NULL)
   OR (`total_discount_received` IS NOT NULL AND (`total_discount_received_cents` IS NULL OR `total_discount_received_cents` != CAST(round(`total_discount_received` * 100) AS integer)))
   OR (`total_spending` IS NULL AND `total_spending_cents` IS NOT NULL)
   OR (`total_spending` IS NOT NULL AND (`total_spending_cents` IS NULL OR `total_spending_cents` != CAST(round(`total_spending` * 100) AS integer)));
--> statement-breakpoint

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'money_cents_retirement',
  '_all_money_tables',
  'legacy_real_amounts',
  'real_scale_over_two_decimals',
  'error',
  (SELECT count(*) FROM `orders`
    WHERE (`subtotal` IS NOT NULL AND abs((`subtotal` * 100.0) - round(`subtotal` * 100.0)) > 0.000001)
       OR (`tax_amount` IS NOT NULL AND abs((`tax_amount` * 100.0) - round(`tax_amount` * 100.0)) > 0.000001)
       OR (`service_charge` IS NOT NULL AND abs((`service_charge` * 100.0) - round(`service_charge` * 100.0)) > 0.000001)
       OR (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001)
       OR (`total_amount` IS NOT NULL AND abs((`total_amount` * 100.0) - round(`total_amount` * 100.0)) > 0.000001)
       OR (`refund_amount` IS NOT NULL AND abs((`refund_amount` * 100.0) - round(`refund_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `order_items`
    WHERE (`unit_price` IS NOT NULL AND abs((`unit_price` * 100.0) - round(`unit_price` * 100.0)) > 0.000001)
       OR (`total_price` IS NOT NULL AND abs((`total_price` * 100.0) - round(`total_price` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `menu_items`
    WHERE (`price` IS NOT NULL AND abs((`price` * 100.0) - round(`price` * 100.0)) > 0.000001)
       OR (`original_price` IS NOT NULL AND abs((`original_price` * 100.0) - round(`original_price` * 100.0)) > 0.000001)
       OR (`cost_price` IS NOT NULL AND abs((`cost_price` * 100.0) - round(`cost_price` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `coupons`
    WHERE (`discount_type` != 'percentage' AND `discount_value` IS NOT NULL AND abs((`discount_value` * 100.0) - round(`discount_value` * 100.0)) > 0.000001)
       OR (`max_discount_amount` IS NOT NULL AND abs((`max_discount_amount` * 100.0) - round(`max_discount_amount` * 100.0)) > 0.000001)
       OR (`min_order_amount` IS NOT NULL AND abs((`min_order_amount` * 100.0) - round(`min_order_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `coupon_usage`
    WHERE (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001)
       OR (`original_amount` IS NOT NULL AND abs((`original_amount` * 100.0) - round(`original_amount` * 100.0)) > 0.000001)
       OR (`final_amount` IS NOT NULL AND abs((`final_amount` * 100.0) - round(`final_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `group_orders`
    WHERE (`total_amount` IS NOT NULL AND abs((`total_amount` * 100.0) - round(`total_amount` * 100.0)) > 0.000001)
       OR (`tax_amount` IS NOT NULL AND abs((`tax_amount` * 100.0) - round(`tax_amount` * 100.0)) > 0.000001)
       OR (`service_charge` IS NOT NULL AND abs((`service_charge` * 100.0) - round(`service_charge` * 100.0)) > 0.000001)
       OR (`final_amount` IS NOT NULL AND abs((`final_amount` * 100.0) - round(`final_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `group_cart_items`
    WHERE (`unit_price` IS NOT NULL AND abs((`unit_price` * 100.0) - round(`unit_price` * 100.0)) > 0.000001)
       OR (`total_price` IS NOT NULL AND abs((`total_price` * 100.0) - round(`total_price` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `split_bills`
    WHERE (`subtotal` IS NOT NULL AND abs((`subtotal` * 100.0) - round(`subtotal` * 100.0)) > 0.000001)
       OR (`tax_amount` IS NOT NULL AND abs((`tax_amount` * 100.0) - round(`tax_amount` * 100.0)) > 0.000001)
       OR (`service_charge` IS NOT NULL AND abs((`service_charge` * 100.0) - round(`service_charge` * 100.0)) > 0.000001)
       OR (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001)
       OR (`tip_amount` IS NOT NULL AND abs((`tip_amount` * 100.0) - round(`tip_amount` * 100.0)) > 0.000001)
       OR (`total_amount` IS NOT NULL AND abs((`total_amount` * 100.0) - round(`total_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `cash_shifts`
    WHERE (`start_amount` IS NOT NULL AND abs((`start_amount` * 100.0) - round(`start_amount` * 100.0)) > 0.000001)
       OR (`end_amount` IS NOT NULL AND abs((`end_amount` * 100.0) - round(`end_amount` * 100.0)) > 0.000001)
       OR (`expected_amount` IS NOT NULL AND abs((`expected_amount` * 100.0) - round(`expected_amount` * 100.0)) > 0.000001)
       OR (`actual_amount` IS NOT NULL AND abs((`actual_amount` * 100.0) - round(`actual_amount` * 100.0)) > 0.000001)
       OR (`difference_amount` IS NOT NULL AND abs((`difference_amount` * 100.0) - round(`difference_amount` * 100.0)) > 0.000001)
       OR (`total_sales` IS NOT NULL AND abs((`total_sales` * 100.0) - round(`total_sales` * 100.0)) > 0.000001)
       OR (`total_refunds` IS NOT NULL AND abs((`total_refunds` * 100.0) - round(`total_refunds` * 100.0)) > 0.000001)
       OR (`cash_sales` IS NOT NULL AND abs((`cash_sales` * 100.0) - round(`cash_sales` * 100.0)) > 0.000001)
       OR (`card_sales` IS NOT NULL AND abs((`card_sales` * 100.0) - round(`card_sales` * 100.0)) > 0.000001)
       OR (`digital_sales` IS NOT NULL AND abs((`digital_sales` * 100.0) - round(`digital_sales` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `cash_movements`
    WHERE `amount` IS NOT NULL AND abs((`amount` * 100.0) - round(`amount` * 100.0)) > 0.000001)
  + (SELECT count(*) FROM `refunds`
    WHERE (`original_amount` IS NOT NULL AND abs((`original_amount` * 100.0) - round(`original_amount` * 100.0)) > 0.000001)
       OR (`refund_amount` IS NOT NULL AND abs((`refund_amount` * 100.0) - round(`refund_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `dish_search_index`
    WHERE `price` IS NOT NULL AND abs((`price` * 100.0) - round(`price` * 100.0)) > 0.000001)
  + (SELECT count(*) FROM `ingredient_definitions`
    WHERE `cost_per_unit` IS NOT NULL AND abs((`cost_per_unit` * 100.0) - round(`cost_per_unit` * 100.0)) > 0.000001)
  + (SELECT count(*) FROM `shift_templates`
    WHERE `hourly_rate` IS NOT NULL AND abs((`hourly_rate` * 100.0) - round(`hourly_rate` * 100.0)) > 0.000001)
  + (SELECT count(*) FROM `partnerships`
    WHERE (`default_discount_type` != 'percentage' AND `default_discount_value` IS NOT NULL AND abs((`default_discount_value` * 100.0) - round(`default_discount_value` * 100.0)) > 0.000001)
       OR (`total_discount_given` IS NOT NULL AND abs((`total_discount_given` * 100.0) - round(`total_discount_given` * 100.0)) > 0.000001)
       OR (`total_revenue` IS NOT NULL AND abs((`total_revenue` * 100.0) - round(`total_revenue` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `partnership_plans`
    WHERE (`discount_type` != 'percentage' AND `discount_value` IS NOT NULL AND abs((`discount_value` * 100.0) - round(`discount_value` * 100.0)) > 0.000001)
       OR (`max_discount_amount` IS NOT NULL AND abs((`max_discount_amount` * 100.0) - round(`max_discount_amount` * 100.0)) > 0.000001)
       OR (`min_order_amount` IS NOT NULL AND abs((`min_order_amount` * 100.0) - round(`min_order_amount` * 100.0)) > 0.000001)
       OR (`max_order_amount` IS NOT NULL AND abs((`max_order_amount` * 100.0) - round(`max_order_amount` * 100.0)) > 0.000001)
       OR (`total_discount_given` IS NOT NULL AND abs((`total_discount_given` * 100.0) - round(`total_discount_given` * 100.0)) > 0.000001)
       OR (`total_revenue` IS NOT NULL AND abs((`total_revenue` * 100.0) - round(`total_revenue` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `partnership_usage_logs`
    WHERE (`discount_type` != 'percentage' AND `discount_value` IS NOT NULL AND abs((`discount_value` * 100.0) - round(`discount_value` * 100.0)) > 0.000001)
       OR (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001)
       OR (`original_amount` IS NOT NULL AND abs((`original_amount` * 100.0) - round(`original_amount` * 100.0)) > 0.000001)
       OR (`final_amount` IS NOT NULL AND abs((`final_amount` * 100.0) - round(`final_amount` * 100.0)) > 0.000001))
  + (SELECT count(*) FROM `verified_members`
    WHERE (`total_discount_received` IS NOT NULL AND abs((`total_discount_received` * 100.0) - round(`total_discount_received` * 100.0)) > 0.000001)
       OR (`total_spending` IS NOT NULL AND abs((`total_spending` * 100.0) - round(`total_spending` * 100.0)) > 0.000001)),
  COALESCE(
    (SELECT 'orders:' || `id` FROM `orders` WHERE (`subtotal` IS NOT NULL AND abs((`subtotal` * 100.0) - round(`subtotal` * 100.0)) > 0.000001) OR (`tax_amount` IS NOT NULL AND abs((`tax_amount` * 100.0) - round(`tax_amount` * 100.0)) > 0.000001) OR (`service_charge` IS NOT NULL AND abs((`service_charge` * 100.0) - round(`service_charge` * 100.0)) > 0.000001) OR (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001) OR (`total_amount` IS NOT NULL AND abs((`total_amount` * 100.0) - round(`total_amount` * 100.0)) > 0.000001) OR (`refund_amount` IS NOT NULL AND abs((`refund_amount` * 100.0) - round(`refund_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'order_items:' || `id` FROM `order_items` WHERE (`unit_price` IS NOT NULL AND abs((`unit_price` * 100.0) - round(`unit_price` * 100.0)) > 0.000001) OR (`total_price` IS NOT NULL AND abs((`total_price` * 100.0) - round(`total_price` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'menu_items:' || `id` FROM `menu_items` WHERE (`price` IS NOT NULL AND abs((`price` * 100.0) - round(`price` * 100.0)) > 0.000001) OR (`original_price` IS NOT NULL AND abs((`original_price` * 100.0) - round(`original_price` * 100.0)) > 0.000001) OR (`cost_price` IS NOT NULL AND abs((`cost_price` * 100.0) - round(`cost_price` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'coupons:' || `id` FROM `coupons` WHERE (`discount_type` != 'percentage' AND `discount_value` IS NOT NULL AND abs((`discount_value` * 100.0) - round(`discount_value` * 100.0)) > 0.000001) OR (`max_discount_amount` IS NOT NULL AND abs((`max_discount_amount` * 100.0) - round(`max_discount_amount` * 100.0)) > 0.000001) OR (`min_order_amount` IS NOT NULL AND abs((`min_order_amount` * 100.0) - round(`min_order_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'coupon_usage:' || `id` FROM `coupon_usage` WHERE (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001) OR (`original_amount` IS NOT NULL AND abs((`original_amount` * 100.0) - round(`original_amount` * 100.0)) > 0.000001) OR (`final_amount` IS NOT NULL AND abs((`final_amount` * 100.0) - round(`final_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'group_orders:' || `id` FROM `group_orders` WHERE (`total_amount` IS NOT NULL AND abs((`total_amount` * 100.0) - round(`total_amount` * 100.0)) > 0.000001) OR (`tax_amount` IS NOT NULL AND abs((`tax_amount` * 100.0) - round(`tax_amount` * 100.0)) > 0.000001) OR (`service_charge` IS NOT NULL AND abs((`service_charge` * 100.0) - round(`service_charge` * 100.0)) > 0.000001) OR (`final_amount` IS NOT NULL AND abs((`final_amount` * 100.0) - round(`final_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'group_cart_items:' || `id` FROM `group_cart_items` WHERE (`unit_price` IS NOT NULL AND abs((`unit_price` * 100.0) - round(`unit_price` * 100.0)) > 0.000001) OR (`total_price` IS NOT NULL AND abs((`total_price` * 100.0) - round(`total_price` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'split_bills:' || `id` FROM `split_bills` WHERE (`subtotal` IS NOT NULL AND abs((`subtotal` * 100.0) - round(`subtotal` * 100.0)) > 0.000001) OR (`tax_amount` IS NOT NULL AND abs((`tax_amount` * 100.0) - round(`tax_amount` * 100.0)) > 0.000001) OR (`service_charge` IS NOT NULL AND abs((`service_charge` * 100.0) - round(`service_charge` * 100.0)) > 0.000001) OR (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001) OR (`tip_amount` IS NOT NULL AND abs((`tip_amount` * 100.0) - round(`tip_amount` * 100.0)) > 0.000001) OR (`total_amount` IS NOT NULL AND abs((`total_amount` * 100.0) - round(`total_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'cash_shifts:' || `id` FROM `cash_shifts` WHERE (`start_amount` IS NOT NULL AND abs((`start_amount` * 100.0) - round(`start_amount` * 100.0)) > 0.000001) OR (`end_amount` IS NOT NULL AND abs((`end_amount` * 100.0) - round(`end_amount` * 100.0)) > 0.000001) OR (`expected_amount` IS NOT NULL AND abs((`expected_amount` * 100.0) - round(`expected_amount` * 100.0)) > 0.000001) OR (`actual_amount` IS NOT NULL AND abs((`actual_amount` * 100.0) - round(`actual_amount` * 100.0)) > 0.000001) OR (`difference_amount` IS NOT NULL AND abs((`difference_amount` * 100.0) - round(`difference_amount` * 100.0)) > 0.000001) OR (`total_sales` IS NOT NULL AND abs((`total_sales` * 100.0) - round(`total_sales` * 100.0)) > 0.000001) OR (`total_refunds` IS NOT NULL AND abs((`total_refunds` * 100.0) - round(`total_refunds` * 100.0)) > 0.000001) OR (`cash_sales` IS NOT NULL AND abs((`cash_sales` * 100.0) - round(`cash_sales` * 100.0)) > 0.000001) OR (`card_sales` IS NOT NULL AND abs((`card_sales` * 100.0) - round(`card_sales` * 100.0)) > 0.000001) OR (`digital_sales` IS NOT NULL AND abs((`digital_sales` * 100.0) - round(`digital_sales` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'cash_movements:' || `id` FROM `cash_movements` WHERE `amount` IS NOT NULL AND abs((`amount` * 100.0) - round(`amount` * 100.0)) > 0.000001 LIMIT 1),
    (SELECT 'refunds:' || `id` FROM `refunds` WHERE (`original_amount` IS NOT NULL AND abs((`original_amount` * 100.0) - round(`original_amount` * 100.0)) > 0.000001) OR (`refund_amount` IS NOT NULL AND abs((`refund_amount` * 100.0) - round(`refund_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'dish_search_index:' || `id` FROM `dish_search_index` WHERE `price` IS NOT NULL AND abs((`price` * 100.0) - round(`price` * 100.0)) > 0.000001 LIMIT 1),
    (SELECT 'ingredient_definitions:' || `id` FROM `ingredient_definitions` WHERE `cost_per_unit` IS NOT NULL AND abs((`cost_per_unit` * 100.0) - round(`cost_per_unit` * 100.0)) > 0.000001 LIMIT 1),
    (SELECT 'shift_templates:' || `id` FROM `shift_templates` WHERE `hourly_rate` IS NOT NULL AND abs((`hourly_rate` * 100.0) - round(`hourly_rate` * 100.0)) > 0.000001 LIMIT 1),
    (SELECT 'partnerships:' || `id` FROM `partnerships` WHERE (`default_discount_type` != 'percentage' AND `default_discount_value` IS NOT NULL AND abs((`default_discount_value` * 100.0) - round(`default_discount_value` * 100.0)) > 0.000001) OR (`total_discount_given` IS NOT NULL AND abs((`total_discount_given` * 100.0) - round(`total_discount_given` * 100.0)) > 0.000001) OR (`total_revenue` IS NOT NULL AND abs((`total_revenue` * 100.0) - round(`total_revenue` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'partnership_plans:' || `id` FROM `partnership_plans` WHERE (`discount_type` != 'percentage' AND `discount_value` IS NOT NULL AND abs((`discount_value` * 100.0) - round(`discount_value` * 100.0)) > 0.000001) OR (`max_discount_amount` IS NOT NULL AND abs((`max_discount_amount` * 100.0) - round(`max_discount_amount` * 100.0)) > 0.000001) OR (`min_order_amount` IS NOT NULL AND abs((`min_order_amount` * 100.0) - round(`min_order_amount` * 100.0)) > 0.000001) OR (`max_order_amount` IS NOT NULL AND abs((`max_order_amount` * 100.0) - round(`max_order_amount` * 100.0)) > 0.000001) OR (`total_discount_given` IS NOT NULL AND abs((`total_discount_given` * 100.0) - round(`total_discount_given` * 100.0)) > 0.000001) OR (`total_revenue` IS NOT NULL AND abs((`total_revenue` * 100.0) - round(`total_revenue` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'partnership_usage_logs:' || `id` FROM `partnership_usage_logs` WHERE (`discount_type` != 'percentage' AND `discount_value` IS NOT NULL AND abs((`discount_value` * 100.0) - round(`discount_value` * 100.0)) > 0.000001) OR (`discount_amount` IS NOT NULL AND abs((`discount_amount` * 100.0) - round(`discount_amount` * 100.0)) > 0.000001) OR (`original_amount` IS NOT NULL AND abs((`original_amount` * 100.0) - round(`original_amount` * 100.0)) > 0.000001) OR (`final_amount` IS NOT NULL AND abs((`final_amount` * 100.0) - round(`final_amount` * 100.0)) > 0.000001) LIMIT 1),
    (SELECT 'verified_members:' || `id` FROM `verified_members` WHERE (`total_discount_received` IS NOT NULL AND abs((`total_discount_received` * 100.0) - round(`total_discount_received` * 100.0)) > 0.000001) OR (`total_spending` IS NOT NULL AND abs((`total_spending` * 100.0) - round(`total_spending` * 100.0)) > 0.000001) LIMIT 1)
  ),
  'Legacy REAL money values must not carry more than two decimal places before cents-only retirement.';
