-- Migration: Support Customer Role (role = 5)
-- Description: Update triggers to allow customer role (5) which doesn't require restaurant_id
-- Date: 2025-10-10

-- Drop existing role validation triggers
DROP TRIGGER IF EXISTS validate_user_role_assignment;
DROP TRIGGER IF EXISTS validate_user_role_update;

-- Recreate INSERT trigger with customer role support
CREATE TRIGGER validate_user_role_assignment
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.role NOT IN (0, 1, 2, 3, 4, 5)
        THEN RAISE(ABORT, 'Invalid user role. Must be 0-5 (Admin, Owner, Chef, Service, Cashier, Customer)')
        WHEN NEW.role IN (1, 2, 3, 4) AND NEW.restaurant_id IS NULL
        THEN RAISE(ABORT, 'Restaurant staff must be assigned to a restaurant')
        WHEN LENGTH(TRIM(NEW.username)) < 3
        THEN RAISE(ABORT, 'Username must be at least 3 characters long')
        WHEN LENGTH(TRIM(COALESCE(NEW.password, NEW.password_hash, ''))) < 6
        THEN RAISE(ABORT, 'Password must be at least 6 characters long')
    END;
END;

-- Recreate UPDATE trigger with customer role support
CREATE TRIGGER validate_user_role_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.role NOT IN (0, 1, 2, 3, 4, 5)
        THEN RAISE(ABORT, 'Invalid user role. Must be 0-5 (Admin, Owner, Chef, Service, Cashier, Customer)')
        WHEN NEW.role IN (1, 2, 3, 4) AND NEW.restaurant_id IS NULL
        THEN RAISE(ABORT, 'Restaurant staff must be assigned to a restaurant')
    END;
END;

-- Add comment
-- This migration allows the customer role (5) which represents end-users of the platform
-- Customers do not require a restaurant_id as they are not staff members
