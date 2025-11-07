-- =====================================================
-- Migration: 刪除所有視圖
-- Version: 0039_8
-- Date: 2025-10-28
-- Description: 刪除所有視圖以便進行表結構遷移
-- =====================================================

-- 刪除所有視圖
DROP VIEW IF EXISTS qr_statistics;
DROP VIEW IF EXISTS popular_qr_templates;
DROP VIEW IF EXISTS qr_usage_analytics;
DROP VIEW IF EXISTS error_statistics;
DROP VIEW IF EXISTS daily_error_summary;
DROP VIEW IF EXISTS inventory_status;
DROP VIEW IF EXISTS v_current_menu_costs;
DROP VIEW IF EXISTS v_product_performance_30d;
DROP VIEW IF EXISTS restaurant_current_status;
DROP VIEW IF EXISTS restaurant_weekly_hours;
DROP VIEW IF EXISTS menu_item_current_availability;
DROP VIEW IF EXISTS restaurant_json_settings_extract;
DROP VIEW IF EXISTS data_integrity_report;
DROP VIEW IF EXISTS integrity_check_summary;
DROP VIEW IF EXISTS expired_group_orders;
DROP VIEW IF EXISTS active_shifts;
DROP VIEW IF EXISTS daily_sales_summary;
DROP VIEW IF EXISTS current_queue;
DROP VIEW IF EXISTS daily_queue_stats;
DROP VIEW IF EXISTS table_availability;
DROP VIEW IF EXISTS expired_notifications;
DROP VIEW IF EXISTS old_queue_records;
DROP VIEW IF EXISTS active_print_queue;
DROP VIEW IF EXISTS printer_health_status;
DROP VIEW IF EXISTS group_payment_summary;
DROP VIEW IF EXISTS available_coupons;
DROP VIEW IF EXISTS coupon_statistics;
DROP VIEW IF EXISTS weekly_schedule_summary;
DROP VIEW IF EXISTS daily_staffing_coverage;
DROP VIEW IF EXISTS active_conflicts_view;
DROP VIEW IF EXISTS employee_weekly_hours;
DROP VIEW IF EXISTS pending_swap_requests;
DROP VIEW IF EXISTS current_year_leave_balances;
DROP VIEW IF EXISTS pending_leave_requests;
DROP VIEW IF EXISTS monthly_leave_statistics;
DROP VIEW IF EXISTS today_reservations;
