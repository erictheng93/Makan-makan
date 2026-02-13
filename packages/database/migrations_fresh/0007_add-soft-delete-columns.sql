-- Add soft delete columns to partnership tables
ALTER TABLE partnerships ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE partnership_plans ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE verified_members ADD COLUMN deleted_at_ms INTEGER;

-- Add soft delete columns to scheduling tables
ALTER TABLE shift_templates ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE employee_schedules ADD COLUMN deleted_at_ms INTEGER;

-- Add soft delete columns to leave tables
ALTER TABLE leave_requests ADD COLUMN deleted_at_ms INTEGER;
