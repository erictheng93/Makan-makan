-- Extend restaurant_id trigger guards to modules not covered by 0023.
-- Existing orphan rows remain visible through data audits; these guards stop
-- new orphan restaurant references before the physical FK rebuild migration.

CREATE TRIGGER IF NOT EXISTS `coupon_templates_restaurant_guard_bi`
BEFORE INSERT ON `coupon_templates`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupon_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `coupon_templates_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `coupon_templates`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'coupon_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `shop_feedback_restaurant_guard_bi`
BEFORE INSERT ON `shop_feedback`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shop_feedback.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `shop_feedback_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `shop_feedback`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shop_feedback.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `qr_batches_restaurant_guard_bi`
BEFORE INSERT ON `qr_batches`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'qr_batches.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `qr_batches_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `qr_batches`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'qr_batches.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `forecast_cache_restaurant_guard_bi`
BEFORE INSERT ON `forecast_cache`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'forecast_cache.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `forecast_cache_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `forecast_cache`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'forecast_cache.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `ingredient_definitions_restaurant_guard_bi`
BEFORE INSERT ON `ingredient_definitions`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'ingredient_definitions.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `ingredient_definitions_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `ingredient_definitions`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'ingredient_definitions.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `platform_integrations_restaurant_guard_bi`
BEFORE INSERT ON `platform_integrations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_integrations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `platform_integrations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_integrations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_integrations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `platform_orders_restaurant_guard_bi`
BEFORE INSERT ON `platform_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `platform_orders_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_orders`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_orders.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `platform_menu_mappings_restaurant_guard_bi`
BEFORE INSERT ON `platform_menu_mappings`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_menu_mappings.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `platform_menu_mappings_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_menu_mappings`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_menu_mappings.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `platform_webhook_logs_restaurant_guard_bi`
BEFORE INSERT ON `platform_webhook_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_webhook_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `platform_webhook_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `platform_webhook_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'platform_webhook_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `error_reports_restaurant_guard_bi`
BEFORE INSERT ON `error_reports`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'error_reports.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `error_reports_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `error_reports`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'error_reports.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `system_alerts_restaurant_guard_bi`
BEFORE INSERT ON `system_alerts`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'system_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `system_alerts_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `system_alerts`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'system_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `audit_logs_restaurant_guard_bi`
BEFORE INSERT ON `audit_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `audit_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `audit_logs`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `dish_search_index_restaurant_guard_bi`
BEFORE INSERT ON `dish_search_index`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'dish_search_index.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `dish_search_index_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `dish_search_index`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'dish_search_index.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `images_restaurant_guard_bi`
BEFORE INSERT ON `images`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'images.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `images_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `images`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'images.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `leave_approval_rules_restaurant_guard_bi`
BEFORE INSERT ON `leave_approval_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_approval_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `leave_approval_rules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_approval_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_approval_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `employee_leave_balances_restaurant_guard_bi`
BEFORE INSERT ON `employee_leave_balances`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_leave_balances.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `employee_leave_balances_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_leave_balances`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_leave_balances.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `leave_requests_restaurant_guard_bi`
BEFORE INSERT ON `leave_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `leave_requests_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `leave_calendar_events_restaurant_guard_bi`
BEFORE INSERT ON `leave_calendar_events`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_calendar_events.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `leave_calendar_events_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_calendar_events`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_calendar_events.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `leave_types_restaurant_guard_bi`
BEFORE INSERT ON `leave_types`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_types.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `leave_types_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `leave_types`
FOR EACH ROW
WHEN NEW.`restaurant_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'leave_types.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `scheduling_conflicts_restaurant_guard_bi`
BEFORE INSERT ON `scheduling_conflicts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_conflicts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `scheduling_conflicts_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `scheduling_conflicts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_conflicts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `schedule_swap_requests_restaurant_guard_bi`
BEFORE INSERT ON `schedule_swap_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'schedule_swap_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `schedule_swap_requests_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `schedule_swap_requests`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'schedule_swap_requests.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `employee_schedules_restaurant_guard_bi`
BEFORE INSERT ON `employee_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `employee_schedules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `scheduling_rules_restaurant_guard_bi`
BEFORE INSERT ON `scheduling_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `scheduling_rules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `scheduling_rules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'scheduling_rules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `employee_availability_restaurant_guard_bi`
BEFORE INSERT ON `employee_availability`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_availability.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `employee_availability_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `employee_availability`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'employee_availability.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `shift_templates_restaurant_guard_bi`
BEFORE INSERT ON `shift_templates`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shift_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `shift_templates_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `shift_templates`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'shift_templates.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `partnership_plans_restaurant_guard_bi`
BEFORE INSERT ON `partnership_plans`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_plans.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `partnership_plans_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `partnership_plans`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_plans.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `partnership_usage_logs_restaurant_guard_bi`
BEFORE INSERT ON `partnership_usage_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_usage_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `partnership_usage_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `partnership_usage_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'partnership_usage_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `backup_records_restaurant_guard_bi`
BEFORE INSERT ON `backup_records`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_records.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `backup_records_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_records`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_records.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `backup_schedules_restaurant_guard_bi`
BEFORE INSERT ON `backup_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `backup_schedules_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_schedules`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_schedules.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `backup_configurations_restaurant_guard_bi`
BEFORE INSERT ON `backup_configurations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_configurations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `backup_configurations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_configurations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_configurations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `backup_alerts_restaurant_guard_bi`
BEFORE INSERT ON `backup_alerts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `backup_alerts_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_alerts`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_alerts.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `backup_audit_logs_restaurant_guard_bi`
BEFORE INSERT ON `backup_audit_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `backup_audit_logs_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `backup_audit_logs`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'backup_audit_logs.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `restore_operations_restaurant_guard_bi`
BEFORE INSERT ON `restore_operations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'restore_operations.restaurant_id references missing restaurants.id');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `restore_operations_restaurant_guard_bu`
BEFORE UPDATE OF `restaurant_id` ON `restore_operations`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
BEGIN
  SELECT RAISE(ABORT, 'restore_operations.restaurant_id references missing restaurants.id');
END;
