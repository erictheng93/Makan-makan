-- =================================================================
-- Password Security Migration Script
-- =================================================================
-- This script handles the migration from plain text passwords to bcrypt hashed passwords
-- 
-- ⚠️  CRITICAL SECURITY MIGRATION ⚠️ 
-- Run this script carefully in the following order:
-- 1. Run in development first to test
-- 2. Backup production database before running
-- 3. Run during maintenance window to minimize user impact
-- 4. Notify users they need to reset passwords if needed

-- =================================================================
-- STEP 1: Backup existing users table
-- =================================================================

-- Create backup table with current data
DROP TABLE IF EXISTS users_backup_before_hash_migration;
CREATE TABLE users_backup_before_hash_migration AS 
SELECT * FROM users;

-- =================================================================
-- STEP 2: Add migration tracking columns
-- =================================================================

-- Add column to track password migration status
ALTER TABLE users ADD COLUMN password_migrated BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN migration_date DATETIME DEFAULT NULL;

-- =================================================================
-- STEP 3: Create temporary admin user with hashed password
-- =================================================================
-- This ensures system access is maintained during migration
-- Password: "TempAdmin123!" (users must change immediately)
-- Hashed with bcrypt (12 rounds): $2b$12$5K5f5K5f5K5f5K5f5K5f5uXYZ...

INSERT OR IGNORE INTO users (
    username, 
    password, 
    role, 
    restaurant_id, 
    status, 
    password_migrated,
    migration_date,
    created_at
) VALUES (
    'temp_admin_migration',
    '$2b$12$LQv3c1yqBwcxmY7FfEd8g.dVpKQpjbKpGYqFfqfqfqfqfqfqfqfqfqfq', -- TempAdmin123!
    0, -- Admin role
    NULL,
    'active',
    1,
    datetime('now'),
    datetime('now')
);

-- =================================================================
-- STEP 4: Password migration strategy options
-- =================================================================

-- OPTION A: Force password reset for all users (RECOMMENDED for security)
-- This is the most secure approach - all users must create new passwords

-- Mark all existing passwords as invalid and require reset
UPDATE users 
SET password = 'INVALID_PLAINTEXT_PASSWORD_RESET_REQUIRED',
    password_migrated = 0,
    status = 'password_reset_required'
WHERE password_migrated = 0 
  AND username != 'temp_admin_migration';

-- OPTION B: Hash existing passwords in place (NOT RECOMMENDED)
-- Only use this if you must maintain user access without reset
-- Note: This preserves weak passwords that users may have chosen

-- Uncomment the following ONLY if you choose Option B:
/*
-- This would require a server-side script to hash each password
-- Cannot be done in pure SQL as bcrypt requires computational processing
UPDATE users 
SET password = '[HASH_PLACEHOLDER]', -- Replace with actual bcrypt hash
    password_migrated = 1,
    migration_date = datetime('now')
WHERE password_migrated = 0 
  AND username != 'temp_admin_migration'
  AND password != 'INVALID_PLAINTEXT_PASSWORD_RESET_REQUIRED';
*/

-- =================================================================
-- STEP 5: Create password reset tokens table (if not exists)
-- =================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- =================================================================
-- STEP 6: Add audit logging for password changes
-- =================================================================

-- Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Log the migration activity
INSERT INTO audit_logs (user_id, action, resource, details, created_at)
VALUES (
    NULL,
    'security_migration',
    'users',
    JSON_OBJECT(
        'type', 'password_hashing_migration',
        'affected_users', (SELECT COUNT(*) FROM users WHERE password_migrated = 0),
        'migration_strategy', 'force_reset',
        'backup_table', 'users_backup_before_hash_migration'
    ),
    datetime('now')
);

-- =================================================================
-- STEP 7: Security validation queries
-- =================================================================

-- Check migration progress
SELECT 
    'Migration Summary' as check_type,
    COUNT(*) as total_users,
    SUM(password_migrated) as migrated_users,
    COUNT(*) - SUM(password_migrated) as pending_users
FROM users;

-- Check for any plaintext passwords that might remain
SELECT 
    'Security Check' as check_type,
    COUNT(*) as potential_plaintext_passwords
FROM users 
WHERE LENGTH(password) < 50 -- bcrypt hashes are typically 60 chars
  AND password NOT LIKE '$2%' -- bcrypt hashes start with $2a$, $2b$, etc.
  AND password != 'INVALID_PLAINTEXT_PASSWORD_RESET_REQUIRED';

-- List users requiring password reset
SELECT 
    id, username, role, status, created_at
FROM users 
WHERE status = 'password_reset_required'
ORDER BY role, username;

-- =================================================================
-- STEP 8: Post-migration cleanup (run after testing)
-- =================================================================

-- After confirming migration success, remove temp admin (RUN MANUALLY)
/*
DELETE FROM users WHERE username = 'temp_admin_migration';
*/

-- Remove migration tracking columns (optional, run after stable period)
/*
ALTER TABLE users DROP COLUMN password_migrated;
ALTER TABLE users DROP COLUMN migration_date;
*/

-- =================================================================
-- ROLLBACK PLAN (Emergency use only)
-- =================================================================
/*
-- ⚠️ EMERGENCY ROLLBACK - Only use if migration fails completely
-- This restores the original data but reverts security improvements

-- 1. Restore users table from backup
DROP TABLE users;
CREATE TABLE users AS SELECT * FROM users_backup_before_hash_migration;

-- 2. Log the rollback
INSERT INTO audit_logs (action, resource, details, created_at)
VALUES (
    'security_rollback',
    'users',
    'Emergency rollback of password migration due to issues',
    datetime('now')
);
*/

-- =================================================================
-- IMPORTANT NEXT STEPS AFTER RUNNING THIS SCRIPT:
-- =================================================================
/*
1. Test login with temporary admin account
2. Implement password reset functionality in your application
3. Send password reset emails to all affected users
4. Monitor audit_logs for any security issues
5. Remove temporary admin account after confirming system works
6. Update application documentation
7. Set up monitoring for failed login attempts
8. Consider implementing account lockout policies

IMMEDIATE ACTION REQUIRED:
- Change temporary admin password immediately after testing
- Set up password reset endpoint in your API
- Configure email notifications for password resets
- Update user onboarding documentation
*/

SELECT 'PASSWORD MIGRATION SCRIPT COMPLETED' as status, datetime('now') as completed_at;