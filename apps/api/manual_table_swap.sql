-- =====================================================
-- 手動表交換腳本
-- Purpose: 繞過 Wrangler 事務問題，手動完成 0044 的表交換
-- =====================================================

PRAGMA foreign_keys=OFF;

-- 步驟 1: DROP 所有舊表（按依賴順序）
-- 先刪除依賴其他表的表
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS employee_schedules;
DROP TABLE IF EXISTS shift_templates;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS employee_leave_balances;
DROP TABLE IF EXISTS leave_approval_rules;
DROP TABLE IF EXISTS schedule_swap_requests;
DROP TABLE IF EXISTS scheduling_conflicts;
DROP TABLE IF EXISTS scheduling_rules;
DROP TABLE IF EXISTS employee_availability;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS error_reports;
DROP TABLE IF EXISTS system_alerts;
DROP TABLE IF EXISTS group_orders;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS customer_reviews;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS cash_registers;
DROP TABLE IF EXISTS printer_devices;
DROP TABLE IF EXISTS printer_configurations;
DROP TABLE IF EXISTS print_templates;
DROP TABLE IF EXISTS waiting_queue;
DROP TABLE IF EXISTS queue_settings;
DROP TABLE IF EXISTS queue_displays;
DROP TABLE IF EXISTS queue_events;
DROP TABLE IF EXISTS queue_statistics;
DROP TABLE IF EXISTS restaurant_settings;
DROP TABLE IF EXISTS restaurant_business_hours;
DROP TABLE IF EXISTS restaurant_special_hours;
DROP TABLE IF EXISTS table_reservations;
DROP TABLE IF EXISTS leave_calendar_events;
DROP TABLE IF EXISTS qr_batches;
DROP TABLE IF EXISTS qr_codes;
DROP TABLE IF EXISTS qr_templates;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS users;

-- 步驟 2: RENAME _new 表為正式名稱
ALTER TABLE users_new RENAME TO users;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE menu_items_new RENAME TO menu_items;
ALTER TABLE tables_new RENAME TO tables;
ALTER TABLE orders_new RENAME TO orders;
ALTER TABLE shift_templates_new RENAME TO shift_templates;
ALTER TABLE employee_schedules_new RENAME TO employee_schedules;
ALTER TABLE scheduling_rules_new RENAME TO scheduling_rules;
ALTER TABLE scheduling_conflicts_new RENAME TO scheduling_conflicts;
ALTER TABLE schedule_swap_requests_new RENAME TO schedule_swap_requests;
ALTER TABLE employee_availability_new RENAME TO employee_availability;
ALTER TABLE leave_requests_new RENAME TO leave_requests;
ALTER TABLE leave_approval_rules_new RENAME TO leave_approval_rules;
ALTER TABLE employee_leave_balances_new RENAME TO employee_leave_balances;
ALTER TABLE audit_logs_new RENAME TO audit_logs;
ALTER TABLE error_reports_new RENAME TO error_reports;
ALTER TABLE system_alerts_new RENAME TO system_alerts;
ALTER TABLE group_orders_new RENAME TO group_orders;
ALTER TABLE promotions_new RENAME TO promotions;
ALTER TABLE customer_reviews_new RENAME TO customer_reviews;
ALTER TABLE inventory_items_new RENAME TO inventory_items;
ALTER TABLE cash_registers_new RENAME TO cash_registers;
ALTER TABLE printer_devices_new RENAME TO printer_devices;
ALTER TABLE printer_configurations_new RENAME TO printer_configurations;
ALTER TABLE print_templates_new RENAME TO print_templates;
ALTER TABLE waiting_queue_new RENAME TO waiting_queue;
ALTER TABLE queue_settings_new RENAME TO queue_settings;
ALTER TABLE queue_displays_new RENAME TO queue_displays;
ALTER TABLE queue_events_new RENAME TO queue_events;
ALTER TABLE queue_statistics_new RENAME TO queue_statistics;
ALTER TABLE restaurant_settings_new RENAME TO restaurant_settings;
ALTER TABLE restaurant_business_hours_new RENAME TO restaurant_business_hours;
ALTER TABLE restaurant_special_hours_new RENAME TO restaurant_special_hours;
ALTER TABLE table_reservations_new RENAME TO table_reservations;
ALTER TABLE leave_calendar_events_new RENAME TO leave_calendar_events;
ALTER TABLE qr_batches_new RENAME TO qr_batches;
ALTER TABLE qr_codes_new RENAME TO qr_codes;
ALTER TABLE qr_templates_new RENAME TO qr_templates;

PRAGMA foreign_keys=ON;
