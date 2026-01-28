-- =========================================================
-- Data Migration: Convert seconds timestamps to milliseconds
-- =========================================================
-- This script copies existing timestamp data (seconds) to
-- the new _ms columns (milliseconds) by multiplying by 1000.
--
-- Run this AFTER the schema migration (0004_lazy_wong.sql)
--
-- Usage (local):
--   npx wrangler d1 execute makanmakan-local --local \
--     --file=./packages/database/migrations_fresh/data-migration-timestamp.sql \
--     --config=./apps/api/wrangler.toml
-- =========================================================

-- restaurants
UPDATE restaurants SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE restaurants SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;
UPDATE restaurants SET deleted_at_ms = deleted_at * 1000 WHERE deleted_at IS NOT NULL AND deleted_at_ms IS NULL;

-- users
UPDATE users SET last_login_at_ms = last_login_at * 1000 WHERE last_login_at IS NOT NULL AND last_login_at_ms IS NULL;
UPDATE users SET password_changed_at_ms = password_changed_at * 1000 WHERE password_changed_at IS NOT NULL AND password_changed_at_ms IS NULL;
UPDATE users SET email_verified_at_ms = email_verified_at * 1000 WHERE email_verified_at IS NOT NULL AND email_verified_at_ms IS NULL;
UPDATE users SET phone_verified_at_ms = phone_verified_at * 1000 WHERE phone_verified_at IS NOT NULL AND phone_verified_at_ms IS NULL;
UPDATE users SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE users SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;
UPDATE users SET deleted_at_ms = deleted_at * 1000 WHERE deleted_at IS NOT NULL AND deleted_at_ms IS NULL;

-- categories
UPDATE categories SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE categories SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;
UPDATE categories SET deleted_at_ms = deleted_at * 1000 WHERE deleted_at IS NOT NULL AND deleted_at_ms IS NULL;

-- menu_items
UPDATE menu_items SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE menu_items SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;
UPDATE menu_items SET deleted_at_ms = deleted_at * 1000 WHERE deleted_at IS NOT NULL AND deleted_at_ms IS NULL;

-- tables
UPDATE tables SET occupied_at_ms = occupied_at * 1000 WHERE occupied_at IS NOT NULL AND occupied_at_ms IS NULL;
UPDATE tables SET estimated_free_at_ms = estimated_free_at * 1000 WHERE estimated_free_at IS NOT NULL AND estimated_free_at_ms IS NULL;
UPDATE tables SET last_cleaned_at_ms = last_cleaned_at * 1000 WHERE last_cleaned_at IS NOT NULL AND last_cleaned_at_ms IS NULL;
UPDATE tables SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE tables SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;
UPDATE tables SET deleted_at_ms = deleted_at * 1000 WHERE deleted_at IS NOT NULL AND deleted_at_ms IS NULL;

-- orders
UPDATE orders SET confirmed_at_ms = confirmed_at * 1000 WHERE confirmed_at IS NOT NULL AND confirmed_at_ms IS NULL;
UPDATE orders SET preparing_at_ms = preparing_at * 1000 WHERE preparing_at IS NOT NULL AND preparing_at_ms IS NULL;
UPDATE orders SET ready_at_ms = ready_at * 1000 WHERE ready_at IS NOT NULL AND ready_at_ms IS NULL;
UPDATE orders SET delivered_at_ms = delivered_at * 1000 WHERE delivered_at IS NOT NULL AND delivered_at_ms IS NULL;
UPDATE orders SET paid_at_ms = paid_at * 1000 WHERE paid_at IS NOT NULL AND paid_at_ms IS NULL;
UPDATE orders SET cancelled_at_ms = cancelled_at * 1000 WHERE cancelled_at IS NOT NULL AND cancelled_at_ms IS NULL;
UPDATE orders SET reviewed_at_ms = reviewed_at * 1000 WHERE reviewed_at IS NOT NULL AND reviewed_at_ms IS NULL;
UPDATE orders SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE orders SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- audit_logs
UPDATE audit_logs SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;

-- employee_leave_balances
UPDATE employee_leave_balances SET carryover_expires_at_ms = carryover_expires_at * 1000 WHERE carryover_expires_at IS NOT NULL AND carryover_expires_at_ms IS NULL;
UPDATE employee_leave_balances SET adjusted_at_ms = adjusted_at * 1000 WHERE adjusted_at IS NOT NULL AND adjusted_at_ms IS NULL;
UPDATE employee_leave_balances SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE employee_leave_balances SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- leave_approval_rules
UPDATE leave_approval_rules SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE leave_approval_rules SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- leave_calendar_events
UPDATE leave_calendar_events SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE leave_calendar_events SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- leave_requests
UPDATE leave_requests SET final_approved_at_ms = final_approved_at * 1000 WHERE final_approved_at IS NOT NULL AND final_approved_at_ms IS NULL;
UPDATE leave_requests SET rejected_at_ms = rejected_at * 1000 WHERE rejected_at IS NOT NULL AND rejected_at_ms IS NULL;
UPDATE leave_requests SET cancelled_at_ms = cancelled_at * 1000 WHERE cancelled_at IS NOT NULL AND cancelled_at_ms IS NULL;
UPDATE leave_requests SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE leave_requests SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;
UPDATE leave_requests SET submitted_at_ms = submitted_at * 1000 WHERE submitted_at IS NOT NULL AND submitted_at_ms IS NULL;

