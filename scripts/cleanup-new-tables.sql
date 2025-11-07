-- 清理所有 _new 表
PRAGMA foreign_keys=OFF;

-- Batch 2 tables (from 0041)
DROP TABLE IF EXISTS audit_logs_new;
DROP TABLE IF EXISTS error_reports_new;
DROP TABLE IF EXISTS system_alerts_new;
DROP TABLE IF EXISTS group_orders_new;
DROP TABLE IF EXISTS promotions_new;
DROP TABLE IF EXISTS customer_reviews_new;
DROP TABLE IF EXISTS inventory_items_new;
DROP TABLE IF EXISTS cash_registers_new;
DROP TABLE IF EXISTS printer_devices_new;
DROP TABLE IF EXISTS printer_configurations_new;
DROP TABLE IF EXISTS print_templates_new;
DROP TABLE IF EXISTS waiting_queue_new;
DROP TABLE IF EXISTS queue_settings_new;
DROP TABLE IF EXISTS queue_displays_new;
DROP TABLE IF EXISTS queue_events_new;
DROP TABLE IF EXISTS queue_statistics_new;
DROP TABLE IF EXISTS restaurant_settings_new;
DROP TABLE IF EXISTS restaurant_business_hours_new;
DROP TABLE IF EXISTS restaurant_special_hours_new;
DROP TABLE IF EXISTS table_reservations_new;
DROP TABLE IF EXISTS leave_calendar_events_new;
DROP TABLE IF EXISTS qr_batches_new;
DROP TABLE IF EXISTS qr_codes_new;
DROP TABLE IF EXISTS qr_templates_new;

-- Batch 1 tables (from 0040, if any)
DROP TABLE IF EXISTS users_new;
DROP TABLE IF EXISTS categories_new;
DROP TABLE IF EXISTS menu_items_new;
DROP TABLE IF EXISTS tables_new;
DROP TABLE IF EXISTS orders_new;
DROP TABLE IF EXISTS shift_templates_new;
DROP TABLE IF EXISTS employee_schedules_new;
DROP TABLE IF EXISTS scheduling_rules_new;
DROP TABLE IF EXISTS scheduling_conflicts_new;
DROP TABLE IF EXISTS schedule_swap_requests_new;
DROP TABLE IF EXISTS employee_availability_new;
DROP TABLE IF EXISTS leave_requests_new;
DROP TABLE IF EXISTS leave_approval_rules_new;
DROP TABLE IF EXISTS employee_leave_balances_new;

PRAGMA foreign_keys=ON;
