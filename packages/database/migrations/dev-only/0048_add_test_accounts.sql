-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- DEV ONLY: DO NOT RUN IN PRODUCTION
-- This migration inserts test accounts with known passwords.
-- Running this in production is a critical security vulnerability.
-- It is intentionally excluded from migrations_fresh/ (the prod path).
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- Add Test Accounts Migration
-- Created: 2025-12-04
-- Description: Add complete test accounts for all roles (Admin, Owner, Chef, Service, Cashier)

-- =====================================================
-- 1. Ensure owner1 exists with correct email
-- =====================================================
-- Insert owner1 if not exists (for fresh databases)
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('owner1', '$2a$10$WkTTAnK2XuDaViXuuTUJRewW8dy5J3s3MaOC2gukyJx3.9Hf43JM6', 'owner1@makanmasak.com', 'Restaurant Owner', 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Update owner1 email if already exists
UPDATE users
SET email = 'owner1@makanmasak.com',
    updated_at = strftime('%s', 'now') * 1000
WHERE username = 'owner1';

-- =====================================================
-- 2. Add Chef accounts (Role 2)
-- =====================================================
-- Chef 1: chef1 / chef123
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('chef1', '$2a$10$JTeKUALMxOui53R87/h5oOVKeuoFpuuFFlFZ97hHdwbXez86YbykC', 'chef1@makanmasak.com', 'Chef One', 2, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Chef 2: chef2 / chef123
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('chef2', '$2a$10$JTeKUALMxOui53R87/h5oOVKeuoFpuuFFlFZ97hHdwbXez86YbykC', 'chef2@makanmasak.com', 'Chef Two', 2, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- =====================================================
-- 3. Add Service accounts (Role 3)
-- =====================================================
-- Service 1: service1 / service123
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('service1', '$2a$10$dqGOHPaz1Zbg4a9U5b4UoOMQgNHOOXfLkqrgrBFUXJkFUYMksc4Ca', 'service1@makanmasak.com', 'Service One', 3, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Service 2: service2 / service123
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('service2', '$2a$10$dqGOHPaz1Zbg4a9U5b4UoOMQgNHOOXfLkqrgrBFUXJkFUYMksc4Ca', 'service2@makanmasak.com', 'Service Two', 3, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- =====================================================
-- 4. Add Cashier accounts (Role 4)
-- =====================================================
-- Cashier 1: cashier1 / cashier123
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('cashier1', '$2a$10$QBH6wQBHKCJZjp7kg7Qru.6/AJh5rZzg0ZrwJDC8bzLgTT3747AcG', 'cashier1@makanmasak.com', 'Cashier One', 4, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Cashier 2: cashier2 / cashier123
INSERT OR IGNORE INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at)
VALUES ('cashier2', '$2a$10$QBH6wQBHKCJZjp7kg7Qru.6/AJh5rZzg0ZrwJDC8bzLgTT3747AcG', 'cashier2@makanmasak.com', 'Cashier Two', 4, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- =====================================================
-- Test Accounts Summary:
-- =====================================================
-- | Username  | Password    | Role           | Email                    |
-- |-----------|-------------|----------------|--------------------------|
-- | admin     | admin123    | 0 (Admin)      | admin@makanmasak.com     |
-- | owner1    | owner123    | 1 (Owner)      | owner1@makanmasak.com    |
-- | chef1     | chef123     | 2 (Chef)       | chef1@makanmasak.com     |
-- | chef2     | chef123     | 2 (Chef)       | chef2@makanmasak.com     |
-- | service1  | service123  | 3 (Service)    | service1@makanmasak.com  |
-- | service2  | service123  | 3 (Service)    | service2@makanmasak.com  |
-- | cashier1  | cashier123  | 4 (Cashier)    | cashier1@makanmasak.com  |
-- | cashier2  | cashier123  | 4 (Cashier)    | cashier2@makanmasak.com  |
-- =====================================================
