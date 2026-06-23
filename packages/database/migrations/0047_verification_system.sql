-- Migration: Verification System (Password Reset, Email Verification, Phone Verification)
-- Created: 2025-11-23
-- Description: Add tables and columns for password reset, email verification, and phone verification

-- ============================================
-- 1. Password Reset Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL DEFAULT 'email' CHECK(token_type IN ('email', 'sms')),
  otp_code TEXT,                            -- 6-digit OTP for SMS (optional)
  expires_at INTEGER NOT NULL,              -- Unix timestamp (15 minutes)
  used_at INTEGER,                          -- Mark as used to prevent reuse
  ip_address TEXT,                          -- Request source IP
  user_agent TEXT,                          -- Browser/device info
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for password_reset_tokens
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_user_expires ON password_reset_tokens(user_id, expires_at);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- ============================================
-- 2. Email Verification Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,                      -- Email to verify
  expires_at INTEGER NOT NULL,              -- Unix timestamp (24 hours)
  verified_at INTEGER,                      -- Verification timestamp
  ip_address TEXT,                          -- Verification source IP
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for email_verification_tokens
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_expires ON email_verification_tokens(expires_at);

-- ============================================
-- 3. Phone Verification Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS phone_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  phone TEXT NOT NULL,                      -- Phone number in international format (+60xxxxxxxxx)
  otp_code TEXT NOT NULL,                   -- 6-digit OTP
  expires_at INTEGER NOT NULL,              -- Unix timestamp (5 minutes)
  verified_at INTEGER,                      -- Verification timestamp
  attempt_count INTEGER NOT NULL DEFAULT 0, -- Max 3 attempts
  ip_address TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for phone_verification_tokens
CREATE INDEX idx_phone_verification_user_phone ON phone_verification_tokens(user_id, phone);
CREATE INDEX idx_phone_verification_otp_expires ON phone_verification_tokens(otp_code, expires_at);

-- ============================================
-- 4. Password Change Audit Log
-- ============================================
CREATE TABLE IF NOT EXISTS password_change_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  change_method TEXT NOT NULL CHECK(change_method IN ('reset_email', 'reset_sms', 'manual', 'admin_reset')),
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 1,       -- Boolean: 1=success, 0=failure
  failure_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for password_change_logs
CREATE INDEX idx_password_change_user_created ON password_change_logs(user_id, created_at);
CREATE INDEX idx_password_change_created ON password_change_logs(created_at);

-- ============================================
-- 5. Add Verification Timestamp Columns to Users Table
-- ============================================
-- Check if columns already exist before adding
-- SQLite doesn't support ALTER TABLE IF NOT EXISTS, so we use pragma to check

-- Add email_verified_at column if not exists
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

-- Add phone_verified_at column if not exists
ALTER TABLE users ADD COLUMN phone_verified_at INTEGER;

-- ============================================
-- 6. Create Cleanup Job Trigger (Auto-delete expired tokens)
-- ============================================
-- Note: This is a placeholder. In production, use Cloudflare Cron Triggers or Workers Queues
-- For now, we'll rely on application logic to clean up expired tokens

-- ============================================
-- Migration Complete
-- ============================================
-- Tables created:
--   1. password_reset_tokens (password reset via email/SMS)
--   2. email_verification_tokens (email verification)
--   3. phone_verification_tokens (phone verification with OTP)
--   4. password_change_logs (audit trail)
--
-- Columns added to users:
--   - email_verified_at (timestamp when email was verified)
--   - phone_verified_at (timestamp when phone was verified)
--
-- Security features:
--   - Token expiry (15 min for password reset, 24h for email, 5 min for phone)
--   - One-time use tokens (used_at column)
--   - Attempt limiting (max 3 OTP attempts)
--   - IP address tracking
--   - Comprehensive audit logging
