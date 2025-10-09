-- Migration: Add is_active column to users table
-- Description: Add missing is_active column
-- Created: 2025-10-09

-- Add is_active column
ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;

-- Update is_active based on status
UPDATE users SET is_active = 1 WHERE status = 'active';
UPDATE users SET is_active = 0 WHERE status != 'active';
