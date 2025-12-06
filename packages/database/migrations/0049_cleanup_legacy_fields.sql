-- Cleanup Legacy Fields Migration
-- Created: 2025-12-04
-- Description: Remove legacy password field and migration tracking fields from users table

-- =====================================================
-- Note: SQLite does not support DROP COLUMN directly.
-- We need to recreate the table to remove columns.
-- For now, we'll document these fields as deprecated.
-- =====================================================

-- The following columns are deprecated and should not be used:
-- 1. users.password (legacy password field, replaced by password_hash)
-- 2. users.password_migrated (migration tracking field)
-- 3. users.migration_date (migration tracking field)

-- These columns will be cleaned up in a future migration that rebuilds the table.
-- For now, we'll just ensure they don't contain sensitive data.

-- Clear any data in the legacy password field (if any)
UPDATE users SET password = NULL WHERE password IS NOT NULL;

-- Mark all users as migrated (for cleanup tracking)
UPDATE users SET password_migrated = 1 WHERE password_migrated = 0 OR password_migrated IS NULL;

-- =====================================================
-- Documentation: Current users table structure
-- =====================================================
-- Active columns (DO USE):
--   - id, username, email, phone, full_name
--   - password_hash (bcrypt hash)
--   - role, restaurant_id
--   - address, date_of_birth, profile_image_url
--   - is_active, is_verified
--   - preferences, total_orders, total_spent
--   - last_login_at, password_changed_at
--   - email_verified_at, phone_verified_at
--   - created_at, updated_at
--
-- Deprecated columns (DO NOT USE):
--   - password (legacy, always NULL)
--   - password_migrated (legacy tracking)
--   - migration_date (legacy tracking)
-- =====================================================
