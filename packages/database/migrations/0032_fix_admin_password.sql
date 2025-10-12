-- Migration: Fix admin password hash
-- Description: Update admin user password hash with correctly generated bcrypt hash for "admin123"
-- Created: 2025-10-09
--
-- This hash was generated using: bcrypt.hashSync('admin123', 10)
-- The hash format is: $2a$10$[22 character salt][31 character hash]

-- Clear any existing incorrect hash and update with correct one
-- Verified working bcrypt hash for 'admin123'
UPDATE users
SET password_hash = '$2a$10$o0jVj.vO606CB2N37EH2t.fw1bk7MUf1IqQbxhIg/1cNV6QCIchVG'
WHERE username = 'admin';

-- Verify the update
SELECT username, password_hash, is_active
FROM users
WHERE username = 'admin';