-- leave_types
UPDATE leave_types SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE leave_types SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- employee_availability
UPDATE employee_availability SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE employee_availability SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- employee_schedules
UPDATE employee_schedules SET clock_in_time_ms = clock_in_time * 1000 WHERE clock_in_time IS NOT NULL AND clock_in_time_ms IS NULL;
UPDATE employee_schedules SET clock_out_time_ms = clock_out_time * 1000 WHERE clock_out_time IS NOT NULL AND clock_out_time_ms IS NULL;
UPDATE employee_schedules SET confirmed_at_ms = confirmed_at * 1000 WHERE confirmed_at IS NOT NULL AND confirmed_at_ms IS NULL;
UPDATE employee_schedules SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE employee_schedules SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- schedule_swap_requests
UPDATE schedule_swap_requests SET accepted_at_ms = accepted_at * 1000 WHERE accepted_at IS NOT NULL AND accepted_at_ms IS NULL;
UPDATE schedule_swap_requests SET approved_at_ms = approved_at * 1000 WHERE approved_at IS NOT NULL AND approved_at_ms IS NULL;
UPDATE schedule_swap_requests SET rejected_at_ms = rejected_at * 1000 WHERE rejected_at IS NOT NULL AND rejected_at_ms IS NULL;
UPDATE schedule_swap_requests SET expires_at_ms = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at_ms IS NULL;
UPDATE schedule_swap_requests SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE schedule_swap_requests SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- scheduling_conflicts
UPDATE scheduling_conflicts SET resolved_at_ms = resolved_at * 1000 WHERE resolved_at IS NOT NULL AND resolved_at_ms IS NULL;
UPDATE scheduling_conflicts SET detected_at_ms = detected_at * 1000 WHERE detected_at IS NOT NULL AND detected_at_ms IS NULL;
UPDATE scheduling_conflicts SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE scheduling_conflicts SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- scheduling_rules
UPDATE scheduling_rules SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE scheduling_rules SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- shift_templates
UPDATE shift_templates SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE shift_templates SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- cash_movements
UPDATE cash_movements SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;

-- cash_registers
UPDATE cash_registers SET last_maintenance_at_ms = last_maintenance_at * 1000 WHERE last_maintenance_at IS NOT NULL AND last_maintenance_at_ms IS NULL;
UPDATE cash_registers SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE cash_registers SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- cash_shifts
UPDATE cash_shifts SET started_at_ms = started_at * 1000 WHERE started_at IS NOT NULL AND started_at_ms IS NULL;
UPDATE cash_shifts SET ended_at_ms = ended_at * 1000 WHERE ended_at IS NOT NULL AND ended_at_ms IS NULL;

-- receipts
UPDATE receipts SET printed_at_ms = printed_at * 1000 WHERE printed_at IS NOT NULL AND printed_at_ms IS NULL;
UPDATE receipts SET last_reprint_at_ms = last_reprint_at * 1000 WHERE last_reprint_at IS NOT NULL AND last_reprint_at_ms IS NULL;
UPDATE receipts SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;

-- refunds
UPDATE refunds SET processed_at_ms = processed_at * 1000 WHERE processed_at IS NOT NULL AND processed_at_ms IS NULL;
UPDATE refunds SET completed_at_ms = completed_at * 1000 WHERE completed_at IS NOT NULL AND completed_at_ms IS NULL;

-- shift_reports
UPDATE shift_reports SET generated_at_ms = generated_at * 1000 WHERE generated_at IS NOT NULL AND generated_at_ms IS NULL;

-- group_activity_logs
UPDATE group_activity_logs SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;

-- group_cart_items
UPDATE group_cart_items SET added_at_ms = added_at * 1000 WHERE added_at IS NOT NULL AND added_at_ms IS NULL;
UPDATE group_cart_items SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- group_members
UPDATE group_members SET joined_at_ms = joined_at * 1000 WHERE joined_at IS NOT NULL AND joined_at_ms IS NULL;
UPDATE group_members SET last_active_at_ms = last_active_at * 1000 WHERE last_active_at IS NOT NULL AND last_active_at_ms IS NULL;
UPDATE group_members SET left_at_ms = left_at * 1000 WHERE left_at IS NOT NULL AND left_at_ms IS NULL;

-- group_orders
UPDATE group_orders SET expires_at_ms = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at_ms IS NULL;
UPDATE group_orders SET locked_at_ms = locked_at * 1000 WHERE locked_at IS NOT NULL AND locked_at_ms IS NULL;
UPDATE group_orders SET completed_at_ms = completed_at * 1000 WHERE completed_at IS NOT NULL AND completed_at_ms IS NULL;
UPDATE group_orders SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE group_orders SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- share_codes
UPDATE share_codes SET expires_at_ms = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at_ms IS NULL;
UPDATE share_codes SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;

-- split_bills
UPDATE split_bills SET paid_at_ms = paid_at * 1000 WHERE paid_at IS NOT NULL AND paid_at_ms IS NULL;
UPDATE split_bills SET created_at_ms = created_at * 1000 WHERE created_at IS NOT NULL AND created_at_ms IS NULL;
UPDATE split_bills SET updated_at_ms = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at_ms IS NULL;

-- =========================================================
-- Verification Queries (Run these to verify migration)
-- =========================================================
-- Check for any records where _ms != original * 1000
-- SELECT COUNT(*) FROM orders WHERE created_at_ms != created_at * 1000;
-- Should return 0

-- Check sample data to verify conversion
-- SELECT created_at, created_at_ms FROM orders LIMIT 5;
-- created_at_ms should be created_at * 1000
