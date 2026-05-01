-- 0037 restaurant FK rebuild for users root component.
-- Rebuilds users with a physical nullable restaurant_id FK.
-- All tables that depend on users directly or indirectly are rebuilt because D1 keeps foreign_keys enabled.

INSERT OR REPLACE INTO `data_integrity_audit`
  (`scope`, `table_name`, `column_name`, `check_name`, `severity`, `violation_count`, `sample_values`, `details`)
SELECT
  'restaurant_fk', 'users', 'restaurant_id', 'orphan_restaurant_id', 'error',
  count(*),
  (SELECT group_concat(`restaurant_id`, ',') FROM (
    SELECT DISTINCT `restaurant_id`
      FROM `users`
     WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`)
     LIMIT 5
  )),
  'users.restaurant_id must reference restaurants.id when present before component rebuild.'
FROM `users`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_users_root_component_fk_0037`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_users_root_component_fk_0037` (
  `check_name` text PRIMARY KEY NOT NULL,
  `violation_count` integer NOT NULL CHECK (`violation_count` = 0)
);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'audit_logs.restaurant_id.orphan_restaurant_id', count(*)
FROM `audit_logs`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `audit_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'audit_logs.user_id.orphan_user_id', count(*)
FROM `audit_logs`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `audit_logs`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'audit_logs.on_behalf_of_user_id.orphan_on_behalf_of_user_id', count(*)
FROM `audit_logs`
WHERE `on_behalf_of_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `audit_logs`.`on_behalf_of_user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'cash_movements.approved_by.orphan_approved_by', count(*)
FROM `cash_movements`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `cash_movements`.`approved_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'cash_movements.recorded_by.orphan_recorded_by', count(*)
FROM `cash_movements`
WHERE `recorded_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `cash_movements`.`recorded_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'cash_movements.register_id.orphan_register_id', count(*)
FROM `cash_movements`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `cash_movements`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'cash_movements.shift_id.orphan_shift_id', count(*)
FROM `cash_movements`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `cash_movements`.`shift_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'cash_shifts.operator_id.orphan_operator_id', count(*)
FROM `cash_shifts`
WHERE `operator_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `cash_shifts`.`operator_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'cash_shifts.register_id.orphan_register_id', count(*)
FROM `cash_shifts`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `cash_shifts`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_distributions.created_by.orphan_created_by', count(*)
FROM `coupon_distributions`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_distributions`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_distributions.coupon_id.orphan_coupon_id', count(*)
FROM `coupon_distributions`
WHERE `coupon_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_distributions`.`coupon_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_templates.restaurant_id.orphan_restaurant_id', count(*)
FROM `coupon_templates`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupon_templates`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_templates.created_by.orphan_created_by', count(*)
FROM `coupon_templates`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_templates`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_usage.user_id.orphan_user_id', count(*)
FROM `coupon_usage`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupon_usage`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_usage.order_id.orphan_order_id', count(*)
FROM `coupon_usage`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `coupon_usage`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupon_usage.coupon_id.orphan_coupon_id', count(*)
FROM `coupon_usage`
WHERE `coupon_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `coupons` WHERE `coupons`.`id` = `coupon_usage`.`coupon_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupons.restaurant_id.orphan_restaurant_id', count(*)
FROM `coupons`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `coupons`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'coupons.created_by.orphan_created_by', count(*)
FROM `coupons`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `coupons`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'email_verification_tokens.user_id.orphan_user_id', count(*)
FROM `email_verification_tokens`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `email_verification_tokens`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_availability.restaurant_id.orphan_restaurant_id', count(*)
FROM `employee_availability`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_availability`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_availability.employee_id.orphan_employee_id', count(*)
FROM `employee_availability`
WHERE `employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_availability`.`employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_leave_balances.restaurant_id.orphan_restaurant_id', count(*)
FROM `employee_leave_balances`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_leave_balances`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_leave_balances.last_updated_by.orphan_last_updated_by', count(*)
FROM `employee_leave_balances`
WHERE `last_updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_leave_balances`.`last_updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_leave_balances.adjusted_by.orphan_adjusted_by', count(*)
FROM `employee_leave_balances`
WHERE `adjusted_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_leave_balances`.`adjusted_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_leave_balances.leave_type_id.orphan_leave_type_id', count(*)
FROM `employee_leave_balances`
WHERE `leave_type_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `leave_types` WHERE `leave_types`.`id` = `employee_leave_balances`.`leave_type_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_leave_balances.employee_id.orphan_employee_id', count(*)
FROM `employee_leave_balances`
WHERE `employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_leave_balances`.`employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_schedules.restaurant_id.orphan_restaurant_id', count(*)
FROM `employee_schedules`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `employee_schedules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_schedules.updated_by.orphan_updated_by', count(*)
FROM `employee_schedules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_schedules.created_by.orphan_created_by', count(*)
FROM `employee_schedules`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_schedules.confirmed_by.orphan_confirmed_by', count(*)
FROM `employee_schedules`
WHERE `confirmed_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`confirmed_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_schedules.shift_template_id.orphan_shift_template_id', count(*)
FROM `employee_schedules`
WHERE `shift_template_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `shift_templates` WHERE `shift_templates`.`id` = `employee_schedules`.`shift_template_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'employee_schedules.employee_id.orphan_employee_id', count(*)
FROM `employee_schedules`
WHERE `employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `employee_schedules`.`employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_activity_logs.member_id.orphan_member_id', count(*)
FROM `group_activity_logs`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_members` WHERE `group_members`.`id` = `group_activity_logs`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_activity_logs.group_order_id.orphan_group_order_id', count(*)
FROM `group_activity_logs`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `group_activity_logs`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_cart_items.menu_item_id.orphan_menu_item_id', count(*)
FROM `group_cart_items`
WHERE `menu_item_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `menu_items` WHERE `menu_items`.`id` = `group_cart_items`.`menu_item_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_cart_items.member_id.orphan_member_id', count(*)
FROM `group_cart_items`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_members` WHERE `group_members`.`id` = `group_cart_items`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_cart_items.group_order_id.orphan_group_order_id', count(*)
FROM `group_cart_items`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `group_cart_items`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_members.user_id.orphan_user_id', count(*)
FROM `group_members`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `group_members`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_members.group_order_id.orphan_group_order_id', count(*)
FROM `group_members`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `group_members`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_orders.restaurant_id.orphan_restaurant_id', count(*)
FROM `group_orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `group_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_orders.table_id.orphan_table_id', count(*)
FROM `group_orders`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `group_orders`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'group_orders.created_by.orphan_created_by', count(*)
FROM `group_orders`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `group_orders`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_approval_rules.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_approval_rules`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_approval_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_approval_rules.updated_by.orphan_updated_by', count(*)
FROM `leave_approval_rules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_approval_rules`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_approval_rules.created_by.orphan_created_by', count(*)
FROM `leave_approval_rules`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_approval_rules`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_approval_rules.escalation_to_user_id.orphan_escalation_to_user_id', count(*)
FROM `leave_approval_rules`
WHERE `escalation_to_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_approval_rules`.`escalation_to_user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_approval_rules.leave_type_id.orphan_leave_type_id', count(*)
FROM `leave_approval_rules`
WHERE `leave_type_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `leave_types` WHERE `leave_types`.`id` = `leave_approval_rules`.`leave_type_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_calendar_events.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_calendar_events`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_calendar_events`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_calendar_events.created_by.orphan_created_by', count(*)
FROM `leave_calendar_events`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_calendar_events`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_requests.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_requests`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_requests.cancelled_by.orphan_cancelled_by', count(*)
FROM `leave_requests`
WHERE `cancelled_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`cancelled_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_requests.rejected_by.orphan_rejected_by', count(*)
FROM `leave_requests`
WHERE `rejected_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`rejected_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_requests.final_approver_id.orphan_final_approver_id', count(*)
FROM `leave_requests`
WHERE `final_approver_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`final_approver_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_requests.leave_type_id.orphan_leave_type_id', count(*)
FROM `leave_requests`
WHERE `leave_type_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `leave_types` WHERE `leave_types`.`id` = `leave_requests`.`leave_type_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_requests.employee_id.orphan_employee_id', count(*)
FROM `leave_requests`
WHERE `employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_requests`.`employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_types.restaurant_id.orphan_restaurant_id', count(*)
FROM `leave_types`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `leave_types`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_types.updated_by.orphan_updated_by', count(*)
FROM `leave_types`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_types`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'leave_types.created_by.orphan_created_by', count(*)
FROM `leave_types`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `leave_types`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'order_items.menu_item_id.orphan_menu_item_id', count(*)
FROM `order_items`
WHERE `menu_item_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `menu_items` WHERE `menu_items`.`id` = `order_items`.`menu_item_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'order_items.order_id.orphan_order_id', count(*)
FROM `order_items`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `order_items`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'orders.restaurant_id.orphan_restaurant_id', count(*)
FROM `orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'orders.customer_id.orphan_customer_id', count(*)
FROM `orders`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `orders`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'orders.table_id.orphan_table_id', count(*)
FROM `orders`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `orders`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_plans.restaurant_id.orphan_restaurant_id', count(*)
FROM `partnership_plans`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_plans`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_plans.created_by.orphan_created_by', count(*)
FROM `partnership_plans`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_plans`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_plans.partnership_id.orphan_partnership_id', count(*)
FROM `partnership_plans`
WHERE `partnership_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_plans`.`partnership_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_usage_logs.restaurant_id.orphan_restaurant_id', count(*)
FROM `partnership_usage_logs`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `partnership_usage_logs`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_usage_logs.verified_by_user_id.orphan_verified_by_user_id', count(*)
FROM `partnership_usage_logs`
WHERE `verified_by_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnership_usage_logs`.`verified_by_user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_usage_logs.order_id.orphan_order_id', count(*)
FROM `partnership_usage_logs`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `partnership_usage_logs`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_usage_logs.member_id.orphan_member_id', count(*)
FROM `partnership_usage_logs`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `verified_members` WHERE `verified_members`.`id` = `partnership_usage_logs`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_usage_logs.plan_id.orphan_plan_id', count(*)
FROM `partnership_usage_logs`
WHERE `plan_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `partnership_plans` WHERE `partnership_plans`.`id` = `partnership_usage_logs`.`plan_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnership_usage_logs.partnership_id.orphan_partnership_id', count(*)
FROM `partnership_usage_logs`
WHERE `partnership_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `partnership_usage_logs`.`partnership_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'partnerships.created_by.orphan_created_by', count(*)
FROM `partnerships`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `partnerships`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'password_change_logs.user_id.orphan_user_id', count(*)
FROM `password_change_logs`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `password_change_logs`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'password_reset_tokens.user_id.orphan_user_id', count(*)
FROM `password_reset_tokens`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `password_reset_tokens`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'payment_transactions.restaurant_id.orphan_restaurant_id', count(*)
FROM `payment_transactions`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `payment_transactions`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'payment_transactions.order_id.orphan_order_id', count(*)
FROM `payment_transactions`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `payment_transactions`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'phone_verification_tokens.user_id.orphan_user_id', count(*)
FROM `phone_verification_tokens`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `phone_verification_tokens`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'platform_orders.restaurant_id.orphan_restaurant_id', count(*)
FROM `platform_orders`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `platform_orders`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'platform_orders.order_id.orphan_order_id', count(*)
FROM `platform_orders`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `platform_orders`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'receipts.shift_id.orphan_shift_id', count(*)
FROM `receipts`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `receipts`.`shift_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'receipts.register_id.orphan_register_id', count(*)
FROM `receipts`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `receipts`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'receipts.order_id.orphan_order_id', count(*)
FROM `receipts`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `receipts`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refund_transactions.restaurant_id.orphan_restaurant_id', count(*)
FROM `refund_transactions`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `refund_transactions`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refund_transactions.order_id.orphan_order_id', count(*)
FROM `refund_transactions`
WHERE `order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `refund_transactions`.`order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refund_transactions.payment_transaction_id.orphan_payment_transaction_id', count(*)
FROM `refund_transactions`
WHERE `payment_transaction_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `payment_transactions` WHERE `payment_transactions`.`transaction_id` = `refund_transactions`.`payment_transaction_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refunds.approved_by.orphan_approved_by', count(*)
FROM `refunds`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `refunds`.`approved_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refunds.processed_by.orphan_processed_by', count(*)
FROM `refunds`
WHERE `processed_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `refunds`.`processed_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refunds.shift_id.orphan_shift_id', count(*)
FROM `refunds`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `refunds`.`shift_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refunds.register_id.orphan_register_id', count(*)
FROM `refunds`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `refunds`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'refunds.original_order_id.orphan_original_order_id', count(*)
FROM `refunds`
WHERE `original_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `orders` WHERE `orders`.`id` = `refunds`.`original_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'reservations.restaurant_id.orphan_restaurant_id', count(*)
FROM `reservations`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `reservations`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'reservations.customer_id.orphan_customer_id', count(*)
FROM `reservations`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `reservations`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'reservations.table_id.orphan_table_id', count(*)
FROM `reservations`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `reservations`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.restaurant_id.orphan_restaurant_id', count(*)
FROM `schedule_swap_requests`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `schedule_swap_requests`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.rejected_by.orphan_rejected_by', count(*)
FROM `schedule_swap_requests`
WHERE `rejected_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`rejected_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.approved_by.orphan_approved_by', count(*)
FROM `schedule_swap_requests`
WHERE `approved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`approved_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.accepted_by.orphan_accepted_by', count(*)
FROM `schedule_swap_requests`
WHERE `accepted_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`accepted_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.target_schedule_id.orphan_target_schedule_id', count(*)
FROM `schedule_swap_requests`
WHERE `target_schedule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`target_schedule_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.target_employee_id.orphan_target_employee_id', count(*)
FROM `schedule_swap_requests`
WHERE `target_employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`target_employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.requester_schedule_id.orphan_requester_schedule_id', count(*)
FROM `schedule_swap_requests`
WHERE `requester_schedule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `employee_schedules` WHERE `employee_schedules`.`id` = `schedule_swap_requests`.`requester_schedule_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'schedule_swap_requests.requester_employee_id.orphan_requester_employee_id', count(*)
FROM `schedule_swap_requests`
WHERE `requester_employee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `schedule_swap_requests`.`requester_employee_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'scheduling_conflicts.restaurant_id.orphan_restaurant_id', count(*)
FROM `scheduling_conflicts`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_conflicts`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'scheduling_conflicts.resolved_by.orphan_resolved_by', count(*)
FROM `scheduling_conflicts`
WHERE `resolved_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_conflicts`.`resolved_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'scheduling_conflicts.rule_id.orphan_rule_id', count(*)
FROM `scheduling_conflicts`
WHERE `rule_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `scheduling_rules` WHERE `scheduling_rules`.`id` = `scheduling_conflicts`.`rule_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'scheduling_rules.restaurant_id.orphan_restaurant_id', count(*)
FROM `scheduling_rules`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `scheduling_rules`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'scheduling_rules.updated_by.orphan_updated_by', count(*)
FROM `scheduling_rules`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'scheduling_rules.created_by.orphan_created_by', count(*)
FROM `scheduling_rules`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `scheduling_rules`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'sessions.user_id.orphan_user_id', count(*)
FROM `sessions`
WHERE `user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `sessions`.`user_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'share_codes.created_by.orphan_created_by', count(*)
FROM `share_codes`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `share_codes`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'shift_reports.operator_id.orphan_operator_id', count(*)
FROM `shift_reports`
WHERE `operator_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_reports`.`operator_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'shift_reports.register_id.orphan_register_id', count(*)
FROM `shift_reports`
WHERE `register_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_registers` WHERE `cash_registers`.`id` = `shift_reports`.`register_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'shift_reports.shift_id.orphan_shift_id', count(*)
FROM `shift_reports`
WHERE `shift_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cash_shifts` WHERE `cash_shifts`.`id` = `shift_reports`.`shift_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'shift_templates.restaurant_id.orphan_restaurant_id', count(*)
FROM `shift_templates`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `shift_templates`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'shift_templates.updated_by.orphan_updated_by', count(*)
FROM `shift_templates`
WHERE `updated_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`updated_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'shift_templates.created_by.orphan_created_by', count(*)
FROM `shift_templates`
WHERE `created_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `shift_templates`.`created_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'split_bills.member_id.orphan_member_id', count(*)
FROM `split_bills`
WHERE `member_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_members` WHERE `group_members`.`id` = `split_bills`.`member_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'split_bills.group_order_id.orphan_group_order_id', count(*)
FROM `split_bills`
WHERE `group_order_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `group_orders` WHERE `group_orders`.`id` = `split_bills`.`group_order_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'verified_members.verified_by.orphan_verified_by', count(*)
FROM `verified_members`
WHERE `verified_by` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `verified_members`.`verified_by`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'verified_members.customer_id.orphan_customer_id', count(*)
FROM `verified_members`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `customers` WHERE `customers`.`id` = `verified_members`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'verified_members.partnership_id.orphan_partnership_id', count(*)
FROM `verified_members`
WHERE `partnership_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `partnerships` WHERE `partnerships`.`id` = `verified_members`.`partnership_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'waiting_list.customer_id.orphan_customer_id', count(*)
FROM `waiting_list`
WHERE `customer_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `waiting_list`.`customer_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'waiting_list.table_id.orphan_table_id', count(*)
FROM `waiting_list`
WHERE `table_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `tables` WHERE `tables`.`id` = `waiting_list`.`table_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'waiting_list.restaurant_id.orphan_restaurant_id', count(*)
FROM `waiting_list`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `waiting_list`.`restaurant_id`);
--> statement-breakpoint

INSERT OR REPLACE INTO `_migration_assert_users_root_component_fk_0037`
SELECT 'users.restaurant_id.orphan_restaurant_id', count(*)
FROM `users`
WHERE `restaurant_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `restaurants`.`id` = `users`.`restaurant_id`);
--> statement-breakpoint

DROP TABLE `_migration_assert_users_root_component_fk_0037`;
--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_assert_users_root_component_counts_0037`;
--> statement-breakpoint

CREATE TABLE `_migration_assert_users_root_component_counts_0037` (
  `check_name` text PRIMARY KEY NOT NULL,
  `source_count` integer NOT NULL,
  `target_count` integer NOT NULL,
  CHECK (`source_count` = `target_count`)
);
--> statement-breakpoint

DROP TABLE IF EXISTS `audit_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `audit_logs__component_rebuild_data` AS SELECT * FROM `audit_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'audit_logs.stage', (SELECT count(*) FROM `audit_logs`), (SELECT count(*) FROM `audit_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `cash_movements__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `cash_movements__component_rebuild_data` AS SELECT * FROM `cash_movements`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'cash_movements.stage', (SELECT count(*) FROM `cash_movements`), (SELECT count(*) FROM `cash_movements__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `cash_shifts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `cash_shifts__component_rebuild_data` AS SELECT * FROM `cash_shifts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'cash_shifts.stage', (SELECT count(*) FROM `cash_shifts`), (SELECT count(*) FROM `cash_shifts__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupon_distributions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupon_distributions__component_rebuild_data` AS SELECT * FROM `coupon_distributions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupon_distributions.stage', (SELECT count(*) FROM `coupon_distributions`), (SELECT count(*) FROM `coupon_distributions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupon_templates__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupon_templates__component_rebuild_data` AS SELECT * FROM `coupon_templates`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupon_templates.stage', (SELECT count(*) FROM `coupon_templates`), (SELECT count(*) FROM `coupon_templates__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupon_usage__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupon_usage__component_rebuild_data` AS SELECT * FROM `coupon_usage`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupon_usage.stage', (SELECT count(*) FROM `coupon_usage`), (SELECT count(*) FROM `coupon_usage__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `coupons__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `coupons__component_rebuild_data` AS SELECT * FROM `coupons`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'coupons.stage', (SELECT count(*) FROM `coupons`), (SELECT count(*) FROM `coupons__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `email_verification_tokens__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `email_verification_tokens__component_rebuild_data` AS SELECT * FROM `email_verification_tokens`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'email_verification_tokens.stage', (SELECT count(*) FROM `email_verification_tokens`), (SELECT count(*) FROM `email_verification_tokens__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `employee_availability__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `employee_availability__component_rebuild_data` AS SELECT * FROM `employee_availability`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'employee_availability.stage', (SELECT count(*) FROM `employee_availability`), (SELECT count(*) FROM `employee_availability__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `employee_leave_balances__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `employee_leave_balances__component_rebuild_data` AS SELECT * FROM `employee_leave_balances`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'employee_leave_balances.stage', (SELECT count(*) FROM `employee_leave_balances`), (SELECT count(*) FROM `employee_leave_balances__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `employee_schedules__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `employee_schedules__component_rebuild_data` AS SELECT * FROM `employee_schedules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'employee_schedules.stage', (SELECT count(*) FROM `employee_schedules`), (SELECT count(*) FROM `employee_schedules__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_activity_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_activity_logs__component_rebuild_data` AS SELECT * FROM `group_activity_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'group_activity_logs.stage', (SELECT count(*) FROM `group_activity_logs`), (SELECT count(*) FROM `group_activity_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_cart_items__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_cart_items__component_rebuild_data` AS SELECT * FROM `group_cart_items`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'group_cart_items.stage', (SELECT count(*) FROM `group_cart_items`), (SELECT count(*) FROM `group_cart_items__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_members__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_members__component_rebuild_data` AS SELECT * FROM `group_members`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'group_members.stage', (SELECT count(*) FROM `group_members`), (SELECT count(*) FROM `group_members__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `group_orders__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `group_orders__component_rebuild_data` AS SELECT * FROM `group_orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'group_orders.stage', (SELECT count(*) FROM `group_orders`), (SELECT count(*) FROM `group_orders__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_approval_rules__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_approval_rules__component_rebuild_data` AS SELECT * FROM `leave_approval_rules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_approval_rules.stage', (SELECT count(*) FROM `leave_approval_rules`), (SELECT count(*) FROM `leave_approval_rules__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_calendar_events__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_calendar_events__component_rebuild_data` AS SELECT * FROM `leave_calendar_events`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_calendar_events.stage', (SELECT count(*) FROM `leave_calendar_events`), (SELECT count(*) FROM `leave_calendar_events__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_requests__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_requests__component_rebuild_data` AS SELECT * FROM `leave_requests`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_requests.stage', (SELECT count(*) FROM `leave_requests`), (SELECT count(*) FROM `leave_requests__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `leave_types__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `leave_types__component_rebuild_data` AS SELECT * FROM `leave_types`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'leave_types.stage', (SELECT count(*) FROM `leave_types`), (SELECT count(*) FROM `leave_types__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `order_items__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `order_items__component_rebuild_data` AS SELECT * FROM `order_items`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'order_items.stage', (SELECT count(*) FROM `order_items`), (SELECT count(*) FROM `order_items__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `orders__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `orders__component_rebuild_data` AS SELECT * FROM `orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'orders.stage', (SELECT count(*) FROM `orders`), (SELECT count(*) FROM `orders__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `partnership_plans__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `partnership_plans__component_rebuild_data` AS SELECT * FROM `partnership_plans`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'partnership_plans.stage', (SELECT count(*) FROM `partnership_plans`), (SELECT count(*) FROM `partnership_plans__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `partnership_usage_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `partnership_usage_logs__component_rebuild_data` AS SELECT * FROM `partnership_usage_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'partnership_usage_logs.stage', (SELECT count(*) FROM `partnership_usage_logs`), (SELECT count(*) FROM `partnership_usage_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `partnerships__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `partnerships__component_rebuild_data` AS SELECT * FROM `partnerships`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'partnerships.stage', (SELECT count(*) FROM `partnerships`), (SELECT count(*) FROM `partnerships__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `password_change_logs__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `password_change_logs__component_rebuild_data` AS SELECT * FROM `password_change_logs`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'password_change_logs.stage', (SELECT count(*) FROM `password_change_logs`), (SELECT count(*) FROM `password_change_logs__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `password_reset_tokens__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `password_reset_tokens__component_rebuild_data` AS SELECT * FROM `password_reset_tokens`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'password_reset_tokens.stage', (SELECT count(*) FROM `password_reset_tokens`), (SELECT count(*) FROM `password_reset_tokens__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `payment_transactions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `payment_transactions__component_rebuild_data` AS SELECT * FROM `payment_transactions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'payment_transactions.stage', (SELECT count(*) FROM `payment_transactions`), (SELECT count(*) FROM `payment_transactions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `phone_verification_tokens__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `phone_verification_tokens__component_rebuild_data` AS SELECT * FROM `phone_verification_tokens`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'phone_verification_tokens.stage', (SELECT count(*) FROM `phone_verification_tokens`), (SELECT count(*) FROM `phone_verification_tokens__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `platform_orders__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `platform_orders__component_rebuild_data` AS SELECT * FROM `platform_orders`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'platform_orders.stage', (SELECT count(*) FROM `platform_orders`), (SELECT count(*) FROM `platform_orders__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `receipts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `receipts__component_rebuild_data` AS SELECT * FROM `receipts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'receipts.stage', (SELECT count(*) FROM `receipts`), (SELECT count(*) FROM `receipts__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `refund_transactions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `refund_transactions__component_rebuild_data` AS SELECT * FROM `refund_transactions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'refund_transactions.stage', (SELECT count(*) FROM `refund_transactions`), (SELECT count(*) FROM `refund_transactions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `refunds__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `refunds__component_rebuild_data` AS SELECT * FROM `refunds`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'refunds.stage', (SELECT count(*) FROM `refunds`), (SELECT count(*) FROM `refunds__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `reservations__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `reservations__component_rebuild_data` AS SELECT * FROM `reservations`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'reservations.stage', (SELECT count(*) FROM `reservations`), (SELECT count(*) FROM `reservations__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `schedule_swap_requests__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `schedule_swap_requests__component_rebuild_data` AS SELECT * FROM `schedule_swap_requests`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'schedule_swap_requests.stage', (SELECT count(*) FROM `schedule_swap_requests`), (SELECT count(*) FROM `schedule_swap_requests__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `scheduling_conflicts__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `scheduling_conflicts__component_rebuild_data` AS SELECT * FROM `scheduling_conflicts`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'scheduling_conflicts.stage', (SELECT count(*) FROM `scheduling_conflicts`), (SELECT count(*) FROM `scheduling_conflicts__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `scheduling_rules__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `scheduling_rules__component_rebuild_data` AS SELECT * FROM `scheduling_rules`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'scheduling_rules.stage', (SELECT count(*) FROM `scheduling_rules`), (SELECT count(*) FROM `scheduling_rules__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `sessions__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `sessions__component_rebuild_data` AS SELECT * FROM `sessions`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'sessions.stage', (SELECT count(*) FROM `sessions`), (SELECT count(*) FROM `sessions__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `share_codes__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `share_codes__component_rebuild_data` AS SELECT * FROM `share_codes`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'share_codes.stage', (SELECT count(*) FROM `share_codes`), (SELECT count(*) FROM `share_codes__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `shift_reports__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `shift_reports__component_rebuild_data` AS SELECT * FROM `shift_reports`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'shift_reports.stage', (SELECT count(*) FROM `shift_reports`), (SELECT count(*) FROM `shift_reports__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `shift_templates__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `shift_templates__component_rebuild_data` AS SELECT * FROM `shift_templates`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'shift_templates.stage', (SELECT count(*) FROM `shift_templates`), (SELECT count(*) FROM `shift_templates__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `split_bills__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `split_bills__component_rebuild_data` AS SELECT * FROM `split_bills`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'split_bills.stage', (SELECT count(*) FROM `split_bills`), (SELECT count(*) FROM `split_bills__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `users__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `users__component_rebuild_data` AS SELECT * FROM `users`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'users.stage', (SELECT count(*) FROM `users`), (SELECT count(*) FROM `users__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `verified_members__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `verified_members__component_rebuild_data` AS SELECT * FROM `verified_members`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'verified_members.stage', (SELECT count(*) FROM `verified_members`), (SELECT count(*) FROM `verified_members__component_rebuild_data`);
--> statement-breakpoint

DROP TABLE IF EXISTS `waiting_list__component_rebuild_data`;
--> statement-breakpoint

CREATE TABLE `waiting_list__component_rebuild_data` AS SELECT * FROM `waiting_list`;
--> statement-breakpoint

INSERT INTO `_migration_assert_users_root_component_counts_0037`
SELECT 'waiting_list.stage', (SELECT count(*) FROM `waiting_list`), (SELECT count(*) FROM `waiting_list__component_rebuild_data`);
--> statement-breakpoint
