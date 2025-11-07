-- =====================================================
-- Migration: 創建索引（簡化版）
-- Version: 0044
-- Date: 2025-10-28
-- Description: 為所有表創建必要的索引以優化查詢性能
-- Note: 此為簡化版，僅創建索引（已移除 DROP 和 RENAME 操作）
-- =====================================================

-- =====================================================
-- 創建所有表的索引
-- =====================================================

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- categories 表索引
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- menu_items 表索引
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_order ON menu_items(sort_order);

-- tables 表索引
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON tables(restaurant_id);
-- Note: tables table doesn't have a 'status' column, using is_active instead
CREATE INDEX IF NOT EXISTS idx_tables_is_active ON tables(is_active);
CREATE INDEX IF NOT EXISTS idx_tables_is_occupied ON tables(is_occupied);

-- orders 表索引
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- DISABLED (0038 not applied): -- shift_templates 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_shift_templates_restaurant_id ON shift_templates(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_shift_templates_is_active ON shift_templates(is_active);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- employee_schedules 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_schedules_restaurant_id ON employee_schedules(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_schedules_employee_id ON employee_schedules(employee_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_schedules_work_date ON employee_schedules(work_date);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_schedules_status ON employee_schedules(status);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- scheduling_rules 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_scheduling_rules_restaurant_id ON scheduling_rules(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_scheduling_rules_is_active ON scheduling_rules(is_active);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- scheduling_conflicts 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_scheduling_conflicts_restaurant_id ON scheduling_conflicts(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_scheduling_conflicts_status ON scheduling_conflicts(status);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- schedule_swap_requests 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_schedule_swap_requests_restaurant_id ON schedule_swap_requests(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_schedule_swap_requests_status ON schedule_swap_requests(status);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- employee_availability 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_availability_restaurant_id ON employee_availability(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_availability_employee_id ON employee_availability(employee_id);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- leave_requests 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_leave_requests_restaurant_id ON leave_requests(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- leave_approval_rules 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_leave_approval_rules_restaurant_id ON leave_approval_rules(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_leave_approval_rules_is_active ON leave_approval_rules(is_active);
-- DISABLED (0038 not applied): 
-- DISABLED (0038 not applied): -- employee_leave_balances 表索引
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_restaurant_id ON employee_leave_balances(restaurant_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_employee_id ON employee_leave_balances(employee_id);
-- DISABLED (0038 not applied): CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_year ON employee_leave_balances(year);

-- audit_logs 表索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_id ON audit_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- error_reports 表索引
CREATE INDEX IF NOT EXISTS idx_error_reports_restaurant_id ON error_reports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_status ON error_reports(status);

-- system_alerts 表索引
CREATE INDEX IF NOT EXISTS idx_system_alerts_restaurant_id ON system_alerts(restaurant_id);
-- Note: system_alerts doesn't have a 'status' column, using resolved_at and severity instead
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved_at ON system_alerts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);

-- group_orders 表索引
CREATE INDEX IF NOT EXISTS idx_group_orders_restaurant_id ON group_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_group_orders_status ON group_orders(status);

-- promotions 表索引
CREATE INDEX IF NOT EXISTS idx_promotions_restaurant_id ON promotions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);

-- customer_reviews 表索引
CREATE INDEX IF NOT EXISTS idx_customer_reviews_restaurant_id ON customer_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_menu_item_id ON customer_reviews(menu_item_id);

-- inventory_items 表索引
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_active ON inventory_items(is_active);

-- cash_registers 表索引
CREATE INDEX IF NOT EXISTS idx_cash_registers_restaurant_id ON cash_registers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);

-- printer_devices 表索引
CREATE INDEX IF NOT EXISTS idx_printer_devices_restaurant_id ON printer_devices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printer_devices_is_active ON printer_devices(is_active);

-- printer_configurations 表索引
CREATE INDEX IF NOT EXISTS idx_printer_configurations_restaurant_id ON printer_configurations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printer_configurations_device_id ON printer_configurations(device_id);

-- print_templates 表索引
CREATE INDEX IF NOT EXISTS idx_print_templates_restaurant_id ON print_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_print_templates_is_active ON print_templates(is_active);

-- waiting_queue 表索引
CREATE INDEX IF NOT EXISTS idx_waiting_queue_restaurant_id ON waiting_queue(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiting_queue_status ON waiting_queue(status);

-- queue_settings 表索引
CREATE INDEX IF NOT EXISTS idx_queue_settings_restaurant_id ON queue_settings(restaurant_id);

-- queue_displays 表索引
CREATE INDEX IF NOT EXISTS idx_queue_displays_restaurant_id ON queue_displays(restaurant_id);

-- queue_events 表索引
CREATE INDEX IF NOT EXISTS idx_queue_events_restaurant_id ON queue_events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_queue_id ON queue_events(queue_id);

-- queue_statistics 表索引
CREATE INDEX IF NOT EXISTS idx_queue_statistics_restaurant_id ON queue_statistics(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_queue_statistics_stat_date ON queue_statistics(stat_date);

-- restaurant_settings 表索引
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_restaurant_id ON restaurant_settings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_setting_key ON restaurant_settings(setting_key);

-- restaurant_business_hours 表索引
CREATE INDEX IF NOT EXISTS idx_restaurant_business_hours_restaurant_id ON restaurant_business_hours(restaurant_id);

-- restaurant_special_hours 表索引
CREATE INDEX IF NOT EXISTS idx_restaurant_special_hours_restaurant_id ON restaurant_special_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_special_hours_special_date ON restaurant_special_hours(special_date);

-- table_reservations 表索引
CREATE INDEX IF NOT EXISTS idx_table_reservations_restaurant_id ON table_reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_status ON table_reservations(status);

-- leave_calendar_events 表索引
CREATE INDEX IF NOT EXISTS idx_leave_calendar_events_restaurant_id ON leave_calendar_events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_leave_calendar_events_employee_id ON leave_calendar_events(employee_id);

-- qr_batches 表索引
CREATE INDEX IF NOT EXISTS idx_qr_batches_restaurant_id ON qr_batches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_batches_status ON qr_batches(status);

-- qr_codes 表索引
CREATE INDEX IF NOT EXISTS idx_qr_codes_restaurant_id ON qr_codes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_qr_type ON qr_codes(qr_type);
CREATE INDEX IF NOT EXISTS idx_qr_codes_reference_id ON qr_codes(reference_id);

-- qr_templates 表索引
CREATE INDEX IF NOT EXISTS idx_qr_templates_restaurant_id ON qr_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_templates_is_active ON qr_templates(is_active);
