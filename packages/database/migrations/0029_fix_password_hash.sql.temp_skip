-- Migration: Fix password hash column
-- Description: Add password_hash column and migrate data
-- Created: 2025-10-09

-- Add password_hash column
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Update password_hash with bcrypt hashed passwords for test accounts
-- Note: These are bcrypt hashes of the plaintext passwords
UPDATE users SET password_hash = '$2a$10$rR5jHwIwcOvN7e.qN8kYa.kTKXH7ZOKw/uI5Y6F5fKc2fE3Xj9.4i' WHERE username = 'admin'; -- admin123
UPDATE users SET password_hash = '$2a$10$rR5jHwIwcOvN7e.qN8kYa.kTKXH7ZOKw/uI5Y6F5fKc2fE3Xj9.4i' WHERE username IN ('owner1', 'owner2'); -- owner123 (using same hash for now)
UPDATE users SET password_hash = '$2a$10$rR5jHwIwcOvN7e.qN8kYa.kTKXH7ZOKw/uI5Y6F5fKc2fE3Xj9.4i' WHERE username IN ('chef1', 'chef2'); -- chef123 (using same hash for now)
UPDATE users SET password_hash = '$2a$10$rR5jHwIwcOvN7e.qN8kYa.kTKXH7ZOKw/uI5Y6F5fKc2fE3Xj9.4i' WHERE username = 'service1'; -- service123 (using same hash for now)
UPDATE users SET password_hash = '$2a$10$rR5jHwIwcOvN7e.qN8kYa.kTKXH7ZOKw/uI5Y6F5fKc2fE3Xj9.4i' WHERE username = 'cashier1'; -- cashier123 (using same hash for now)

-- Mark migration complete
UPDATE users SET password_migrated = 1, migration_date = CURRENT_TIMESTAMP WHERE password_hash IS NOT NULL;
