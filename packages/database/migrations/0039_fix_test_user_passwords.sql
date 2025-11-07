-- Fix Test User Passwords
-- Created: 2025-10-27
-- Description: Update test user passwords with correct bcrypt hashes

-- Update admin password (admin123)
UPDATE users
SET password_hash = '$2a$10$ERWg3wj4FrhL7ugtGMwflO7.uAcGpec9e.gRRV3.Nxcqr.EcVEEP2'
WHERE username = 'admin';

-- Update owner1 password (owner123)
UPDATE users
SET password_hash = '$2a$10$WkTTAnK2XuDaViXuuTUJRewW8dy5J3s3MaOC2gukyJx3.9Hf43JM6'
WHERE username = 'owner1';
