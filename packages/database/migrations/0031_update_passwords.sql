-- Migration: Update passwords with correct bcrypt hashes
-- Description: Update all test user passwords with proper bcrypt hashes
-- Created: 2025-10-09

-- Update all user passwords with bcrypt hash of their plaintext passwords
-- admin123 hash
UPDATE users SET password_hash = '$2a$10$b83uNwNuc9Gy/2MiVb1dheF0/CeFyJGxqtEYGVgnw3eDoOIghUTk2' WHERE username = 'admin';

-- owner123, chef123, service123, cashier123 all use same password for demo
UPDATE users SET password_hash = '$2a$10$b83uNwNuc9Gy/2MiVb1dheF0/CeFyJGxqtEYGVgnw3eDoOIghUTk2' WHERE username IN ('owner1', 'owner2', 'chef1', 'chef2', 'service1', 'cashier1');
